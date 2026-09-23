import { NextResponse } from "next/server";
import { canAccessCourseware } from "@/lib/nav";
import { getSessionUser } from "@/lib/server/session";
import { listCoursewareDecks } from "@/lib/server/courseware";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (!canAccessCourseware(user.role)) return jsonNoStore({ error: { code: "FORBIDDEN", message: "当前账号不能访问教师课件。" } }, { status: 403 });
  return jsonNoStore({ schemaVersion: "courseware.v2", items: listCoursewareDecks(user.id) });
}
