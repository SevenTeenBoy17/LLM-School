import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { addEvaluation, listEvaluations, EVAL_TAGS, listClassStudents, isStudentInClass, addAudit } from "@/lib/server/db";

/**
 * W-B2 · 教师快捷点评（雷达「教师评价」维度与档案袋的数据源）。
 * 低负担交互（ClassDojo 一键事件流的启示）：受控标签点选即提交；
 * 「需要关注」记 0 分不记负分（零分反馈——点评是反馈不是惩罚）。
 * 权限：仅教师可写，且只能点评**自己班**的学生（名册真实成员关系校验）。
 */

export const runtime = "nodejs";

const PostBody = z.object({
  studentId: z.string().min(1).max(60),
  tag: z.enum(EVAL_TAGS),
  note: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const demo = await isDemoSession();
  if (demo) return NextResponse.json({ error: "demo_readonly", message: "演示身份不能写入真实学生的点评" }, { status: 403 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  // 名册校验：studentId 必须在本教师班级名册内（studentId 可伪造）
  if (!isStudentInClass(user.classId, parsed.data.studentId)) return NextResponse.json({ error: "not_in_class", message: "只能点评自己班级的学生" }, { status: 403 });

  const row = addEvaluation(user.id, parsed.data.studentId, parsed.data.tag, parsed.data.note);
  addAudit({ userId: user.id, role: user.role, path: "/api/evaluations", action: `eval:${parsed.data.tag}`, result: "allow" });
  return NextResponse.json({ id: row.id, tag: row.tag, score: row.score, createdAt: row.createdAt });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  // 学生看自己；教师看本班学生
  if (!studentId || studentId === user.id) {
    return NextResponse.json({ tags: EVAL_TAGS, items: listEvaluations(user.id) });
  }
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const roster = listClassStudents(user.classId);
  if (!roster.some((s) => s.id === studentId)) return NextResponse.json({ error: "not_in_class" }, { status: 403 });
  return NextResponse.json({ tags: EVAL_TAGS, items: listEvaluations(studentId) });
}
