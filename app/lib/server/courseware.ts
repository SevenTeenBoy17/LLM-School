import { createHash, randomUUID } from "node:crypto";
import type { SessionUser } from "@/lib/server/authToken";
import { addAudit, coursewareDatabase, getUploadsForUser } from "@/lib/server/db";
import { generateReply } from "@/lib/server/llm";
import {
  CoursewareBriefSchema,
  CoursewarePlanSchema,
  assessCoursewarePlan,
  buildCoursewarePlannerPrompt,
  buildFallbackCoursewarePlan,
  parsePlannerReply,
  type CoursewareBrief,
  type CoursewarePlan,
  type CoursewareQualityReport,
} from "@/lib/courseware/core";
import { coursewarePlanToPptx } from "@/lib/courseware/pptx";

export type CoursewareGenerationSource = "remote" | "local" | "local-fallback";
export type CoursewareDeckStatus = "draft" | "reviewed";

export interface CoursewareDeck {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  grade: string;
  status: CoursewareDeckStatus;
  generationSource: CoursewareGenerationSource;
  sourceUploadIds: string[];
  sourceFiles: string[];
  plan: CoursewarePlan;
  quality: CoursewareQualityReport;
  stateVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface CoursewareActionResult {
  operationId: string;
  stateVersion: number;
  status: "succeeded";
  authoritativeEntity: CoursewareDeck;
  nextActions: Array<"review_slides" | "save_revision" | "download_pptx">;
  duplicate?: boolean;
}

type Row = Record<string, unknown>;
type StoredOperation = {
  state: "pending" | "done";
  result: CoursewareActionResult | null;
  updatedAt: number;
  leaseToken: string | null;
};

type OperationStart = {
  replay: CoursewareActionResult | null;
  leaseToken: string | null;
};

const OPERATION_LEASE_MS = 10 * 60_000;

let schemaReady = false;
function database() {
  const d = coursewareDatabase();
  if (!schemaReady) {
    d.exec(`CREATE TABLE IF NOT EXISTS courseware_decks (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      status TEXT NOT NULL,
      generationSource TEXT NOT NULL,
      sourceUploadIdsJson TEXT NOT NULL,
      sourceFilesJson TEXT NOT NULL,
      planJson TEXT NOT NULL,
      stateVersion INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL);`);
    d.exec(`CREATE INDEX IF NOT EXISTS idx_courseware_owner ON courseware_decks(ownerId, updatedAt DESC);`);
    d.exec(`CREATE TABLE IF NOT EXISTS courseware_operations (
      ownerId TEXT NOT NULL,
      operationId TEXT NOT NULL,
      action TEXT NOT NULL,
      state TEXT NOT NULL,
      resultJson TEXT,
      leaseToken TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY(ownerId, operationId));`);
    const operationColumns = d.prepare("PRAGMA table_info(courseware_operations)").all() as Row[];
    if (!operationColumns.some((column) => String(column.name) === "leaseToken")) {
      d.exec("ALTER TABLE courseware_operations ADD COLUMN leaseToken TEXT");
    }
    schemaReady = true;
  }
  return d;
}

function parseJson<T>(value: unknown, fallback: T): T {
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
}

function mapDeck(row: Row): CoursewareDeck {
  const plan = CoursewarePlanSchema.parse(parseJson(row.planJson, null));
  const status = row.status === "reviewed" ? "reviewed" : "draft";
  const source = ["remote", "local", "local-fallback"].includes(String(row.generationSource))
    ? String(row.generationSource) as CoursewareGenerationSource
    : "local-fallback";
  return {
    id: String(row.id),
    ownerId: String(row.ownerId),
    title: String(row.title),
    subject: String(row.subject),
    grade: String(row.grade),
    status,
    generationSource: source,
    sourceUploadIds: parseJson<string[]>(row.sourceUploadIdsJson, []),
    sourceFiles: parseJson<string[]>(row.sourceFilesJson, []),
    plan,
    quality: assessCoursewarePlan(plan),
    stateVersion: Number(row.stateVersion),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  };
}

function operationFingerprint(action: string, payload: unknown): string {
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `${action}:${digest}`;
}

function operationResult(ownerId: string, operationId: string, action: string): StoredOperation | null {
  const row = database().prepare(
    "SELECT action, state, resultJson, updatedAt, leaseToken FROM courseware_operations WHERE ownerId = ? AND operationId = ?",
  ).get(ownerId, operationId) as Row | undefined;
  if (!row) return null;
  if (row.action !== action) throw new CoursewareOperationConflictError();
  const result = row.resultJson ? parseJson<CoursewareActionResult | null>(row.resultJson, null) : null;
  if (result?.authoritativeEntity?.plan) {
    const parsedPlan = CoursewarePlanSchema.safeParse(result.authoritativeEntity.plan);
    // Never repeat a completed write when its cached response is corrupt.
    if (!parsedPlan.success) throw new CoursewareOperationConflictError();
    result.authoritativeEntity.plan = parsedPlan.data;
    result.authoritativeEntity.quality = assessCoursewarePlan(result.authoritativeEntity.plan);
  }
  return {
    state: row.state === "done" ? "done" : "pending",
    result,
    updatedAt: Number(row.updatedAt),
    leaseToken: row.leaseToken ? String(row.leaseToken) : null,
  };
}

function reserveOperation(ownerId: string, operationId: string, action: string, leaseToken: string): boolean {
  const now = Date.now();
  const result = database().prepare(
    `INSERT OR IGNORE INTO courseware_operations
      (ownerId, operationId, action, state, resultJson, leaseToken, createdAt, updatedAt)
      VALUES (?, ?, ?, 'pending', NULL, ?, ?, ?)`,
  ).run(ownerId, operationId, action, leaseToken, now, now);
  return Number(result.changes) === 1;
}

function finishOperation(ownerId: string, operationId: string, action: string, leaseToken: string, result: CoursewareActionResult): void {
  const update = database().prepare(
    "UPDATE courseware_operations SET state = 'done', resultJson = ?, updatedAt = ? WHERE ownerId = ? AND operationId = ? AND action = ? AND leaseToken = ? AND state = 'pending'",
  ).run(JSON.stringify(result), Date.now(), ownerId, operationId, action, leaseToken);
  if (Number(update.changes) !== 1) throw new Error("courseware_operation_finalize_failed");
}

function releaseOperation(ownerId: string, operationId: string, action: string, leaseToken: string): void {
  database().prepare(
    "DELETE FROM courseware_operations WHERE ownerId = ? AND operationId = ? AND action = ? AND leaseToken = ? AND state = 'pending'",
  ).run(ownerId, operationId, action, leaseToken);
}

export class CoursewareOperationInProgressError extends Error {
  constructor() { super("operation_in_progress"); }
}

export class CoursewareOperationConflictError extends Error {
  constructor() { super("operation_conflict"); }
}

export class CoursewareVersionConflictError extends Error {
  current: CoursewareDeck;
  constructor(current: CoursewareDeck) {
    super("version_conflict");
    this.current = current;
  }
}

function inImmediateTransaction<T>(work: () => T): T {
  const d = database();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    d.exec("COMMIT");
    return result;
  } catch (error) {
    try { d.exec("ROLLBACK"); } catch { /* preserve the original failure */ }
    throw error;
  }
}

