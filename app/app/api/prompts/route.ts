import { NextResponse } from "next/server";
import { z } from "zod";
import { GRADIENT_KEYS } from "@/lib/data/gradientKeys";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { listPrompts, createPrompt, listFavorites } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { canAccessResearch } from "@/lib/nav";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

// GET /api/prompts —— 全部提示词 + 当前用户已收藏的 prompt id（供 UI 回显收藏态）。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const prompts = listPrompts(user.id);
  const favorites = listFavorites(user.id, "prompt").map((f) => f.refId);
  return NextResponse.json({ prompts, favorites, userId: user.id });
}

const MODEL = z.enum(["chatgpt", "claude", "gpt-image", "gemini", "minimax", "deepseek", "glm"]);
const CATEGORY = z.enum(["teach", "ppt", "quiz", "research", "study", "admin"]);
const LEVEL = z.enum(["入门", "进阶", "专家"]);

const PostBody = z.object({
  title: z.string().min(1).max(80),
  category: CATEGORY,
  scene: z.string().min(1).max(24),
  role: z.string().min(1).max(24),
  recommendedModel: MODEL,
  level: LEVEL,
  description: z.string().min(1).max(400),
  status: z.enum(["pub", "draft"]).optional(),
  body: z.string().max(4000).optional(),
  outputExample: z.string().max(1200).optional(),
  icon: z.string().max(40).optional(),
  // V0：由 z.string().max(120) 收成枚举——旧写法允许任意 CSS 直接进 style={{ backgroundImage }}，
  // 既是样式注入面，也让数据层渐变躲过源码色彩守卫（方案 §4.2.1）。
  gradient: z.enum(GRADIENT_KEYS).optional(),
  variables: z.array(z.object({ key: z.string().max(40), defaultValue: z.string().max(200), placeholder: z.string().max(120).optional() })).max(20).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });
  const rl = rateLimit(`prompts:${user.id}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const prompt = createPrompt(user.id, parsed.data);
  return NextResponse.json({ prompt }, { status: 201 });
}
