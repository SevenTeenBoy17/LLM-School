// 仅服务端使用（route handlers / server components）。
import { cookies } from "next/headers";
import { signSession, verifySession, SESSION_COOKIE, type SessionUser } from "@/lib/server/authToken";
import { isProd } from "@/lib/server/env";
import { findUserById, toSessionUser } from "@/lib/server/db";

export { SESSION_COOKIE };
const MAX_AGE = 60 * 60 * 8; // 8h

/** 读取当前会话用户（路由处理器 / 服务端组件）。null = 未登录/失效。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const user = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!user) return null;
  const current = findUserById(user.id);
  if (!current || current.sessionVersion !== user.sessionVersion) return null;
  return toSessionUser(current);
}

export async function setSession(user: SessionUser, opts: { demo?: boolean } = {}): Promise<void> {
  const token = await signSession(user, MAX_AGE, opts);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: isProd(),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/**
 * 当前会话是否由「切换身份（演示）」签发。
 *
 * 写操作要用它拒绝请求：一位老师以学生身份触发危机拦截，会在**真实未成年人账号下**
 * 生成危机工单——那是系统里最敏感的记录类型，被演示流量污染后无从分辨真假。
 * 同理还会消耗该学生的当日配额、往他的会话历史里写内容。
 *
 * 只读放行：以学生身份浏览页面正是演示的用途，拦掉它等于把功能废掉。
 */
export async function isDemoSession(): Promise<boolean> {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value);
  return claims?.demo === true;
}

export type { SessionUser };
