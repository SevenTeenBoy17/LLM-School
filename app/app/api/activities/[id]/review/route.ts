import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { getActivity, getSubmission, reviewSubmission, isStudentInClass, addAudit } from "@/lib/server/db";

/**
 * W-B3 · 教师批阅（规格⑥-1 闭环的收口端）：
 * approve = 通过自动入档案袋（档案袋直接读 approved 行，单一真相源）；
 * return  = 退回必须附理由（学生看得到「为什么」，才改得动）。
 * 只允许批阅自己发布的活动 + 自己班学生的提交。
 */

export const runtime = "nodejs";

const Body = z.object({
  studentId: z.string().min(1).max(60),
  verdict: z.enum(["approve", "return"]),
  feedback: z.string().trim().max(500).optional(),
}).refine((v) => v.verdict === "approve" || Boolean(v.feedback?.trim()), { message: "return_needs_feedback" });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly", message: "演示身份不能批阅真实提交" }, { status: 403 });

  const { id } = await ctx.params;
  const activity = getActivity(id);
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (activity.teacherId !== user.id) return NextResponse.json({ error: "not_owner", message: "只能批阅自己发布的活动" }, { status: 403 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  if (!isStudentInClass(activity.classId, parsed.data.studentId)) {
    return NextResponse.json({ error: "not_in_class" }, { status: 403 });
  }
  const sub = getSubmission(id, parsed.data.studentId);
  if (!sub) return NextResponse.json({ error: "no_submission" }, { status: 404 });

  const row = reviewSubmission(sub.id, parsed.data.verdict, parsed.data.feedback ?? "");
  if (!row) return NextResponse.json({ error: "state_invalid", message: "只有「已提交」状态可以批阅" }, { status: 409 });
  addAudit({ userId: user.id, role: user.role, path: `/api/activities/${id}/review`, action: `review:${parsed.data.verdict}`, result: "allow" });
  return NextResponse.json({ id: row.id, status: row.status, teacherFeedback: row.teacherFeedback, reviewedAt: row.reviewedAt });
}
