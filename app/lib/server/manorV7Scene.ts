import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { LANDMARK_BADGE_GATE, MANOR_PARTS } from "@/lib/gamify";
import { manorV2Database, pointsBalance } from "@/lib/server/db";
import { MANOR_LAYOUT_SLOTS, type ManorSceneCommand, type ManorSceneSnapshot } from "@/lib/manor/v7-scene-contracts";

function database() {
  const d = manorV2Database();
  d.exec(`CREATE TABLE IF NOT EXISTS manor_scene_profiles (
    studentId TEXT PRIMARY KEY, layoutRevision INTEGER NOT NULL DEFAULT 0,
    publicationRevision INTEGER NOT NULL DEFAULT 0, publishedClassId TEXT);
    CREATE TABLE IF NOT EXISTS manor_scene_layout (
    itemId TEXT PRIMARY KEY, studentId TEXT NOT NULL, slotId TEXT NOT NULL,
    updatedAt INTEGER NOT NULL, UNIQUE(studentId,slotId));
    CREATE TABLE IF NOT EXISTS manor_scene_policies (
    classId TEXT PRIMARY KEY, unlockedCount INTEGER NOT NULL DEFAULT 10,
    revision INTEGER NOT NULL DEFAULT 0, updatedBy TEXT NOT NULL, updatedAt INTEGER NOT NULL);`);
  return d;
}
function identity(studentId: string) {
  return database().prepare("SELECT id,name,classId FROM users WHERE id=? AND role='student'").get(studentId) as { id: string; name: string; classId: string } | undefined;
}
function profile(studentId: string) {
  return database().prepare("SELECT layoutRevision,publicationRevision,publishedClassId FROM manor_scene_profiles WHERE studentId=?").get(studentId) as { layoutRevision: number; publicationRevision: number; publishedClassId: string | null } | undefined;
}
export function manorOpenPlotCount(studentId: string): number {
  const user = identity(studentId);
  if (!user?.classId) return 10;
  const policy = database().prepare("SELECT unlockedCount FROM manor_scene_policies WHERE classId=?").get(user.classId) as { unlockedCount: number } | undefined;
  return Math.max(10, Math.min(24, policy?.unlockedCount ?? 10));
}
export function manorSceneSnapshot(studentId: string): ManorSceneSnapshot {
  const d = database(), user = identity(studentId), p = profile(studentId);
  const classId = user?.classId || null;
  const badges = Number((d.prepare("SELECT COUNT(*) AS count FROM user_badges WHERE userId=?").get(studentId) as { count: number }).count);
  const inventory = d.prepare(`SELECT i.id,i.partId,i.acquiredAt,l.slotId,i.x,i.y FROM manor_items i
    LEFT JOIN manor_scene_layout l ON l.itemId=i.id AND l.studentId=i.userId
    WHERE i.userId=? ORDER BY i.acquiredAt,i.id`).all(studentId) as unknown as Array<{ id: string; partId: string; acquiredAt: number; slotId: ManorSceneSnapshot["inventory"][number]["slotId"]; x: number | null; y: number | null }>;
  const neighbors = classId ? d.prepare(`SELECT u.id,u.name FROM users u JOIN manor_scene_profiles p ON p.studentId=u.id
    WHERE u.role='student' AND u.classId=? AND p.publishedClassId=u.classId AND u.id<>? ORDER BY u.name,u.id`).all(classId, studentId) as unknown as Array<{ id: string; name: string }> : [];
  const classmateCount = classId ? Number((d.prepare("SELECT COUNT(*) AS count FROM users WHERE role='student' AND classId=? AND id<>?").get(classId, studentId) as { count: number }).count) : 0;
  return {
    layoutRevision: p?.layoutRevision ?? 0,
    publication: { enabled: Boolean(classId && p?.publishedClassId === classId), revision: p?.publicationRevision ?? 0, classId },
    inventory: inventory.map(({ x, y, ...item }) => ({ ...item, name: MANOR_PARTS.find((part) => part.id === item.partId)?.name ?? "历史收藏", legacyPosition: x !== null && y !== null && !item.slotId })),
    catalog: MANOR_PARTS.map((part) => ({ id: part.id, name: part.name, price: part.price, badgeGate: LANDMARK_BADGE_GATE[part.id] ?? 0, eligible: badges >= (LANDMARK_BADGE_GATE[part.id] ?? 0) })),
    balance: pointsBalance(studentId), neighbors, classmateCount,
  };
}
export function manorSceneVisit(viewerId: string, ownerId: string) {
  const viewer = identity(viewerId), owner = identity(ownerId), publication = profile(ownerId);
  if (!viewer?.classId || !owner || owner.classId !== viewer.classId || publication?.publishedClassId !== owner.classId) return null;
  const d = database();
  return { name: owner.name,
    plots: d.prepare("SELECT plot,cropId,stage FROM manor_plots WHERE userId=? ORDER BY plot").all(ownerId),
    decorations: d.prepare(`SELECT i.partId,l.slotId FROM manor_scene_layout l JOIN manor_items i ON i.id=l.itemId AND i.userId=l.studentId WHERE l.studentId=?`).all(ownerId),
  };
}

