import { NextResponse } from "next/server";
import { z } from "zod";
import { decideManorEvidence } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

export const runtime = "nodejs";
const Body = z.object({ operationId: z.string().min(8).max(80), expectedRevision: z.number().int().min(1), status: z.enum(["accepted_mastery", "revise"]), reason: z.string().trim().min(4).max(500) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "teacher" || !user.classId) return NextResponse.json({ error: { code: "FORBIDDEN", message: "仅任课教师可审核本班学习证据。" } }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份不会写入审核决定。" } }, { status: 403 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return NextResponse.json({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  let json: unknown;
  try { json = await request.json(); } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "请填写明确的审核依据。" } }, { status: 400 });
  const result = decideManorEvidence(user.id, user.classId, (await params).id, parsed.data);
  if (result.ok) return NextResponse.json(result.response);
  const status = result.code === "EVIDENCE_NOT_FOUND" || result.code === "MISSION_NOT_FOUND" ? 404 : 409;
  const authoritative = "authoritative" in result ? result.authoritative : undefined;
  return NextResponse.json({ error: { code: result.code, message: result.code === "MANOR_REVISION_CONFLICT" ? "证据已被其他教师更新。" : result.code === "EVIDENCE_ALREADY_DECIDED" ? "这份证据已经完成审核。" : result.code === "MISSION_NOT_FOUND" ? "关联的学习任务已不存在，未写入审核结果。" : "审核操作无法完成。" }, authoritative }, { status });
}
