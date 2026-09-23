import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { getGuardianSettings, getGuardianScope, setGuardianSettings, clearGuardianScope, addAudit } from "@/lib/server/db";

/**
 * /api/guardian —— M3/B2 守护策略（服务端权威）+ BL2 班级级覆盖。
 *
 * 生效优先级：**班级行 → 全局行 → 内置默认**（getGuardianSettings 内实现，source 如实标注）。
 * GET   ：任何登录用户读「自己所在班的生效配置」；管理端可 ?scope=global|<classId> 读某作用域原始行。
 * PATCH ：admin 写全局；teacher 只能写**自己班**（classId 取自会话，不接受请求体指定 → 无跨班写入面）。
 * DELETE：teacher 撤销本班覆盖（回落全校）；全局行不可删（删则全站回落内置默认，属误操作）。
 */

const CFG_KEYS = { limitMin: z.number().int().min(10).max(120), curfewStart: z.number().int().min(0).max(23), curfewEnd: z.number().int().min(0).max(23) };
const Body = z.object(CFG_KEYS);

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope");
  if (scope) {
    // 读某作用域原始行：admin 任意；teacher 仅本班
    const isAdmin = user.role === "admin" || user.role === "college-admin";
    if (!isAdmin && !(user.role === "teacher" && scope === user.classId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ scope, override: getGuardianScope(scope) });
  }
  // 生效配置（学生端 GuardianShell 轮询用；按本人班级解析）
  return NextResponse.json({ guardian: getGuardianSettings(user.classId) });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  const isTeacher = user.role === "teacher";
  if (!isAdmin && !isTeacher) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isTeacher && !user.classId?.trim()) return NextResponse.json({ error: "no_class" }, { status: 400 });

  const rl = rateLimit(`guardian:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // 作用域由**角色与会话**决定，不读请求体：admin→全校，teacher→本班
  const scope = isAdmin ? "global" : user.classId;
  setGuardianSettings(parsed.data, user.id, scope);
  addAudit({
    userId: user.id, role: user.role, path: "/api/guardian",
    action: `guardian_update:${scope}:${parsed.data.limitMin}m/${parsed.data.curfewStart}-${parsed.data.curfewEnd}`, result: "allow",
  });
  return NextResponse.json({ scope, guardian: getGuardianSettings(isAdmin ? undefined : user.classId) });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!user.classId?.trim()) return NextResponse.json({ error: "no_class" }, { status: 400 });
  const removed = clearGuardianScope(user.classId);
  if (removed) {
    addAudit({ userId: user.id, role: user.role, path: "/api/guardian", action: `guardian_clear:${user.classId}`, result: "allow" });
  }
  return NextResponse.json({ removed, guardian: getGuardianSettings(user.classId) });
}
