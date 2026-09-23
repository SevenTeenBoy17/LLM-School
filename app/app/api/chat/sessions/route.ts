import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import {
  createSession,
  deleteSession,
  getSession,
  listMessages,
  listSessions,
  renameSession,
  sessionInteractions,
  setSessionPinned,
} from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { resolveUsableAgent } from "@/lib/server/agentContract";
import { isModelId } from "@/lib/data/models";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

// 会话归属 = 当前登录用户；列表/新建都以 user.id 为唯一边界（服务端 RBAC，绕过前端无效）。
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const session = getSession(user.id, id);
    if (!session) return jsonNoStore({ error: "not_found" }, { status: 404 });
    const interactions = sessionInteractions(user.id, session.id);
    return jsonNoStore({ session, messages: listMessages(session.id), ...interactions });
  }
  return jsonNoStore({ sessions: listSessions(user.id) });
}

const PostBody = z.object({
  title: z.string().max(60).optional(),
  modelId: z.string().max(64).optional(),
  agentId: z.string().max(80).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`sessions:${user.id}`, 60, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonNoStore({ error: "bad_request" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });
  const modelId = parsed.data.modelId?.trim() ?? "";
  if (modelId && !isModelId(modelId)) {
    return jsonNoStore({ error: "invalid_model" }, { status: 400 });
  }

  const agentId = parsed.data.agentId?.trim() || undefined;
  if (agentId && !resolveUsableAgent(user, agentId)) {
    return jsonNoStore({ error: "agent_not_found" }, { status: 404 });
  }

  const session = createSession(user.id, parsed.data.title ?? "新对话", modelId, agentId);
  return jsonNoStore({ session }, { status: 201 });
}

const PatchBody = z.object({
  title: z.string().min(1).max(60).optional(),
  pinned: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonNoStore({ error: "missing_id" }, { status: 400 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonNoStore({ error: "bad_request" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });

  let session = getSession(user.id, id);
  if (!session) return jsonNoStore({ error: "not_found" }, { status: 404 });
  if (parsed.data.title !== undefined) session = renameSession(user.id, id, parsed.data.title) ?? session;
  if (parsed.data.pinned !== undefined) session = setSessionPinned(user.id, id, parsed.data.pinned) ?? session;
  return jsonNoStore({ session });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonNoStore({ error: "missing_id" }, { status: 400 });
  const ok = deleteSession(user.id, id);
  if (!ok) return jsonNoStore({ error: "not_found" }, { status: 404 });
  return jsonNoStore({ ok: true });
}