function beginIdempotentOperation(ownerId: string, operationId: string, action: string): OperationStart {
  const existing = operationResult(ownerId, operationId, action);
  if (existing?.state === "done") {
    if (!existing.result) throw new CoursewareOperationInProgressError();
    return { replay: { ...existing.result, duplicate: true }, leaseToken: null };
  }
  if (existing?.state === "pending") {
    if (Date.now() - existing.updatedAt < OPERATION_LEASE_MS) throw new CoursewareOperationInProgressError();
    const leaseToken = randomUUID();
    const reclaimed = database().prepare(
      "UPDATE courseware_operations SET leaseToken = ?, updatedAt = ? WHERE ownerId = ? AND operationId = ? AND action = ? AND state = 'pending' AND updatedAt = ? AND leaseToken IS ?",
    ).run(leaseToken, Date.now(), ownerId, operationId, action, existing.updatedAt, existing.leaseToken);
    if (Number(reclaimed.changes) !== 1) throw new CoursewareOperationInProgressError();
    return { replay: null, leaseToken };
  }
  const leaseToken = randomUUID();
  if (!reserveOperation(ownerId, operationId, action, leaseToken)) {
    const raced = operationResult(ownerId, operationId, action);
    if (!raced || raced.state === "pending" || !raced.result) throw new CoursewareOperationInProgressError();
    return { replay: { ...raced.result, duplicate: true }, leaseToken: null };
  }
  return { replay: null, leaseToken };
}

