import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { addAudit, listTickets, updateTicketStatus } from "@/lib/server/db";

const PatchBody = z.object({
  id: z.string().min(1).max(80),
  status: z.enum(["received", "in_progress", "resolved"]),
});

/**
 * 安全求助/举报工单查询：仅校内安全/心理团队（admin / college-admin）可读。
 * 与隐私承诺一致——求助内容默认对任课老师匿名，只有安全团队能看到（见 SafetyHelp 隐私面板）。
 * 这条读取路径闭合了「危机→建工单→有人跟进」的最后一公里（评审 P0：避免只写不读黑洞）。
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "college-admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ tickets: listTickets(100) });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.role !== "admin" && user.role !== "college-admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const ticket = updateTicketStatus(parsed.data.id, parsed.data.status);
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  addAudit({ userId: user.id, role: user.role, path: "/api/safety/tickets", action: "ticket_status_update", result: "allow" });
  return NextResponse.json({ ticket });
}
