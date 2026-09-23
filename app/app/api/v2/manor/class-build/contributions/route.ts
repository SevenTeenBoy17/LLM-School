import { NextResponse } from "next/server";
import { z } from "zod";
import { contributeManorClassBuild, manorQuietUntil } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

export const runtime = "nodejs";
const Allocation = z.object({ grantId: z.string().min(8).max(100), amount: z.number().int().min(1).max(100) }).strict();
const Body = z.object({ operationId: z.string().min(8).max(80), amount: z.number().int().min(1).max(10), grantAllocations: z.array(Allocation).min(1).max(8) }).strict();

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "student" || !user.classId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "当前账号不能参与班级共建。" } }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份不会写入班级共建。" } }, { status: 403 });
  const quietUntil = manorQuietUntil(user.id);
  if (quietUntil) return NextResponse.json({ error: { code: "SESSION_QUIET", message: "今天的学习已经平稳结束，明天再继续。", quietUntil } }, { status: 423 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请检查贡献数量。" } }, { status: 400 });
  const result = contributeManorClassBuild(user.id, user.classId, parsed.data);
  if (result.ok) return NextResponse.json(result.response);
  return NextResponse.json({ error: { code: result.code, message: result.code === "PURPOSE_NOT_ALLOWED" ? "订正支持授权只用于个人学习，不进入班级比较。" : result.code === "CLASS_BUILD_COMPLETE" ? "当前班级项目已经完成，不会继续扣除成长能量。" : "班级共建暂时无法完成。" } }, { status: 409 });
}
