import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByRole, toSessionUser } from "@/lib/server/db";
import { setSession, getSessionUser } from "@/lib/server/session";
import { isProd } from "@/lib/server/env";

const Body = z.object({ role: z.enum(["teacher", "student", "researcher", "admin", "college-admin"]) });

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

/**
 * 演示用「切换身份」——重新签发对应角色 seed 用户的会话 cookie，使 proxy 守卫与 UI 同步。
 * ⚠️ 仅非生产环境可用：生产禁止任意提权（防越权）。
 */
export async function POST(req: Request) {
  if (isProd()) {
    return jsonNoStore({ error: "disabled_in_production" }, { status: 403 });
  }
  const current = await getSessionUser();
  if (!current) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });

  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });

  const u = findUserByRole(parsed.data.role);
  if (!u) return jsonNoStore({ error: "no_seed_user" }, { status: 404 });

  const su = toSessionUser(u);
  // 标记为演示会话：写操作会被服务端拒绝（见 lib/server/session.ts isDemoSession）。
  // 这一步让「你正处在演示身份里」从一句前端提示变成一条**服务端可执行的约束**。
  await setSession(su, { demo: true });
  return jsonNoStore({ user: su });
}
