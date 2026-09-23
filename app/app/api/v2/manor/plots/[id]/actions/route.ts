import { NextResponse } from "next/server";
import { z } from "zod";
import { applyManorPlotAction, manorQuietUntil } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

export const runtime = "nodejs";

const Allocation = z.object({ grantId: z.string().min(8).max(100), amount: z.number().int().min(1).max(100) }).strict();
const Body = z.object({
  action: z.enum(["plant", "plant_and_nurture", "nurture", "harvest", "clear"]),
  operationId: z.string().min(8).max(80),
  expectedRevision: z.number().int().min(1),
  cropId: z.string().min(1).max(24).optional(),
  grantAllocations: z.array(Allocation).max(8).default([]),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: { code: "FORBIDDEN", message: "当前账号不能操作学生庄园。" } }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份不会保存庄园操作。" } }, { status: 403 });
  const quietUntil = manorQuietUntil(user.id);
  if (quietUntil) return NextResponse.json({ error: { code: "SESSION_QUIET", message: "今天的学习已经平稳结束，明天再继续。", quietUntil } }, { status: 423 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  const plotId = Number((await params).id);
  if (!Number.isInteger(plotId) || plotId < 0 || plotId > 23) return NextResponse.json({ error: { code: "INVALID_PLOT", message: "地块不存在。" } }, { status: 404 });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请检查农事操作。" } }, { status: 400 });
  const result = applyManorPlotAction(user.id, plotId, parsed.data);
  if (result.ok) return NextResponse.json(result.response, { headers: { "cache-control": "no-store" } });
  const status = result.code === "PLOT_LOCKED" ? 403 : result.code === "MANOR_REVISION_CONFLICT" || result.code === "OPERATION_CONFLICT" ? 409 : 422;
  return NextResponse.json({ error: { code: result.code, message: result.code === "MANOR_REVISION_CONFLICT" ? "地块已在另一设备更新，请使用最新状态重试。" : result.code === "PLOT_LOCKED" ? "这块土地暂未开放，不以成长值解锁。" : result.code === "CROP_LOCKED" ? "这个品种尚未解锁，请选择当前可用的品种。" : "当前操作无法完成。" }, authoritative: result.authoritative }, { status });
}
