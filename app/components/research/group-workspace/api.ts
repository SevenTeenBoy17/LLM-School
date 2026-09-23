import { BOT_SHAPES, type GroupIndex, type GroupSnapshot, type GroupSummary, type GroupTask } from "@/lib/research-groups";

export class GroupRequestError extends Error {
  constructor(message: string, public code = "REQUEST_FAILED", public status = 0, public uncertain = false) {
    super(message);
    this.name = "GroupRequestError";
  }
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const id = (value: unknown): value is string => text(value) && !!value.trim() && value.length <= 256;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const unique = (values: string[]) => new Set(values).size === values.length;

function summary(value: unknown): value is GroupSummary {
  return record(value) && id(value.id) && id(value.ownerId) && text(value.name) && !!value.name.trim()
    && text(value.subject) && count(value.memberCount) && timestamp(value.updatedAt);
}

function task(value: unknown): value is GroupTask {
  if (!record(value) || !id(value.id) || !id(value.groupId) || !id(value.assigneeId) || !text(value.title)
    || !text(value.dueDate) || !count(value.revision) || !timestamp(value.updatedAt) || !id(value.updatedBy)
    || !Array.isArray(value.items) || !count(value.completed) || !count(value.total)) return false;
  if (!value.items.every((item: unknown) => record(item) && id(item.id) && text(item.text) && typeof item.done === "boolean")) return false;
  const items = value.items as GroupTask["items"];
  return unique(items.map((item) => item.id)) && value.total === items.length
    && value.completed === items.filter((item) => item.done).length;
}

export function isGroupIndex(value: unknown): value is GroupIndex {
  return record(value) && Array.isArray(value.groups) && value.groups.every(summary)
    && unique(value.groups.map((group) => group.id)) && timestamp(value.syncedAt)
    && record(value.viewer) && id(value.viewer.id) && text(value.viewer.name) && typeof value.viewer.readOnly === "boolean";
}

export function isGroupSnapshot(value: unknown): value is GroupSnapshot {
  if (!record(value) || !summary(value.group) || !Array.isArray(value.members) || !Array.isArray(value.tasks)
    || !timestamp(value.syncedAt) || !(value.inviteCode === null || text(value.inviteCode))
    || !record(value.viewer) || !id(value.viewer.id) || typeof value.viewer.readOnly !== "boolean"
    || typeof value.viewer.isOwner !== "boolean") return false;
  if (!value.members.every((member: unknown) => record(member) && id(member.userId) && text(member.name)
    && text(member.department) && BOT_SHAPES.includes(member.bot as typeof BOT_SHAPES[number])
    && timestamp(member.joinedAt) && typeof member.isOwner === "boolean")) return false;
  const members = value.members as GroupSnapshot["members"];
  const group = value.group;
  const viewer = value.viewer;
  if (!unique(members.map((member) => member.userId)) || !members.some((member) => member.userId === viewer.id)
    || group.memberCount !== members.length
    || members.some((member) => member.isOwner !== (member.userId === group.ownerId))
    || viewer.isOwner !== (viewer.id === group.ownerId) || (!viewer.isOwner && value.inviteCode !== null)) return false;
  if (!value.tasks.every(task)) return false;
  const tasks = value.tasks as GroupTask[];
  return unique(tasks.map((entry) => entry.id)) && tasks.every((entry) => entry.groupId === group.id);
}

export function assertViewer(value: GroupIndex | GroupSnapshot, expectedUser: string) {
  if (value.viewer.id !== expectedUser) throw new GroupRequestError("身份与当前工作区不一致，请刷新页面后重新进入。", "IDENTITY_CHANGED", 401);
}

export async function requestGroup<T>(path: string, validate: (value: unknown) => value is T, signal: AbortSignal, body?: object): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 30_000);
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    let value: unknown;
    try { value = await response.json(); } catch { value = undefined; }
    if (!response.ok) {
      const error = record(value) && record(value.error) ? value.error : null;
      throw new GroupRequestError(error && text(error.message) ? error.message : `请求未完成（${response.status}），请重试。`,
        error && text(error.code) ? error.code : "REQUEST_FAILED", response.status,
        !!body && (response.status >= 500 || response.status === 408));
    }
    if (!validate(value)) throw new GroupRequestError("服务器返回的数据无法确认，请重新同步后核对。", "INVALID_RESPONSE", response.status, !!body);
    return value;
  } catch (error) {
    if (error instanceof GroupRequestError) throw error;
    throw new GroupRequestError(controller.signal.aborted ? "请求已中断或超过 30 秒，请重新同步核对。" : "暂时无法连接服务器，请检查网络后重试。", "CONNECTION_FAILED", 0, !!body);
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

export const isLeaveResult = (value: unknown): value is { left: true } => record(value) && value.left === true;

export type GroupMutation =
  | { kind: "create"; name: string; subject: string }
  | { kind: "join"; inviteCode: string }
  | { kind: "action"; action: "create-task"; title: string; assigneeId: string; dueDate: string; items: string[] }
  | { kind: "action"; action: "update-task"; taskId: string; revision: number; doneIds: string[] }
  | { kind: "action"; action: "rotate-invite" }
  | { kind: "action"; action: "leave" };

export type MutationResult = { ok: true } | { ok: false; message: string; conflict?: boolean; uncertain?: boolean };
