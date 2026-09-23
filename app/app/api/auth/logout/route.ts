import { NextResponse } from "next/server";
import { clearSession, getSessionUser } from "@/lib/server/session";
import { revokeUserSessions } from "@/lib/server/db";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST() {
  const user = await getSessionUser();
  if (user) revokeUserSessions(user.id);
  await clearSession();
  return jsonNoStore({ ok: true });
}
