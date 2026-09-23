import "server-only";
import { randomInt, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { researchGroupsDatabase } from "./db";
import type { SessionUser } from "./session";
import { BOT_SHAPES, type GroupIndex, type GroupMember, type GroupSnapshot, type GroupSummary, type GroupTask } from "../research-groups";

export class GroupError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const text = (max: number) => z.string().trim().min(1).max(max).refine(s => !/[\u0000-\u001f\u007f]/.test(s));
const id = z.string().uuid();
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(`${s}T12:00:00Z`); return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s; })]);
export const CreateGroupSchema = z.object({ name: text(60), subject: text(40) }).strict();
export const JoinGroupSchema = z.object({ inviteCode: z.string().trim().regex(/^[a-f0-9]{48}$/) }).strict();
export const GroupActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-task"), title: text(160), assigneeId: z.string().min(1).max(100), dueDate: date, items: z.array(text(240)).min(1).max(16) }).strict(),
  z.object({ action: z.literal("update-task"), taskId: id, revision: z.number().int().positive(), doneIds: z.array(id).max(16) }).strict(),
  z.object({ action: z.literal("rotate-invite") }).strict(),
  z.object({ action: z.literal("leave") }).strict(),
]);
export const canUseGroups = (role: string) => ["teacher", "researcher", "admin", "college-admin"].includes(role);
type StoredGroup = { id: string; name: string; subject: string; ownerId: string; inviteCode: string; updatedAt: number };
type StoredTask = Omit<GroupTask, "items" | "completed" | "total"> & { itemsJson: string };
let initialized = false;
function database() {
  const d = researchGroupsDatabase();
  if (!initialized) {
    // Additive, isolated domain tables. Existing users and teaching data are never migrated.
    d.exec(`
      CREATE TABLE IF NOT EXISTS rg_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, ownerId TEXT NOT NULL REFERENCES users(id), inviteCode TEXT NOT NULL UNIQUE, updatedAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rg_members (groupId TEXT NOT NULL REFERENCES rg_groups(id), userId TEXT NOT NULL REFERENCES users(id), bot TEXT NOT NULL, joinedAt INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(groupId,userId));
      CREATE INDEX IF NOT EXISTS rg_members_user ON rg_members(userId,active);
      CREATE TABLE IF NOT EXISTS rg_tasks (id TEXT PRIMARY KEY, groupId TEXT NOT NULL REFERENCES rg_groups(id), assigneeId TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, dueDate TEXT NOT NULL, itemsJson TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updatedAt INTEGER NOT NULL, updatedBy TEXT NOT NULL REFERENCES users(id));
      CREATE INDEX IF NOT EXISTS rg_tasks_group ON rg_tasks(groupId);
    `);
    initialized = true;
  }
  return d;
}
function transaction<T>(action: () => T, write = true): T {
  const d = database(); d.exec(write ? "BEGIN IMMEDIATE" : "BEGIN");
  try { const result = action(); d.exec("COMMIT"); return result; }
  catch (error) { d.exec("ROLLBACK"); throw error; }
}
function assertUser(user: SessionUser) {
  if (!canUseGroups(user.role)) throw new GroupError(403, "FORBIDDEN", "当前账号不能访问教师教研组。");
}
function authorizedGroup(user: SessionUser, groupId: string): StoredGroup {
  assertUser(user);
  if (!id.safeParse(groupId).success) throw new GroupError(404, "NOT_FOUND", "教研组不存在或你已不在该组。");
  const g = database().prepare("SELECT g.* FROM rg_groups g JOIN rg_members m ON m.groupId=g.id WHERE g.id=? AND m.userId=? AND m.active=1").get(groupId, user.id) as StoredGroup | undefined;
  if (!g) throw new GroupError(404, "NOT_FOUND", "教研组不存在或你已不在该组。");
  return g;
}
function activeMembers(groupId: string): GroupMember[] {
  return database().prepare(`SELECT m.userId,u.name,u.department,m.bot,m.joinedAt,CASE WHEN g.ownerId=m.userId THEN 1 ELSE 0 END AS isOwner
    FROM rg_members m JOIN users u ON u.id=m.userId JOIN rg_groups g ON g.id=m.groupId
    WHERE m.groupId=? AND m.active=1 AND u.role IN ('teacher','researcher','admin','college-admin') ORDER BY isOwner DESC,m.joinedAt,m.userId`).all(groupId).map(row => ({ ...row, isOwner: !!row.isOwner })) as GroupMember[];
}
function summary(g: StoredGroup): GroupSummary {
  return { id: g.id, name: g.name, subject: g.subject, ownerId: g.ownerId, memberCount: activeMembers(g.id).length, updatedAt: g.updatedAt };
}
function taskDto(row: StoredTask): GroupTask {
  const items = JSON.parse(row.itemsJson) as GroupTask["items"];
  const { itemsJson: _stored, ...rest } = row;
  void _stored;
  return { ...rest, items, completed: items.filter(i => i.done).length, total: items.length };
}
export function listGroups(user: SessionUser, readOnly: boolean): GroupIndex {
  assertUser(user);
  return transaction(() => {
    const groups = database().prepare("SELECT g.* FROM rg_groups g JOIN rg_members m ON m.groupId=g.id WHERE m.userId=? AND m.active=1 ORDER BY g.updatedAt DESC,g.id").all(user.id) as StoredGroup[];
    return { groups: groups.map(summary), viewer: { id: user.id, name: user.name, readOnly }, syncedAt: Date.now() };
  }, false);
}
function snapshotInTransaction(user: SessionUser, groupId: string, readOnly: boolean): GroupSnapshot {
    const group = authorizedGroup(user, groupId);
    const members = activeMembers(groupId);
    const tasks = (database().prepare("SELECT * FROM rg_tasks WHERE groupId=? ORDER BY updatedAt DESC,id").all(groupId) as StoredTask[]).map(taskDto);
    return { group: summary(group), members, tasks, inviteCode: group.ownerId === user.id && !readOnly ? group.inviteCode : null, viewer: { id: user.id, readOnly, isOwner: group.ownerId === user.id }, syncedAt: Date.now() };
}
export function getGroup(user: SessionUser, groupId: string, readOnly: boolean): GroupSnapshot {
  // A deferred snapshot allows WAL reads while another connection holds the write lock.
  return transaction(() => snapshotInTransaction(user, groupId, readOnly), false);
}
function memberLimit(user: SessionUser) {
  const n = database().prepare("SELECT COUNT(*) AS n FROM rg_members WHERE userId=? AND active=1").get(user.id) as { n: number };
  if (n.n >= 20) throw new GroupError(409, "GROUP_LIMIT", "当前最多加入 20 个教研组。");
}
function assignBot(groupId: string) {
  const used = new Set(activeMembers(groupId).map(m => m.bot));
  const available = BOT_SHAPES.filter(s => !used.has(s));
  const pool = available.length ? available : BOT_SHAPES;
  return pool[randomInt(pool.length)];
}
export function createGroup(user: SessionUser, input: z.infer<typeof CreateGroupSchema>): GroupSnapshot {
  assertUser(user);
  return transaction(() => {
    memberLimit(user);
    const groupId = randomUUID(), now = Date.now();
    database().prepare("INSERT INTO rg_groups VALUES (?,?,?,?,?,?)").run(groupId, input.name, input.subject, user.id, randomBytes(24).toString("hex"), now);
    database().prepare("INSERT INTO rg_members VALUES (?,?,?,?,1)").run(groupId, user.id, assignBot(groupId), now);
    return snapshotInTransaction(user, groupId, false);
  });
}
export function joinGroup(user: SessionUser, inviteCode: string): GroupSnapshot {
  assertUser(user);
  return transaction(() => {
    const d = database();
    const g = d.prepare("SELECT * FROM rg_groups WHERE inviteCode=?").get(inviteCode) as StoredGroup | undefined;
    if (!g) throw new GroupError(404, "INVITE_INVALID", "邀请码无效或已更新，请向组长获取新邀请码。");
    const previous = d.prepare("SELECT active FROM rg_members WHERE groupId=? AND userId=?").get(g.id, user.id) as { active: number } | undefined;
    if (previous?.active) return snapshotInTransaction(user, g.id, false);
    memberLimit(user);
    if (activeMembers(g.id).length >= 64) throw new GroupError(409, "MEMBER_LIMIT", "教研组最多容纳 64 位教师。");
    if (previous) d.prepare("UPDATE rg_members SET active=1,joinedAt=? WHERE groupId=? AND userId=?").run(Date.now(), g.id, user.id);
    else d.prepare("INSERT INTO rg_members VALUES (?,?,?,?,1)").run(g.id, user.id, assignBot(g.id), Date.now());
    d.prepare("UPDATE rg_groups SET updatedAt=? WHERE id=?").run(Date.now(), g.id);
    return snapshotInTransaction(user, g.id, false);
  });
}
export function changeGroup(user: SessionUser, groupId: string, action: z.infer<typeof GroupActionSchema>): GroupSnapshot | { left: true } {
  return transaction(() => {
    const group = authorizedGroup(user, groupId), d = database(), now = Date.now();
    const owner = group.ownerId === user.id;
    if (action.action === "leave") {
      if (owner) throw new GroupError(409, "OWNER_CANNOT_LEAVE", "组长暂不能退出教研组，请保留组长账号管理现有任务。");
      d.prepare("UPDATE rg_members SET active=0 WHERE groupId=? AND userId=?").run(groupId, user.id);
    } else if (action.action === "rotate-invite") {
      if (!owner) throw new GroupError(403, "OWNER_REQUIRED", "只有组长可以更新邀请码。");
      d.prepare("UPDATE rg_groups SET inviteCode=? WHERE id=?").run(randomBytes(24).toString("hex"), groupId);
    } else if (action.action === "create-task") {
      if (!owner) throw new GroupError(403, "OWNER_REQUIRED", "只有组长可以分配任务。");
      if (!activeMembers(groupId).some(m => m.userId === action.assigneeId)) throw new GroupError(400, "ASSIGNEE_INVALID", "任务负责人必须是当前教研组成员。");
      const count = d.prepare("SELECT COUNT(*) AS n FROM rg_tasks WHERE groupId=?").get(groupId) as { n: number };
      if (count.n >= 200) throw new GroupError(409, "TASK_LIMIT", "当前教研组任务已达 200 项上限。");
      const items = action.items.map(text => ({ id: randomUUID(), text, done: false }));
      d.prepare("INSERT INTO rg_tasks VALUES (?,?,?,?,?,?,1,?,?)").run(randomUUID(), groupId, action.assigneeId, action.title, action.dueDate, JSON.stringify(items), now, user.id);
    } else {
      const task = d.prepare("SELECT * FROM rg_tasks WHERE id=? AND groupId=?").get(action.taskId, groupId) as StoredTask | undefined;
      if (!task) throw new GroupError(404, "TASK_NOT_FOUND", "任务不存在或不属于当前教研组。");
      if (!owner && task.assigneeId !== user.id) throw new GroupError(403, "TASK_FORBIDDEN", "只有负责人或组长可以更新该任务。");
      if (task.revision !== action.revision) throw new GroupError(409, "REVISION_CONFLICT", "该任务已被更新。请刷新后核对最新进度，再提交修改。");
      const current = taskDto(task), done = new Set(action.doneIds);
      if (done.size !== action.doneIds.length || action.doneIds.some(i => !current.items.some(item => item.id === i))) throw new GroupError(400, "INVALID_ITEMS", "检查项与当前任务不一致。");
      const items = current.items.map(i => ({ ...i, done: done.has(i.id) }));
      d.prepare("UPDATE rg_tasks SET itemsJson=?,revision=revision+1,updatedAt=?,updatedBy=? WHERE id=? AND groupId=?").run(JSON.stringify(items), now, user.id, task.id, groupId);
    }
    d.prepare("UPDATE rg_groups SET updatedAt=? WHERE id=?").run(now, groupId);
    // Construct the response before commit; failed reads roll back the mutation too.
    return action.action === "leave" ? { left: true } : snapshotInTransaction(user, groupId, false);
  });
}
