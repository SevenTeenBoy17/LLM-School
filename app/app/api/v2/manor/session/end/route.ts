import { NextResponse } from "next/server";
import { z } from "zod";
import { endManorSession } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

export const runtime = "nodejs";
const Body = z.object({ operationId: z.string().min(8).max(80), expectedRevision: z.number().int().min(1) }).strict();

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: { code: "FORBIDDEN", message: "当前账号不能结束学生会话。" } }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份不会写入健康节奏。" } }, { status: 403 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请检查会话版本。" } }, { status: 400 });
  const result = endManorSession(user.id, parsed.data);
  if (result.ok) return NextResponse.json(result.response);
  return NextResponse.json({ error: { code: result.code, message: result.code === "MANOR_REVISION_CONFLICT" ? "健康节奏已在另一设备更新。" : "操作编号已被其他请求使用。" }, authoritative: result.authoritative }, { status: 409 });
}
