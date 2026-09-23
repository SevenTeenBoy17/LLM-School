export const BOT_SHAPES = ["circle", "cloud", "droplet", "egg", "hexagon", "panda", "pill", "squircle", "triangle"] as const;
export type BotShape = (typeof BOT_SHAPES)[number];
export type GroupSummary = { id: string; name: string; subject: string; ownerId: string; memberCount: number; updatedAt: number };
export type GroupMember = { userId: string; name: string; department: string; bot: BotShape; joinedAt: number; isOwner: boolean };
export type GroupTask = { id: string; groupId: string; assigneeId: string; title: string; dueDate: string; items: { id: string; text: string; done: boolean }[]; revision: number; updatedAt: number; updatedBy: string; completed: number; total: number };
export type GroupSnapshot = { group: GroupSummary; members: GroupMember[]; tasks: GroupTask[]; inviteCode: string | null; viewer: { id: string; readOnly: boolean; isOwner: boolean }; syncedAt: number };
export type GroupIndex = { groups: GroupSummary[]; viewer: { id: string; name: string; readOnly: boolean }; syncedAt: number };
export function groupProgress(tasks: GroupTask[]) {
  const completed = tasks.reduce((n, t) => n + t.completed, 0);
  const total = tasks.reduce((n, t) => n + t.total, 0);
  return { completed, total, percent: total ? Math.round(completed * 100 / total) : 0 };
}