function sourceFacts(text: string): string[] {
  return text
    .split(/[\n。！？!?；;]+/)
    .map((item) => item.replace(/^【[^】]+】\s*/, "").replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 4 && item.length <= 140)
    .slice(0, 4);
}

function sourceContext(userId: string, brief: CoursewareBrief): { material: string; ids: string[]; files: string[] } {
  const uploads = getUploadsForUser(userId, [...new Set(brief.uploadIds)]);
  let remaining = 12_000;
  const parts: string[] = [];
  for (const upload of uploads) {
    if (remaining <= 0) break;
    const excerpt = upload.textContent.slice(0, Math.min(remaining, 4_000));
    remaining -= excerpt.length;
    parts.push(`【${upload.name}】\n${excerpt}`);
  }
  return { material: parts.join("\n\n"), ids: uploads.map((item) => item.id), files: uploads.map((item) => item.name) };
}

export function listCoursewareDecks(ownerId: string, limit = 30): CoursewareDeck[] {
  return (database().prepare(
    "SELECT * FROM courseware_decks WHERE ownerId = ? ORDER BY updatedAt DESC LIMIT ?",
  ).all(ownerId, Math.min(100, Math.max(1, limit))) as Row[]).map(mapDeck);
}

export function getCoursewareDeck(ownerId: string, id: string): CoursewareDeck | null {
  const row = database().prepare(
    "SELECT * FROM courseware_decks WHERE ownerId = ? AND id = ?",
  ).get(ownerId, id) as Row | undefined;
  return row ? mapDeck(row) : null;
}

