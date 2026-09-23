import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { addIntegrity } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

const Body = z.object({ kind: z.enum(["scaffold", "example"]) });

/**
 * 学术诚信最小频次信号（评审/苏格拉底裁决）：仅记录 student 触发「学伴引导/看范例」的次数，
 * 绝不记录诉求原文、不绑定作业、不打分、不预判作弊。供教师看聚合趋势。
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ ok: false }, { status: 403 });
  const rl = rateLimit(`integrity:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  addIntegrity({ classId: user.classId, kind: parsed.data.kind });
  return NextResponse.json({ ok: true });
}
