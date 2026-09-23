import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { coursewareDatabase } from "@/lib/server/db";
import { getCoursewareDeck } from "@/lib/server/courseware";
import { imagePromptGate } from "@/lib/server/imagegen";
import { generateCoursewareImage } from "@/lib/server/coursewareImageGateway";
import { buildCoursewareSlideImagePrompt, type SlideVisualStatus } from "@/lib/courseware/visual";
import { coursewarePlanToPptx } from "@/lib/courseware/pptx";

type Row = { fingerprint: string; state: string; lease: string; updatedAt: number; bytes?: Uint8Array; error?: string };
const LEASE_MS = 15 * 60_000;
let schemaReady = false;
function db() {
  const d = coursewareDatabase();
  if (!schemaReady) {
    d.exec(`CREATE TABLE IF NOT EXISTS courseware_visuals (
      ownerId TEXT NOT NULL, deckId TEXT NOT NULL, slideId TEXT NOT NULL, fingerprint TEXT NOT NULL,
      state TEXT NOT NULL, lease TEXT NOT NULL, bytes BLOB, error TEXT, updatedAt INTEGER NOT NULL,
      PRIMARY KEY(ownerId, deckId, slideId, fingerprint))`);
    d.exec(`CREATE TABLE IF NOT EXISTS courseware_image_sources (
      ownerId TEXT NOT NULL, deckId TEXT NOT NULL, slideId TEXT NOT NULL, fingerprint TEXT NOT NULL,
      sourceUrl TEXT NOT NULL, savedAt INTEGER NOT NULL,
      PRIMARY KEY(ownerId, deckId, slideId, fingerprint))`);
    schemaReady = true;
  }
  return d;
}
export class CoursewareVisualError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
function slideContext(ownerId: string, deckId: string, slideId: string) {
  const deck = getCoursewareDeck(ownerId, deckId);
  const slide = deck?.plan.slides.find((s) => s.id === slideId);
  if (!deck || !slide) throw new CoursewareVisualError("NOT_FOUND", 404, "课件页面不存在或不属于当前账号。");
  const prompt = buildCoursewareSlideImagePrompt(deck.plan, slide);
  const fingerprint = createHash("sha256").update(prompt).digest("hex");
  return { deck, slide, prompt, fingerprint };
}
function rowFor(owner: string, deck: string, slide: string, hash: string): Row | undefined {
  return db().prepare("SELECT fingerprint,state,lease,updatedAt,error FROM courseware_visuals WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=?")
    .get(owner, deck, slide, hash) as Row | undefined;
}
export function listCoursewareVisuals(owner: string, deckId: string): SlideVisualStatus[] {
  const deck = getCoursewareDeck(owner, deckId);
  if (!deck) throw new CoursewareVisualError("NOT_FOUND", 404, "课件不存在或不属于当前账号。");
  return deck.plan.slides.map((slide) => {
    const { fingerprint } = slideContext(owner, deckId, slide.id);
    const row = rowFor(owner, deckId, slide.id, fingerprint);
    const previous = !row && db().prepare("SELECT 1 FROM courseware_visuals WHERE ownerId=? AND deckId=? AND slideId=? LIMIT 1").get(owner, deckId, slide.id);
    const state = row?.state === "ready" ? "ready" : row?.state === "generating" && Date.now() - row.updatedAt < LEASE_MS
      ? "generating" : row ? "failed" : previous ? "stale" : "missing";
    return { slideId: slide.id, state, ...(state === "ready" ? {
      imageUrl: `/api/courseware/${encodeURIComponent(deckId)}/visuals/${encodeURIComponent(slide.id)}?v=${fingerprint}`,
    } : {}), ...(state === "failed" ? { error: row?.error || "生成中断，可重试本页。" } : {}) };
  });
}
export async function generateCoursewareVisual(owner: string, deckId: string, slideId: string, stateVersion: number) {
  const { deck, prompt, fingerprint } = slideContext(owner, deckId, slideId);
  if (deck.stateVersion !== stateVersion) throw new CoursewareVisualError("VERSION_CONFLICT", 409, "方案版本已改变，请重新载入后生成。");
  const gate = imagePromptGate(prompt);
  if (gate.verdict !== "ok") throw new CoursewareVisualError("CONTENT_BLOCKED", 400, "本页内容未通过校园图像安全检查，请修改后重试。");
  const d = db();
  const lease = randomUUID();
  let cached = false;
  d.exec("BEGIN IMMEDIATE");
  try {
    const row = rowFor(owner, deckId, slideId, fingerprint);
    if (row?.state === "ready") cached = true;
    else {
      if (row?.state === "generating" && Date.now() - row.updatedAt < LEASE_MS) throw new CoursewareVisualError("IN_PROGRESS", 409, "本页仍在生成，请稍后刷新。");
      const active = d.prepare("SELECT count(*) AS n FROM courseware_visuals WHERE ownerId=? AND state='generating' AND updatedAt>?").get(owner, Date.now() - LEASE_MS) as { n: number };
      if (active.n >= 2) throw new CoursewareVisualError("BUSY", 429, "已有两页正在生成，请稍后重试。");
      d.prepare(`INSERT INTO courseware_visuals(ownerId,deckId,slideId,fingerprint,state,lease,updatedAt)
        VALUES(?,?,?,?,'generating',?,?) ON CONFLICT(ownerId,deckId,slideId,fingerprint)
        DO UPDATE SET state='generating',lease=excluded.lease,error=NULL,updatedAt=excluded.updatedAt`).run(owner, deckId, slideId, fingerprint, lease, Date.now());
    }
    d.exec("COMMIT");
  } catch (error) { d.exec("ROLLBACK"); throw error; }
  if (cached) return listCoursewareVisuals(owner, deckId);
  try {
    const cachedSource = d.prepare("SELECT sourceUrl FROM courseware_image_sources WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=? AND savedAt>?")
      .get(owner, deckId, slideId, fingerprint, Date.now() - 45 * 60_000) as { sourceUrl: string } | undefined;
    const b64 = await generateCoursewareImage(prompt, { url: cachedSource?.sourceUrl, save: (url) => {
      d.prepare(`INSERT INTO courseware_image_sources(ownerId,deckId,slideId,fingerprint,sourceUrl,savedAt) VALUES(?,?,?,?,?,?)
        ON CONFLICT(ownerId,deckId,slideId,fingerprint) DO UPDATE SET sourceUrl=excluded.sourceUrl,savedAt=excluded.savedAt`)
        .run(owner, deckId, slideId, fingerprint, url, Date.now());
    } });
    // Decode and re-encode server-side; reject invalid/oversized images and remove metadata.
    if (b64.length > 16 * 1024 * 1024) throw new Error("img_input_too_large");
    const input = Buffer.from(b64, "base64");
    const pipeline = sharp(input, { limitInputPixels: 24_000_000 });
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height || metadata.width < 1000 || metadata.height < 500) throw new Error("low_resolution");
    const bytes = await pipeline.resize(1920, 1080, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    if (bytes.length > 16 * 1024 * 1024) throw new Error("image_too_large");
    const result = d.prepare("UPDATE courseware_visuals SET state='ready',bytes=?,error=NULL,updatedAt=? WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=? AND lease=? AND state='generating'")
      .run(bytes, Date.now(), owner, deckId, slideId, fingerprint, lease);
    if (!result.changes) throw new CoursewareVisualError("SUPERSEDED", 409, "生成任务已被较新的任务替代，请刷新。");
    d.prepare("DELETE FROM courseware_image_sources WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=?").run(owner, deckId, slideId, fingerprint);
    return listCoursewareVisuals(owner, deckId);
  } catch (error) {
    if (error instanceof Error && error.message === "img_asset_expired") {
      d.prepare("DELETE FROM courseware_image_sources WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=?").run(owner, deckId, slideId, fingerprint);
    }
    const diagnostic = error instanceof Error && /^(img_[a-z0-9_]+|low_resolution|image_too_large)$/.test(error.message) ? error.message : error instanceof Error ? error.name : "unknown";
    console.warn("[courseware-visual]", diagnostic);
    const message = error instanceof Error && /img_no_key|img_no_base/.test(error.message)
      ? "图像服务尚未配置，文字方案已保留。" : "图像服务生成失败，已保留方案，可重试本页。";
    d.prepare("UPDATE courseware_visuals SET state='failed',error=?,updatedAt=? WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=? AND lease=? AND state='generating'")
      .run(message, Date.now(), owner, deckId, slideId, fingerprint, lease);
    if (error instanceof CoursewareVisualError) throw error;
    throw new CoursewareVisualError("IMAGE_FAILED", 502, message);
  }
}
export function readCoursewareVisual(owner: string, deck: string, slide: string, requestedHash?: string | null): Buffer {
  const { fingerprint } = slideContext(owner, deck, slide);
  if (requestedHash && requestedHash !== fingerprint) throw new CoursewareVisualError("STALE", 409, "方案已修改，需要重新生成本页。");
  const row = db().prepare("SELECT bytes FROM courseware_visuals WHERE ownerId=? AND deckId=? AND slideId=? AND fingerprint=? AND state='ready'")
    .get(owner, deck, slide, fingerprint) as Row | undefined;
  if (!row?.bytes) throw new CoursewareVisualError("NOT_READY", 409, "本页成品图尚未生成。");
  return Buffer.from(row.bytes);
}
export async function buildVisualCoursewareDownload(owner: string, id: string) {
  const deck = getCoursewareDeck(owner, id);
  if (!deck) throw new CoursewareVisualError("NOT_FOUND", 404, "课件不存在或不属于当前账号。");
  const images = deck.plan.slides.map((slide) => readCoursewareVisual(owner, id, slide.id));
  return { deck, bytes: await coursewarePlanToPptx(deck.plan, images) };
}
