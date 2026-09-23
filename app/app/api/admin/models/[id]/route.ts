import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { getModelSettings, setModelSettings, addAudit } from "@/lib/server/db";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

type Ctx = { params: Promise<{ id: string }> };

function isAdmin(role: string) { return role === "admin" || role === "college-admin"; }
// 合法模型 id 白名单（与 lib/data/models 一致）——防止任意字符串写入 model_settings 主键。
const VALID_MODELS = new Set(["chatgpt", "claude", "gpt-image", "gemini", "minimax", "deepseek", "glm"]);

// GET /api/admin/models/[id] —— 模型配置（仅管理员）。
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (!VALID_MODELS.has(id)) return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  return NextResponse.json({ settings: getModelSettings(id) });
}

const PutBody = z.object({
  openToStudents: z.boolean().optional(),
  quotaTeacher: z.number().int().min(0).max(100000).optional(),
  quotaStudent: z.number().int().min(0).max(100000).optional(),
  dataIsolation: z.boolean().optional(),
  allowUpload: z.boolean().optional(),
  autoDowngrade: z.boolean().optional(),
});

// PUT —— 更新模型配置（仅管理员；额度/开关持久化，措辞为公平使用非计费）。
export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });
  const { id } = await params;
  if (!VALID_MODELS.has(id)) return NextResponse.json({ error: "invalid_model" }, { status: 400 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const settings = setModelSettings(id, parsed.data);
  addAudit({ userId: user.id, role: user.role, path: `/api/admin/models/${id}`, action: "model_settings_update", result: "allow" });
  return NextResponse.json({ settings });
}
