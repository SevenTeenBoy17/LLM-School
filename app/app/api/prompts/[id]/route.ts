import { NextResponse } from "next/server";
import { z } from "zod";
import { GRADIENT_KEYS } from "@/lib/data/gradientKeys";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { getPrompt, updatePrompt, deletePrompt, incrementPromptUses } from "@/lib/server/db";
import { canAccessResearch } from "@/lib/nav";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

type Ctx = { params: Promise<{ id: string }> };

const MODEL = z.enum(["chatgpt", "claude", "gpt-image", "gemini", "minimax", "deepseek", "glm"]);
const CATEGORY = z.enum(["teach", "ppt", "quiz", "research", "study", "admin"]);
const LEVEL = z.enum(["入门", "进阶", "专家"]);
const STATUS = z.enum(["pub", "draft"]);

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const existing = getPrompt(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "draft" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ prompt: existing });
}

const UseBody = z.object({ action: z.literal("use") }).strict();

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!UseBody.safeParse(json).success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { id } = await params;
  const existing = getPrompt(id);
  if (!existing || (existing.status === "draft" && existing.ownerId !== user.id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  incrementPromptUses(id);
  return NextResponse.json({ prompt: getPrompt(id) ?? existing });
}

const PatchBody = z.object({
  title: z.string().min(1).max(80).optional(),
  category: CATEGORY.optional(),
  scene: z.string().min(1).max(24).optional(),
  role: z.string().min(1).max(24).optional(),
  recommendedModel: MODEL.optional(),
  level: LEVEL.optional(),
  status: STATUS.optional(),
  description: z.string().min(1).max(400).optional(),
  body: z.string().max(4000).optional(),
  outputExample: z.string().max(1200).optional(),
  icon: z.string().max(40).optional(),
  // V0：由 z.string().max(120) 收成枚举——旧写法允许任意 CSS 直接进 style={{ backgroundImage }}，
  // 既是样式注入面，也让数据层渐变躲过源码色彩守卫（方案 §4.2.1）。
  gradient: z.enum(GRADIENT_KEYS).optional(),
  variables: z.array(z.object({
    key: z.string().max(40),
    defaultValue: z.string().max(200),
    placeholder: z.string().max(120).optional(),
  })).max(20).optional(),
});

export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });
  const { id } = await params;
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const existing = getPrompt(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "draft" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.ownerId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const prompt = updatePrompt(user.id, id, parsed.data);
  return NextResponse.json({ prompt });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });
  const { id } = await params;
  const existing = getPrompt(id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (existing.status === "draft" && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.ownerId !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  deletePrompt(user.id, id);
  return NextResponse.json({ ok: true });
}
