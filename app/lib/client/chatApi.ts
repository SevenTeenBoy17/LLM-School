// 客户端对话 API 封装（Phase B）。服务端为权威，前端仅做展现 + 乐观交互。
import type { ChatMessage, ModelProvider } from "@/lib/types";

export type Sentiment = "up" | "down";
export type FavoriteKind = "session" | "prompt" | "message" | "agent";

export interface SessionSummary {
  id: string;
  title: string;
  modelId: string;
  updatedAt: number;
  pinned: boolean;
  agentId?: string;
  preview?: string;
}

interface ServerMessage {
  id: string; sessionId: string; role: "user" | "assistant"; content: string; modelId: string; createdAt: number;
  source?: ChatMessage["source"]; durationMs?: number;
}

function sessionUrl(id: string): string {
  return `/api/chat/sessions?id=${encodeURIComponent(id)}`;
}

// 服务端消息 → 前端 ChatMessage（createdAt→timestamp；空 modelId 归 undefined）。
function toChatMessage(m: ServerMessage): ChatMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    modelId: m.modelId ? (m.modelId as ModelProvider) : undefined,
    source: m.source,
    timestamp: m.createdAt,
    durationMs: m.durationMs,
  };
}

export async function apiListSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/chat/sessions", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { sessions: SessionSummary[] };
  return data.sessions ?? [];
}

export async function apiCreateSession(modelId: string, title?: string, agentId?: string): Promise<SessionSummary | null> {
  const res = await fetch("/api/chat/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId, title, agentId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { session: SessionSummary };
  return data.session;
}

export interface LoadedSession {
  session: SessionSummary;
  messages: ChatMessage[];
  feedback: Record<string, Sentiment>;
  favorites: string[];
}

export async function apiGetSession(id: string): Promise<LoadedSession | null> {
  const res = await fetch(sessionUrl(id), { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    session: SessionSummary; messages: ServerMessage[]; feedback?: Record<string, Sentiment>; favorites?: string[];
  };
  return {
    session: data.session,
    messages: (data.messages ?? []).map(toChatMessage),
    feedback: data.feedback ?? {},
    favorites: data.favorites ?? [],
  };
}

export async function apiDeleteSession(id: string): Promise<boolean> {
  const res = await fetch(sessionUrl(id), { method: "DELETE" });
  return res.ok;
}

export async function apiPatchSession(id: string, patch: { title?: string; pinned?: boolean }): Promise<SessionSummary | null> {
  const res = await fetch(sessionUrl(id), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { session: SessionSummary };
  return data.session;
}

export async function apiSetFavorite(kind: FavoriteKind, refId: string, on: boolean, meta?: string): Promise<boolean> {
  const res = await fetch("/api/favorites", {
    method: on ? "POST" : "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(on ? { kind, refId, meta } : { kind, refId }),
  });
  return res.ok;
}

export async function apiSetFeedback(messageId: string, sentiment: Sentiment | null): Promise<boolean> {
  const res = await fetch("/api/chat/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messageId, sentiment }),
  });
  return res.ok;
}
