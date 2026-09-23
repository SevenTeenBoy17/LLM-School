import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { portfolioSummary, isStudentInClass } from "@/lib/server/db";

/**
 * W-B3 · 成长档案袋聚合（规格⑦）。
 * mode=simple：遴选产物（活动入册精选 ≤6 + 教师点评 ≤6 + 客观数据摘要）；
 * mode=full：全量时间线（活动入册 + 教师点评合流倒序）。
 * 可见域：本人 + 任课教师（?studentId 走名册校验）；无数据的区块由前端留白鼓励（R6 不编造）。
 */

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "full" ? "full" : "simple";
  const studentId = url.searchParams.get("studentId");

  let targetId = user.id;
  if (studentId && studentId !== user.id) {
    if (user.role !== "teacher" || !user.classId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!isStudentInClass(user.classId, studentId)) return NextResponse.json({ error: "not_in_class" }, { status: 403 });
    targetId = studentId;
  } else if (user.role !== "student" && user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(portfolioSummary(targetId, mode));
}
