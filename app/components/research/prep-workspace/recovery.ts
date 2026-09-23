import { PREP_LIMITS, validProjects, type PrepProject } from "./model";

export interface UnsubmittedText { comment: string; replies: Record<string, string>; reasons: Record<string, string> }
export interface PrepBackup { format: "prep-draft-backup/v1"; exportedAt: number; saved: PrepProject; draft: PrepProject; unsubmitted: UnsubmittedText }
export const MAX_BACKUP_BYTES = 16000000;
export function hasUnsubmitted(text: UnsubmittedText) { return !!text.comment.length || Object.values(text.replies).some(x => x.length > 0) || Object.values(text.reasons).some(x => x.length > 0); }
export function makePrepBackup(saved: PrepProject, draft: PrepProject, unsubmitted: UnsubmittedText): PrepBackup {
  return structuredClone({ format: "prep-draft-backup/v1" as const, exportedAt: Date.now(), saved, draft, unsubmitted });
}
export function validPrepBackup(value: unknown): value is PrepBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const b = value as PrepBackup;
  if (b.format !== "prep-draft-backup/v1" || !Number.isFinite(b.exportedAt) || !validProjects([b.saved], false) || !validProjects([b.draft], false) || b.saved.id !== b.draft.id) return false;
  if (!b.unsubmitted || typeof b.unsubmitted !== "object" || typeof b.unsubmitted.comment !== "string" || b.unsubmitted.comment.length > 2000) return false;
  const discussionIds = new Set(b.draft.discussions.map(d => d.id));
  const textMap = (value: unknown) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= PREP_LIMITS.discussions && Object.entries(value).every(([id, text]) => discussionIds.has(id) && typeof text === "string" && text.length <= 2000);
  return textMap(b.unsubmitted.replies) && textMap(b.unsubmitted.reasons);
}
