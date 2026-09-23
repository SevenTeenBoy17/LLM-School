import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ user: null }, { status: 401 });
  return jsonNoStore({ user });
}
