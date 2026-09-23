import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { listNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "@/lib/server/db";

// GET /api/notifications —— 当前用户通知 + 未读数（首次自动播种一条欢迎通知）。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const notifications = listNotifications(user.id, 30, !(await isDemoSession()));
  return NextResponse.json({ notifications, unread: unreadNotificationCount(user.id) });
}

const PatchBody = z.object({ id: z.string().max(80).optional(), all: z.boolean().optional() });

// PATCH —— 标记已读：{id} 单条，或 {all:true} 全部。
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  if (parsed.data.all) markAllNotificationsRead(user.id);
  else if (parsed.data.id) markNotificationRead(user.id, parsed.data.id);
  else return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  return NextResponse.json({ ok: true, unread: unreadNotificationCount(user.id) });
}
