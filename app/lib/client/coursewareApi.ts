import type { CoursewareBrief, CoursewarePlan, CoursewareQualityReport } from "@/lib/courseware/core";
import type { SlideVisualStatus } from "@/lib/courseware/visual";

export interface ClientCoursewareDeck {
  id: string;
  ownerId: string;
  title: string;
  subject: string;
  grade: string;
  status: "draft" | "reviewed";
  generationSource: "remote" | "local" | "local-fallback";
  sourceUploadIds: string[];
  sourceFiles: string[];
  plan: CoursewarePlan;
  quality: CoursewareQualityReport;
  stateVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface ClientCoursewareResult {
  operationId: string;
  stateVersion: number;
  status: "succeeded";
  authoritativeEntity: ClientCoursewareDeck;
  nextActions: string[];
  duplicate?: boolean;
}

type ErrorBody = {
  error?: { code?: string; message?: string } | string;
  authoritativeEntity?: ClientCoursewareDeck;
  stateVersion?: number;
};

export class CoursewareApiError extends Error {
  status: number;
  code: string;
  body: ErrorBody;
  constructor(status: number, body: ErrorBody) {
    const error = body.error;
    const message = typeof error === "string" ? error : error?.message;
    super(message || `HTTP ${status}`);
    this.status = status;
    this.code = typeof error === "string" ? error : error?.code || "UNKNOWN_ERROR";
    this.body = body;
  }
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & ErrorBody;
  if (!response.ok) throw new CoursewareApiError(response.status, body);
  return body;
}

export async function apiListCourseware(): Promise<ClientCoursewareDeck[]> {
  const body = await json<{ items?: ClientCoursewareDeck[] }>(await fetch("/api/courseware", { cache: "no-store" }));
  return body.items ?? [];
}

export async function apiGetCourseware(id: string): Promise<ClientCoursewareDeck> {
  const body = await json<{ deck: ClientCoursewareDeck }>(await fetch(`/api/courseware/${encodeURIComponent(id)}`, { cache: "no-store" }));
  return body.deck;
}

export async function apiPlanCourseware(input: CoursewareBrief): Promise<ClientCoursewareResult> {
  return json<ClientCoursewareResult>(await fetch("/api/courseware/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }));
}

export async function apiSaveCourseware(deck: ClientCoursewareDeck, operationId: string): Promise<ClientCoursewareResult> {
  return json<ClientCoursewareResult>(await fetch(`/api/courseware/${encodeURIComponent(deck.id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operationId, stateVersion: deck.stateVersion, plan: deck.plan }),
  }));
}

export interface UploadedCoursewareSource { id: string; name: string; chars: number }

export async function apiUploadCoursewareSource(file: File): Promise<UploadedCoursewareSource> {
  const form = new FormData();
  form.append("file", file);
  return json<UploadedCoursewareSource>(await fetch("/api/upload", { method: "POST", body: form }));
}

function filenameFromDisposition(value: string | null): string {
  const encoded = value?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try { return decodeURIComponent(encoded); } catch { /* use fallback */ }
  }
  return "EduAI-课件.pptx";
}

export async function apiDownloadCourseware(id: string, mode: "editable" | "visual" = "editable"): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(`/api/courseware/${encodeURIComponent(id)}/download?mode=${mode}`, { cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ErrorBody;
    throw new CoursewareApiError(response.status, body);
  }
  return { blob: await response.blob(), fileName: filenameFromDisposition(response.headers.get("content-disposition")) };
}

export async function apiCoursewareVisuals(id: string): Promise<SlideVisualStatus[]> {
  const body = await json<{ items: SlideVisualStatus[] }>(await fetch(`/api/courseware/${encodeURIComponent(id)}/visuals`, { cache: "no-store" }));
  return body.items;
}
export async function apiGenerateCoursewareVisual(id: string, slideId: string, stateVersion: number): Promise<SlideVisualStatus[]> {
  const body = await json<{ items: SlideVisualStatus[] }>(await fetch(`/api/courseware/${encodeURIComponent(id)}/visuals/${encodeURIComponent(slideId)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stateVersion }),
  }));
  return body.items;
}
