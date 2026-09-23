import { samePrepContent, type PrepProject } from "./model";
import { hasUnsubmitted, type UnsubmittedText } from "./recovery";

export interface PrepDraftBuffer { saved: PrepProject; draft: PrepProject; unsubmitted: UnsubmittedText }
export type PrepCreationDraft = Pick<PrepProject, "title" | "grade" | "subject" | "kind" | "question" | "conditions" | "members">;
export const EMPTY_CREATION: PrepCreationDraft = { title: "", grade: "", subject: "", kind: "日常共备", question: "", conditions: "", members: "" };

// Module memory survives SPA unmounts only. It is never a storage or API payload.
const projectBuffers = new Map<string, PrepDraftBuffer>();
const creationBuffers = new Map<string, PrepCreationDraft>();
const projectKey = (owner: string, id: string) => JSON.stringify([owner, id]);
const sameBaseline = (a: PrepProject, b: PrepProject) => JSON.stringify(a) === JSON.stringify(b);

export function readPrepBuffer(owner: string | null, saved: PrepProject): PrepDraftBuffer | undefined {
  if (!owner) return;
  const buffer = projectBuffers.get(projectKey(owner, saved.id));
  return buffer && sameBaseline(buffer.saved, saved) ? structuredClone(buffer) : undefined;
}
export function writePrepBuffer(owner: string | null, buffer: PrepDraftBuffer) {
  if (!owner || buffer.saved.id !== buffer.draft.id) return;
  const key = projectKey(owner, buffer.saved.id);
  if (samePrepContent(buffer.saved, buffer.draft) && !hasUnsubmitted(buffer.unsubmitted)) {
    const previous = projectBuffers.get(key);
    if (previous && sameBaseline(previous.saved, buffer.saved)) projectBuffers.delete(key);
    return;
  }
  projectBuffers.set(key, structuredClone(buffer));
}
export function clearPrepBuffer(owner: string | null, projectId: string) {
  if (owner) projectBuffers.delete(projectKey(owner, projectId));
}

export function readCreationBuffer(owner: string | null): PrepCreationDraft | undefined {
  const draft = owner ? creationBuffers.get(owner) : undefined;
  return draft ? structuredClone(draft) : undefined;
}
export function writeCreationBuffer(owner: string | null, draft: PrepCreationDraft) {
  if (!owner) return;
  if (!draft.title && !draft.grade && !draft.subject && !draft.question && !draft.conditions && !draft.members && draft.kind === "日常共备") creationBuffers.delete(owner);
  else creationBuffers.set(owner, structuredClone(draft));
}
export function clearCreationBuffer(owner: string | null) { if (owner) creationBuffers.delete(owner); }
