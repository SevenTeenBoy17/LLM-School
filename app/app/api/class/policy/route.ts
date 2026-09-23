import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { getClassPolicy, setClassPolicy, addAudit } from "@/lib/server/db";

/**
 * /api/class/policy —— M1/B1 班级苏格拉底锁定策略（服务端权威）。
 * GET：教师/科研读本班策略；PATCH：仅教师写本班（classId 取自会话，不接受请求体指定——防跨班越权），全程 audit。
 */

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!["teacher", "researcher", "admin", "college-admin"].includes(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ policy: getClassPolicy(user.classId) });
}

const Body = z.object({ socraticLock: z.boolean() });

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "teacher") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!user.classId) return NextResponse.json({ error: "no_class" }, { status: 400 });
  const rl = rateLimit(`class-policy:${user.id}`, 10, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const policy = setClassPolicy(user.classId, parsed.data.socraticLock, user.id);
  addAudit({
    userId: user.id, role: user.role, path: "/api/class/policy",
    action: `socratic_lock:${parsed.data.socraticLock ? "on" : "off"}`, result: "allow",
  });
  return NextResponse.json({ policy });
}
