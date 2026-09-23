import { NextResponse } from "next/server";
import { z } from "zod";
import { GRADIENT_KEYS } from "@/lib/data/gradientKeys";
import { getSessionUser } from "@/lib/server/session";
import { listAgents, createAgent, listFavorites } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

// GET /api/agents —— 全部智能体 + 当前用户已收藏 id。
// 治理：停用(disabled)的智能体只对创建者/管理员可见（其他人列表里不出现，无法「开始使用」）。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  const agents = listAgents().filter((a) => isAdmin || a.ownerId === user.id || a.status === "pub");
  const favorites = listFavorites(user.id, "agent").map((f) => f.refId);
  return jsonNoStore({ agents, favorites, userId: user.id });
}

const MODEL = z.enum(["chatgpt", "claude", "gpt-image", "gemini", "minimax", "deepseek", "glm"]);
const CATEGORY = z.enum(["教学", "科研", "行政", "学习"]);

const PostBody = z.object({
  name: z.string().min(1).max(40),
  category: CATEGORY,
  description: z.string().min(1).max(400),
  systemPrompt: z.string().max(6000).optional(),
  recommendedModel: MODEL,
  knowledgeBase: z.string().max(60).optional().default(""),
  capabilities: z.array(z.string().max(20)).max(12).optional(),
  icon: z.string().max(40).optional(),
  // V0：由 z.string().max(120) 收成枚举——旧写法允许任意 CSS 直接进 style={{ backgroundImage }}，
  // 既是样式注入面，也让数据层渐变躲过源码色彩守卫（方案 §4.2.1）。
  gradient: z.enum(GRADIENT_KEYS).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`agents:${user.id}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });

  const agent = createAgent(user.id, user.name, {
    ...parsed.data,
    knowledgeBase: parsed.data.knowledgeBase ?? "",
  });
  return jsonNoStore({ agent }, { status: 201 });
}