export async function createCoursewarePlan(user: SessionUser, input: CoursewareBrief): Promise<CoursewareActionResult> {
  const brief = CoursewareBriefSchema.parse(input);
  const action = operationFingerprint("plan", brief);
  const operation = beginIdempotentOperation(user.id, brief.operationId, action);
  if (operation.replay) return operation.replay;
  if (!operation.leaseToken) throw new CoursewareOperationInProgressError();
  const leaseToken = operation.leaseToken;
  try {
    const references = sourceContext(user.id, brief);
    const reply = await generateReply({
      message: buildCoursewarePlannerPrompt(brief, references.material),
      history: [],
      user,
      modelId: "chatgpt",
      deepThink: true,
      responseFormat: "json_object",
      structuredTask: "courseware",
    });
    const remotePlan = parsePlannerReply(reply.text, brief);
    const plan = remotePlan ?? buildFallbackCoursewarePlan(brief, sourceFacts(references.material));
    const generationSource: CoursewareGenerationSource = remotePlan ? reply.source : "local-fallback";
    const now = Date.now();
    const id = randomUUID();
    const deck: CoursewareDeck = {
      id,
      ownerId: user.id,
      title: plan.title,
      subject: plan.subject,
      grade: plan.grade,
      status: "draft",
      generationSource,
      sourceUploadIds: references.ids,
      sourceFiles: references.files,
      plan,
      quality: assessCoursewarePlan(plan),
      stateVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const result: CoursewareActionResult = {
      operationId: brief.operationId,
      stateVersion: deck.stateVersion,
      status: "succeeded",
      authoritativeEntity: deck,
      nextActions: ["review_slides", "save_revision", "download_pptx"],
    };
    inImmediateTransaction(() => {
      database().prepare(
        `INSERT INTO courseware_decks
          (id, ownerId, title, subject, grade, status, generationSource, sourceUploadIdsJson, sourceFilesJson, planJson, stateVersion, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, 1, ?, ?)`,
      ).run(
        id, user.id, plan.title, plan.subject, plan.grade, generationSource,
        JSON.stringify(references.ids), JSON.stringify(references.files), JSON.stringify(plan), now, now,
      );
      finishOperation(user.id, brief.operationId, action, leaseToken, result);
    });
    addAudit({ userId: user.id, role: user.role, path: "/api/courseware/plan", action: `courseware_plan:${generationSource}`, result: "allow" });
    return result;
  } catch (error) {
    releaseOperation(user.id, brief.operationId, action, leaseToken);
    throw error;
  }
}

export function saveCoursewarePlan(
  user: SessionUser,
  input: { id: string; operationId: string; stateVersion: number; plan: CoursewarePlan },
): CoursewareActionResult {
  const plan = CoursewarePlanSchema.parse(input.plan);
  const quality = assessCoursewarePlan(plan);
  if (quality.issues.length) throw new Error(`invalid_plan:${quality.issues.join("|")}`);
  const action = operationFingerprint("save_revision", {
    id: input.id,
    stateVersion: input.stateVersion,
    plan,
  });
  const operation = beginIdempotentOperation(user.id, input.operationId, action);
  if (operation.replay) return operation.replay;
  if (!operation.leaseToken) throw new CoursewareOperationInProgressError();
  const leaseToken = operation.leaseToken;
  try {
    const result = inImmediateTransaction(() => {
      const now = Date.now();
      const update = database().prepare(
        `UPDATE courseware_decks
         SET title = ?, subject = ?, grade = ?, status = 'reviewed', planJson = ?, stateVersion = stateVersion + 1, updatedAt = ?
         WHERE id = ? AND ownerId = ? AND stateVersion = ?`,
      ).run(plan.title, plan.subject, plan.grade, JSON.stringify(plan), now, input.id, user.id, input.stateVersion);
      if (Number(update.changes) !== 1) {
        const current = getCoursewareDeck(user.id, input.id);
        if (!current) throw new Error("courseware_not_found");
        throw new CoursewareVersionConflictError(current);
      }
      const deck = getCoursewareDeck(user.id, input.id);
      if (!deck) throw new Error("courseware_not_found");
      const next: CoursewareActionResult = {
        operationId: input.operationId,
        stateVersion: deck.stateVersion,
        status: "succeeded",
        authoritativeEntity: deck,
        nextActions: ["save_revision", "download_pptx"],
      };
      finishOperation(user.id, input.operationId, action, leaseToken, next);
      return next;
    });
    addAudit({ userId: user.id, role: user.role, path: `/api/courseware/${input.id}`, action: "courseware_revision", result: "allow" });
    return result;
  } catch (error) {
    releaseOperation(user.id, input.operationId, action, leaseToken);
    throw error;
  }
}

export async function buildCoursewareDownload(ownerId: string, id: string): Promise<{ deck: CoursewareDeck; bytes: Buffer; fileName: string } | null> {
  const deck = getCoursewareDeck(ownerId, id);
  if (!deck) return null;
  const bytes = await coursewarePlanToPptx(deck.plan);
  return { deck, bytes, fileName: `${safeCoursewareFileName(deck.title)}-可编辑结构稿.pptx` };
}

export function safeCoursewareFileName(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return cleaned || "EduAI-课件";
}
