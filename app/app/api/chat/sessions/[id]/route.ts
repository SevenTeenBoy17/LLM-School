import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { getSession, listMessages, deleteSession, renameSession, setSessionPinned, sessionInteractions } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/chat/sessions/[id] —— 会话元信息 + 全部消息 + 交互态（👍👎/收藏，供刷新回显）。仅归属者可读。
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const session = getSession(user.id, id);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const interactions = sessionInteractions(user.id, session.id);
  return NextResponse.json({ session, messages: listMessages(session.id), ...interactions });
}

const PatchBody = z.object({
  title: z.string().min(1).max(60).optional(),
  pinned: z.boolean().optional(),
});

// PATCH —— 重命名或置顶。归属校验内置于 db 层（WHERE userId = ?）。
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  let session = getSession(user.id, id);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (parsed.data.title !== undefined) session = renameSession(user.id, id, parsed.data.title) ?? session;
  if (parsed.data.pinned !== undefined) session = setSessionPinned(user.id, id, parsed.data.pinned) ?? session;
  return NextResponse.json({ session });
}

// DELETE —— 删会话及其消息（级联在 db 层）。
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const ok = deleteSession(user.id, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
