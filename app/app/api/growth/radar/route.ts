import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { getRadarData, listClassStudents } from "@/lib/server/db";

/**
 * W-B2 · 课堂雷达数据（规格红线 R2/R6）。
 * 五维口径全部写死在 db.getRadarData（可复算审计）；任一维无数据返回 null——
 * 前端显示「暂无数据」，绝不用均值/种子数据补位。
 * 学生看自己；教师可看本班学生（名册校验）。
 */

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const studentId = new URL(req.url).searchParams.get("studentId");
  if (!studentId || studentId === user.id) {
    return NextResponse.json({ dims: getRadarData(user.id) });
  }
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!listClassStudents(user.classId).some((s) => s.id === studentId)) {
    return NextResponse.json({ error: "not_in_class" }, { status: 403 });
  }
  return NextResponse.json({ dims: getRadarData(studentId) });
}
