import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByCredentials, toSessionUser } from "@/lib/server/db";
import { setSession } from "@/lib/server/session";
import { clientIp, rateLimit } from "@/lib/server/rateLimit";

const Body = z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(128) });
const LOGIN_LIMITS = process.env.NODE_ENV === "production"
  ? { global: 600, ip: 60, account: 20 }
  : { global: 6_000, ip: 600, account: 200 };

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(req: Request) {
  const globalLimit = rateLimit("auth:login:global", LOGIN_LIMITS.global, 60_000);
  if (!globalLimit.ok) {
    return jsonNoStore(
      { error: "too_many_attempts", retryAfter: globalLimit.retryAfter },
      { status: 429, headers: { "retry-after": String(globalLimit.retryAfter) } },
    );
  }
  // 校园常共享一个公网出口，IP 维度只挡突发洪泛；账号维度在解析用户名后单独收紧。
  const sourceLimit = rateLimit(`auth:login:ip:${clientIp(req)}`, LOGIN_LIMITS.ip, 60_000);
  if (!sourceLimit.ok) {
    return jsonNoStore(
      { error: "too_many_attempts", retryAfter: Math.max(globalLimit.retryAfter, sourceLimit.retryAfter) },
      { status: 429, headers: { "retry-after": String(Math.max(globalLimit.retryAfter, sourceLimit.retryAfter)) } },
    );
  }
  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });

  const username = parsed.data.username.trim();
  const accountLimit = rateLimit(`auth:login:account:${username.toLocaleLowerCase("en-US")}`, LOGIN_LIMITS.account, 5 * 60_000);
  if (!accountLimit.ok) {
    return jsonNoStore(
      { error: "too_many_attempts", retryAfter: accountLimit.retryAfter },
      { status: 429, headers: { "retry-after": String(accountLimit.retryAfter) } },
    );
  }
  const user = await findUserByCredentials(username, parsed.data.password);
  if (!user) return jsonNoStore({ error: "invalid_credentials" }, { status: 401 });

  const su = toSessionUser(user);
  await setSession(su);
  return jsonNoStore({ user: su });
}
