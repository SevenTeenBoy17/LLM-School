// 客户端封装：提示词 / 智能体 CRUD（Phase C）。服务端为权威。
import type { PromptItem, AgentItem } from "@/lib/types";

export type ClientPrompt = PromptItem & { ownerId?: string; status?: "pub" | "draft" };
export type ClientAgent = AgentItem & { ownerId?: string };

export interface PromptInput {
  title: string; category: PromptItem["category"]; scene: string; role: string;
  recommendedModel: PromptItem["recommendedModel"]; level: PromptItem["level"];
  description: string; body?: string; icon?: string; gradient?: string;
  outputExample?: string;
  status?: "pub" | "draft";
  variables?: PromptItem["variables"];
}
export interface AgentInput {
  name: string; category: AgentItem["category"]; description: string;
  recommendedModel: AgentItem["recommendedModel"]; knowledgeBase?: string;
  capabilities?: string[]; icon?: string; gradient?: string;
  systemPrompt?: string;
}

// ── Prompts ──
export async function apiListPrompts(): Promise<{ prompts: ClientPrompt[]; favorites: string[]; userId: string }> {
  const res = await fetch("/api/prompts", { cache: "no-store" });
  if (!res.ok) return { prompts: [], favorites: [], userId: "" };
  return (await res.json()) as { prompts: ClientPrompt[]; favorites: string[]; userId: string };
}
export async function apiGetPrompt(id: string, use = false): Promise<ClientPrompt | null> {
  const res = await fetch(`/api/prompts/${encodeURIComponent(id)}`, use
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "use" }) }
    : { cache: "no-store" });
  if (!res.ok) return null;
  return ((await res.json()) as { prompt: ClientPrompt }).prompt;
}
export async function apiCreatePrompt(input: PromptInput): Promise<ClientPrompt | null> {
  const res = await fetch("/api/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!res.ok) return null;
  return ((await res.json()) as { prompt: ClientPrompt }).prompt;
}
export async function apiUpdatePrompt(id: string, patch: Partial<PromptInput>): Promise<ClientPrompt | null> {
  const res = await fetch(`/api/prompts/${encodeURIComponent(id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  if (!res.ok) return null;
  return ((await res.json()) as { prompt: ClientPrompt }).prompt;
}
export async function apiDeletePrompt(id: string): Promise<boolean> {
  const res = await fetch(`/api/prompts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return res.ok;
}

// ── Agents ──
export async function apiListAgents(): Promise<{ agents: ClientAgent[]; favorites: string[]; userId: string }> {
  const res = await fetch("/api/agents", { cache: "no-store" });
  if (!res.ok) return { agents: [], favorites: [], userId: "" };
  return (await res.json()) as { agents: ClientAgent[]; favorites: string[]; userId: string };
}
export async function apiGetAgent(id: string, use = false, signal?: AbortSignal): Promise<ClientAgent | null> {
  const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, use
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "use" }) }
    : { cache: "no-store", signal });
  if (!res.ok) return null;
  return ((await res.json()) as { agent: ClientAgent }).agent;
}
export async function apiCreateAgent(input: AgentInput, signal?: AbortSignal): Promise<ClientAgent | null> {
  const res = await fetch("/api/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal });
  if (res.status >= 500 || res.status === 408) throw new Error("agent_create_unconfirmed");
  if (!res.ok) return null;
  const data = await res.json() as { agent?: ClientAgent } | null;
  if (!data?.agent || typeof data.agent.id !== "string" || !data.agent.id.trim()) throw new Error("agent_create_unconfirmed");
  return data.agent;
}
export class AgentUpdateError extends Error {
  constructor(public status: number) { super(`agent_update_${status}`); }
}

export async function apiUpdateAgent(id: string, patch: Partial<AgentInput>): Promise<ClientAgent | null> {
  const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  if (!res.ok) throw new AgentUpdateError(res.status);
  return ((await res.json()) as { agent: ClientAgent }).agent;
}
export async function apiDeleteAgent(id: string): Promise<boolean> {
  const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.ok;
}
export async function apiSetAgentStatus(id: string, status: AgentItem["status"]): Promise<ClientAgent | null> {
  const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) return null;
  return ((await res.json()) as { agent: ClientAgent }).agent;
}
