import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { getActivity, getSubmission, isStudentInClass, getUploadForReview } from "@/lib/server/db";

/**
 * W-B3 · 批阅预览：教师读某学生对某活动的提交正文（不读正文写不出退回理由）。
 * 仅活动发布者本人 + 本班学生；学生读自己的走 /api/activities 列表已带 mine。
 */

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const activity = getActivity(id);
  if (!activity) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (activity.teacherId !== user.id) return NextResponse.json({ error: "not_owner" }, { status: 403 });

  const studentId = new URL(req.url).searchParams.get("studentId") ?? "";
  if (!studentId || !isStudentInClass(activity.classId, studentId)) {
    return NextResponse.json({ error: "not_in_class" }, { status: 403 });
  }
  const sub = getSubmission(id, studentId);
  if (!sub) return NextResponse.json({ error: "no_submission" }, { status: 404 });
  // 佐证材料随批阅预览下发（按提交学生归属读取，预览截断 2000 字）
  const artifact = sub.artifactRef ? getUploadForReview(sub.artifactRef, studentId) : null;
  return NextResponse.json({
    content: sub.content, status: sub.status, submittedAt: sub.submittedAt,
    artifact: artifact ? { name: artifact.name, chars: artifact.chars, preview: artifact.textContent.slice(0, 2000) } : null,
  });
}
