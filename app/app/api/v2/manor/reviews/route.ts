import { NextResponse } from "next/server";
import { z } from "zod";
import { manorQuietUntil, scheduleManorReview } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

export const runtime = "nodejs";
const Body = z.object({ operationId: z.string().min(8).max(80), evidenceId: z.string().min(8).max(100), strategy: z.string().trim().min(2).max(120), window: z.enum(["tomorrow", "three_days"]) }).strict();

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: { code: "FORBIDDEN", message: "当前账号不能安排学生复习。" } }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份不会写入复习计划。" } }, { status: 403 });
  const quietUntil = manorQuietUntil(user.id);
  if (quietUntil) return NextResponse.json({ error: { code: "SESSION_QUIET", message: "今天的学习已经平稳结束，明天再继续。", quietUntil } }, { status: 423 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请检查复习策略。" } }, { status: 400 });
  const result = scheduleManorReview(user.id, parsed.data);
  if (result.ok) return NextResponse.json(result.response);
  return NextResponse.json({ error: { code: result.code, message: result.code === "EVIDENCE_NOT_FOUND" ? "学习证据不存在。" : "操作编号已被其他请求使用。" } }, { status: result.code === "EVIDENCE_NOT_FOUND" ? 404 : 409 });
}