export function mutateManorScene(studentId: string, input: ManorSceneCommand) {
  const d = database(), user = identity(studentId);
  if (!user) return { ok: false as const, code: "FORBIDDEN" };
  const actionKey = `scene-v7:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
  const fail = (code: string) => { d.exec("ROLLBACK"); return { ok: false as const, code }; };
  d.exec("BEGIN IMMEDIATE");
  try {
    const old = d.prepare("SELECT actionKey,resultJson FROM manor_operations WHERE userId=? AND operationId=?").get(studentId, input.operationId) as { actionKey: string; resultJson: string } | undefined;
    if (old) { d.exec("ROLLBACK"); return old.actionKey === actionKey ? { ok: true as const, response: { ...JSON.parse(old.resultJson), scene: manorSceneSnapshot(studentId) } } : { ok: false as const, code: "OPERATION_CONFLICT" }; }
    d.prepare("INSERT OR IGNORE INTO manor_scene_profiles(studentId) VALUES (?)").run(studentId);
    const p = profile(studentId)!;
    let itemId: string | undefined;
    if (input.action === "purchase") {
      const part = MANOR_PARTS.find((part) => part.id === input.partId);
      if (!part) return fail("PART_NOT_FOUND");
      const entry = manorSceneSnapshot(studentId).catalog.find((item) => item.id === part.id)!;
      if (!entry.eligible) return fail("BADGE_REQUIREMENT");
      if (pointsBalance(studentId) < part.price) return fail("INSUFFICIENT_POINTS");
      itemId = `mi_${randomUUID()}`;
      d.prepare("INSERT INTO points_ledger(id,userId,kind,delta,reason,eventKey,createdAt) VALUES(?,?,?,?,?,?,?)")
        .run(`pt_${randomUUID()}`, studentId, "manor_decoration", -part.price, `兑换「${part.name}」`, `decoration:${studentId}:${input.operationId}`, Date.now());
      d.prepare("INSERT INTO manor_items(id,userId,partId,x,y,acquiredAt) VALUES(?,?,?,NULL,NULL,?)").run(itemId, studentId, part.id, Date.now());
    } else if (input.action === "layout") {
      if (p.layoutRevision !== input.expectedRevision) return fail("LAYOUT_REVISION_CONFLICT");
      const item = d.prepare("SELECT id FROM manor_items WHERE id=? AND userId=?").get(input.itemId, studentId);
      if (!item) return fail("ITEM_NOT_FOUND");
      if (input.slotId !== null && !MANOR_LAYOUT_SLOTS.some((slot) => slot.id === input.slotId)) return fail("INVALID_INPUT");
      if (input.slotId && d.prepare("SELECT 1 FROM manor_scene_layout WHERE studentId=? AND slotId=? AND itemId<>?").get(studentId, input.slotId, input.itemId)) return fail("SLOT_OCCUPIED");
      if (input.slotId === null) d.prepare("DELETE FROM manor_scene_layout WHERE itemId=? AND studentId=?").run(input.itemId, studentId);
      else d.prepare(`INSERT INTO manor_scene_layout(itemId,studentId,slotId,updatedAt) VALUES(?,?,?,?)
        ON CONFLICT(itemId) DO UPDATE SET slotId=excluded.slotId,updatedAt=excluded.updatedAt`).run(input.itemId, studentId, input.slotId, Date.now());
      d.prepare("UPDATE manor_scene_profiles SET layoutRevision=layoutRevision+1 WHERE studentId=?").run(studentId);
    } else {
      const currentUser = identity(studentId);
      if (p.publicationRevision !== input.expectedRevision) return fail("PUBLICATION_REVISION_CONFLICT");
      if (input.enabled && !currentUser?.classId) return fail("CLASS_REQUIRED");
      if (input.enabled && currentUser?.classId !== input.expectedClassId) return fail("CLASS_CHANGED");
      d.prepare("UPDATE manor_scene_profiles SET publishedClassId=?,publicationRevision=publicationRevision+1 WHERE studentId=?").run(input.enabled ? currentUser!.classId : null, studentId);
    }
    const correlationId = `corr_${randomUUID()}`;
    d.prepare("UPDATE manor_profiles SET stateVersion=stateVersion+1,updatedAt=? WHERE studentId=?").run(Date.now(), studentId);
    const version = d.prepare("SELECT stateVersion FROM manor_profiles WHERE studentId=?").get(studentId) as { stateVersion: number } | undefined;
    if (version) d.prepare("INSERT INTO manor_domain_events(eventId,studentId,sequence,correlationId,eventType,entityType,entityId,payloadJson,createdAt) VALUES(?,?,?,?,?,?,?,?,?)").run(`evt_${randomUUID()}`, studentId, version.stateVersion, correlationId, `scene.${input.action}`, "scene", studentId, JSON.stringify({ ...input, itemId: itemId ?? ("itemId" in input ? input.itemId : undefined) }), Date.now());
    const response = { ok: true, correlationId, operationId: input.operationId, stateVersion: version?.stateVersion ?? 0, itemId, scene: manorSceneSnapshot(studentId) };
    const receipt = { ...response, scene: { ...response.scene, neighbors: [] } };
    d.prepare("INSERT INTO manor_operations(userId,operationId,actionKey,resultJson,createdAt) VALUES(?,?,?,?,?)").run(studentId, input.operationId, actionKey, JSON.stringify(receipt), Date.now());
    d.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { d.exec("ROLLBACK"); throw error; }
}

export function readManorScenePolicy(teacherId: string) {
  const d = database();
  const teacher = d.prepare("SELECT classId FROM users WHERE id=? AND role='teacher'").get(teacherId) as { classId: string } | undefined;
  if (!teacher?.classId) return null;
  const row = d.prepare("SELECT unlockedCount,revision,updatedAt FROM manor_scene_policies WHERE classId=?").get(teacher.classId) as { unlockedCount: number; revision: number; updatedAt: number } | undefined;
  return { ownerId: teacherId, classId: teacher.classId, unlockedCount: row?.unlockedCount ?? 10, revision: row?.revision ?? 0, updatedAt: row?.updatedAt ?? null };
}
export function publishManorScenePolicy(teacherId: string, input: { operationId: string; classId: string; expectedRevision: number; unlockedCount: number }) {
  const d = database(), policy = readManorScenePolicy(teacherId);
  if (!policy || policy.classId !== input.classId) return { ok: false as const, code: "FORBIDDEN" };
  const actionKey = `scene-policy:${JSON.stringify(input)}`;
  d.exec("BEGIN IMMEDIATE");
  try {
    const old = d.prepare("SELECT actionKey,resultJson FROM manor_operations WHERE userId=? AND operationId=?").get(teacherId, input.operationId) as { actionKey: string; resultJson: string } | undefined;
    if (old) { d.exec("ROLLBACK"); return old.actionKey === actionKey ? { ok: true as const, response: { ...JSON.parse(old.resultJson), policy: readManorScenePolicy(teacherId) } } : { ok: false as const, code: "OPERATION_CONFLICT" }; }
    const current = readManorScenePolicy(teacherId)!;
    if (current.revision !== input.expectedRevision || input.unlockedCount < current.unlockedCount || input.unlockedCount > 24 || !Number.isInteger(input.unlockedCount)) {
      d.exec("ROLLBACK"); return { ok: false as const, code: "POLICY_REVISION_CONFLICT" };
    }
    d.prepare(`INSERT INTO manor_scene_policies(classId,unlockedCount,revision,updatedBy,updatedAt) VALUES(?,?,?,?,?)
      ON CONFLICT(classId) DO UPDATE SET unlockedCount=excluded.unlockedCount,revision=excluded.revision,updatedBy=excluded.updatedBy,updatedAt=excluded.updatedAt`).run(current.classId, input.unlockedCount, current.revision + 1, teacherId, Date.now());
    const response = { ok: true, policy: readManorScenePolicy(teacherId) };
    d.prepare("INSERT INTO manor_operations(userId,operationId,actionKey,resultJson,createdAt) VALUES(?,?,?,?,?)").run(teacherId, input.operationId, actionKey, JSON.stringify(response), Date.now());
    d.exec("COMMIT"); return { ok: true as const, response };
  } catch (error) { d.exec("ROLLBACK"); throw error; }
}
