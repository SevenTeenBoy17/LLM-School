import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import {
  createPortfolioSnapshot, listPortfolioSnapshots, getPortfolioSnapshot, isStudentInClass, addAudit,
} from "@/lib/server/db";

/**
 * G3 · 档案袋学期归档（规格⑦-2「确认→锁定→版本化」）。
 * POST：学生本人确认并锁定当前学期档案（快照简约版；一学期一册，重复 409）。
 * GET：列表 / ?id= 取单册（学生本人；教师 ?studentId 走班级成员校验）。
 * 快照建后**无更新/删除路径**——锁定即不可变，只能追加新学期（版本化的实现方式）。
 */

export const runtime = "nodejs";

const PostBody = z.object({ term: z.string().trim().min(2).max(40) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: "forbidden", message: "只有学生本人可以归档自己的档案袋" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_readonly", message: "演示身份不能归档真实档案" }, { status: 403 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const r = createPortfolioSnapshot(user.id, parsed.data.term);
  if (!r.ok) {
    const msg = r.error === "term_exists" ? "这个学期已经归档锁定，不能覆盖——版本一经确认就不再改动" : "学期名称无效";
    return NextResponse.json({ error: r.error, message: msg }, { status: r.error === "term_exists" ? 409 : 400 });
  }
  addAudit({ userId: user.id, role: user.role, path: "/api/portfolio/snapshots", action: `portfolio:lock:${parsed.data.term}`, result: "allow" });
  return NextResponse.json({ id: r.id, term: parsed.data.term });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const studentId = url.searchParams.get("studentId");

  let targetId = user.id;
  if (studentId && studentId !== user.id) {
    if (user.role !== "teacher" || !user.classId || !isStudentInClass(user.classId, studentId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    targetId = studentId;
  } else if (user.role !== "student" && user.role !== "teacher") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (id) {
    const snap = getPortfolioSnapshot(targetId, id);
    if (!snap) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(snap);
  }
  return NextResponse.json({ snapshots: listPortfolioSnapshots(targetId) });
}
