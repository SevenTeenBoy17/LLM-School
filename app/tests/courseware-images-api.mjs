import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import JSZip from "jszip";
import { buildCoursewareSlideImagePrompt } from "../lib/courseware/visual.ts";
import { startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const temp = mkdtempSync(join(tmpdir(), "eduai-courseware-images-"));
const env = { LLM_API_KEY: process.env.LLM_API_KEY, LLM_IMAGE_API_KEY: process.env.LLM_IMAGE_API_KEY };
process.env.LLM_API_KEY = ""; process.env.LLM_IMAGE_API_KEY = "";
let server, db;
try {
  server = await startIsolatedManorDevServer({ label: "courseware-images", tempDbDir: temp });
  const base = server.base;
  async function login(username, password) {
    const res = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    assert.equal(res.status, 200); return res.headers.get("set-cookie").split(";", 1)[0];
  }
  const teacher = await login("teacher", "Teacher@123");
  const research = await login("research", "Research@123");
  const student = await login("student", "Student@123");
  async function request(path, cookie = teacher, body, method = body ? "POST" : "GET", headers = {}) {
    return fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const plan = await request("/api/courseware/plan", teacher, { operationId: "image-contract-plan-001", subject: "地理", grade: "七年级", topic: "亚洲自然环境", slideCount: 4, objectives: ["读图并解释"], style: "clear", sourceSummary: "", uploadIds: [] });
  assert.equal(plan.status, 200);
  const deck = (await plan.json()).authoritativeEntity;
  const root = `/api/courseware/${deck.id}`;
  const slidePath = `${root}/visuals/${deck.plan.slides[0].id}`;
  assert.equal((await request(`${root}/visuals`, null)).status, 401);
  assert.equal((await request(`${root}/visuals`, student)).status, 403);
  assert.equal((await request(`${root}/visuals`, research)).status, 404);
  assert.equal((await request(slidePath, teacher, { stateVersion: 1 }, "POST", { origin: "https://malicious.example" })).status, 403);
  assert.equal((await request(slidePath, teacher, { stateVersion: 1, url: "http://127.0.0.1/" })).status, 400);
  assert.equal((await request(slidePath, teacher, { stateVersion: 99 })).status, 409);
  assert.equal((await request(slidePath, research, { stateVersion: 1 })).status, 404);
  assert.equal((await request(`${root}/download?mode=visual`)).status, 409);
  assert.equal((await request(slidePath, teacher, { stateVersion: 1 })).status, 502);
  assert.equal((await (await request(`${root}/visuals`)).json()).items[0].state, "failed");

  db = new DatabaseSync(join(temp, "eduai.sqlite"));
  const fixture = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#dbe6eb" } }).png().toBuffer();
  const hashes = deck.plan.slides.map(slide => createHash("sha256").update(buildCoursewareSlideImagePrompt(deck.plan, slide)).digest("hex"));
  deck.plan.slides.forEach((slide, index) => db.prepare(`INSERT INTO courseware_visuals(ownerId,deckId,slideId,fingerprint,state,lease,bytes,updatedAt) VALUES(?,?,?,?,'ready','test-fixture',?,?) ON CONFLICT(ownerId,deckId,slideId,fingerprint) DO UPDATE SET state='ready',bytes=excluded.bytes`).run(deck.ownerId, deck.id, slide.id, hashes[index], fixture, Date.now()));
  const ready = (await (await request(`${root}/visuals`)).json()).items;
  assert.equal(ready.every(item => item.state === "ready"), true);
  assert.equal((await request(slidePath, teacher, { stateVersion: 1 })).status, 200, "ready retry must not call unconfigured provider");
  const image = await request(ready[0].imageUrl);
  assert.equal(image.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), fixture);
  assert.equal((await request(ready[0].imageUrl, research)).status, 404);
  const file = await request(`${root}/download?mode=visual`);
  assert.equal(file.status, 200);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  for (let i = 1; i <= 4; i++) {
    assert.deepEqual(await zip.file(`ppt/media/slide${i}.png`).async("nodebuffer"), fixture);
    const xml = await zip.file(`ppt/slides/slide${i}.xml`).async("string");
    assert.match(xml, /<p:pic>/); assert.doesNotMatch(xml, /<p:sp>/);
    assert.ok(zip.file(`ppt/notesSlides/notesSlide${i}.xml`));
  }
  db.prepare("UPDATE courseware_visuals SET state='generating',updatedAt=? WHERE ownerId=? AND deckId=? AND slideId IN (?,?)").run(Date.now(), deck.ownerId, deck.id, deck.plan.slides[0].id, deck.plan.slides[1].id);
  assert.equal((await request(slidePath, teacher, { stateVersion: 1 })).status, 409);
  db.prepare("UPDATE courseware_visuals SET state='failed' WHERE ownerId=? AND deckId=? AND slideId=?").run(deck.ownerId, deck.id, deck.plan.slides[2].id);
  assert.equal((await request(`${root}/visuals/${deck.plan.slides[2].id}`, teacher, { stateVersion: 1 })).status, 429);
  db.prepare("UPDATE courseware_visuals SET updatedAt=0 WHERE ownerId=? AND deckId=?").run(deck.ownerId, deck.id);
  assert.equal((await request(slidePath, teacher, { stateVersion: 1 })).status, 502, "stale lease should be retried, not locked forever");
  deck.plan.slides[3].title += "（修订）";
  assert.equal((await request(root, teacher, { operationId: "image-content-revision-001", stateVersion: 1, plan: deck.plan }, "PATCH")).status, 200);
  assert.equal((await (await request(`${root}/visuals`)).json()).items[3].state, "stale");
  assert.equal((await request(ready[3].imageUrl)).status, 409);
  assert.equal((await request(`${root}/download?mode=visual`)).status, 409);
  console.log(JSON.stringify({ ok: true, auth: true, ownership: true, csrf: true, version: true, failureRecovery: true, replay: true, concurrencyLimit: true, staleLease: true, invalidation: true, imageExportParity: true }));
} finally {
  db?.close(); await server?.cleanup();
  for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const target = resolve(temp);
  if (!target.startsWith(`${resolve(tmpdir())}${sep}`) || !basename(target).startsWith("eduai-courseware-images-")) throw new Error("unsafe cleanup");
  rmSync(target, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
