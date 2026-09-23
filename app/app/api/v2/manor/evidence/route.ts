import { NextResponse } from "next/server";
import { z } from "zod";
import { manorQuietUntil, submitManorEvidence, submitManorExpressionEvidence } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { manorMutationResponse } from "@/lib/manor/server-http";

export const runtime = "nodejs";

const Shared = {
  operationId: z.string().min(8).max(80),
  missionId: z.string().min(1).max(80),
  taskRunId: z.string().min(8).max(100).optional(),
  hintsUsed: z.array(z.string().min(1).max(80)).max(12).default([]),
  accommodationCodes: z.array(z.string().min(1).max(80)).max(12).default([]),
};
const Body = z.union([
  z.object({ ...Shared, evidenceType: z.literal("objective").optional(), answer: z.string().min(1).max(32) }).strict(),
  z.object({ ...Shared, evidenceType: z.literal("expression"), content: z.string().trim().min(8).max(2000), evidenceId: z.string().min(8).max(100).optional(), expectedRevision: z.number().int().min(1).optional() }).strict()
    .refine((value) => Boolean(value.evidenceId) === (value.expectedRevision !== undefined)),
]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "登录已过期，答案仍可保留在本地。" } }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: { code: "FORBIDDEN", message: "当前账号不能提交学生证据。" } }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份不会写入学生记录。" } }, { status: 403 });
  const quietUntil = manorQuietUntil(user.id);
  if (quietUntil) return NextResponse.json({ error: { code: "SESSION_QUIET", message: "今天的学习已经平稳结束，明天再继续。", quietUntil } }, { status: 423 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: guard.status });

  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请检查答案内容。" } }, { status: 400 });
  const result = parsed.data.evidenceType === "expression"
    ? submitManorExpressionEvidence(user.id, parsed.data)
    : submitManorEvidence(user.id, parsed.data);
  return manorMutationResponse(result);
}
