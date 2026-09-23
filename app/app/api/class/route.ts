import { NextResponse } from "next/server";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { listClassStudents, listPending, classOverview, integrityWeekly, addAudit } from "@/lib/server/db";
import { canAccessClass } from "@/lib/nav";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

/**
 * 班级学情数据（服务端权威 + 按角色脱敏，评审 P0/P1）：
 * - student：禁止（403 + 审计）
 * - researcher：服务端直接下发「已脱敏 payload」——无实名/无精确分数/无薄弱点（数据最小化）
 * - teacher：实名诊断明细（补差用）；admin 按当前产品边界不访问班级学情
 * 脱敏在服务端完成，前端拿不到原始 PII，杜绝客户端篡改绕过。
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const demo = await isDemoSession();

  if (!canAccessClass(user.role)) {
    if (!demo) addAudit({ userId: user.id, role: user.role, path: "/api/class", action: "read_class", result: "deny" });
    return jsonNoStore({ error: "forbidden" }, { status: 403 });
  }

  const roster = listClassStudents(user.classId);
  const masked = user.role === "researcher";
  // 单一脱敏映射，学生明细与待批改共用，杜绝交叉重识别
  const idToLabel = new Map(roster.map((s, i) => [s.id, `学生 ${i + 1}`]));
  const nameOf = (id: string) => (masked ? (idToLabel.get(id) ?? "学生") : (roster.find((s) => s.id === id)?.name ?? "—"));

  const students = roster.map((s, i) =>
    masked
      // 科研视图：不下发真实学籍 id（评审 P2）——用合成序号，杜绝跨接口拼回真实名册
      ? { id: `stu-${i + 1}`, label: `学生 ${i + 1}`, bucket: s.mastery < 60 ? "待加强" : s.mastery <= 80 ? "良好" : "优秀" }
      : { id: s.id, name: s.name, mastery: s.mastery, trend: s.trend, weakest: s.weakest, needHelp: s.needHelp }
  );
  const pending = listPending(user.classId).map((p, i) => masked
    ? {
        id: `pending-${i + 1}`,
        subject: p.subject,
        title: "待批改作业",
        submittedAt: Math.floor(p.submittedAt / 86_400_000) * 86_400_000,
        student: nameOf(p.studentId),
      }
    : { id: p.id, subject: p.subject, title: p.title, submittedAt: p.submittedAt, student: nameOf(p.studentId) }
  );

  if (!demo) addAudit({ userId: user.id, role: user.role, path: "/api/class", action: "read_class", result: "allow" });
  return jsonNoStore({
    masked,
    overview: classOverview(user.classId),
    students,
    pending,
    integrityWeekly: integrityWeekly(user.classId),
  });
}
