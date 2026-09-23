"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { ResearchProject } from "@/lib/paper/workspace";

// Tab-memory only. Never persisted to browser storage or shared between identities.
let draft: { owner: string; project: ResearchProject; exported: string } | undefined;
const subscribe = () => () => {};
const warnUnsaved = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
export function clearPaperDraft() {
  draft = undefined;
  window.removeEventListener("beforeunload", warnUnsaved);
}
export function PaperDraftSession({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return ready ? children : null;
}
export function readPaperDraft(owner: string) {
  if (draft?.owner !== owner) clearPaperDraft();
  return draft;
}
export function retainPaperDraft(owner: string, project: ResearchProject, exported: string, dirty: boolean) {
  draft = { owner, project, exported };
  // The warning follows the cached draft even after its page unmounts.
  window.removeEventListener("beforeunload", warnUnsaved);
  if (dirty) window.addEventListener("beforeunload", warnUnsaved);
}
