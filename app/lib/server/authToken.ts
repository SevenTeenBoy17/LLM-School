// Edge/Node-safe signed session token (HMAC-SHA256 over a JSON payload).
// Pure Web-Crypto — usable in proxy.ts (lean, no fs/db) AND in route handlers.
// NOTE: demo secret; in production set EDUAI_SESSION_SECRET and rotate.
import type { UserRole, Stage } from "@/lib/types";
import { isProd } from "@/lib/server/env";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  stage: Stage;
  classId: string;
  avatarLetter: string;
  department: string;
  sessionVersion: number;
}

export interface SessionClaims {
  id: string;
  role: UserRole;
  sessionVersion: number;
  /**
   * 该会话是否由「切换身份（演示）」签发。
   *
   * 为什么要进**签名令牌**而不是靠前端记号：演示态下的写操作必须由服务端拒绝
   * （铁律④ RBAC 服务端权威）。客户端 sessionStorage 里的那个记号只承担提示职责，
   * 拦不住任何请求——它可以被清掉，也可以被伪造。
   *
   * 向后兼容：旧令牌没有这个字段 → undefined → 假值 → 按非演示处理。
   */
  demo?: boolean;
}

export const SESSION_COOKIE = "eduai_session"; // 放在 edge-safe 模块，proxy 与路由共用

const DEV_SECRET = "eduai-prism-dev-secret-change-me";
let _secret: string | null = null;
let _warned = false;
// 惰性求值 + 生产 fail-fast（评审 P0）：生产环境若密钥缺失或仍为默认 dev 值 → 抛错，绝不用可猜测密钥签发可信会话。
// 用惰性而非模块顶层 throw——否则 next build（NODE_ENV=production 期做路由收集/预渲染）会在 import 期崩、CI 通常不注入运行时 secret。
// 不做 length<32 强度校验：dev 密钥恰 31 字符已落入 ===DEV_SECRET 分支，长度检会误伤合法的短强随机密钥。
function secret(): string {
  if (_secret !== null) return _secret;
  const fromEnv = process.env.EDUAI_SESSION_SECRET;
  if (isProd()) {
    if (!fromEnv || fromEnv === DEV_SECRET) {
      throw new Error(
        "EDUAI_SESSION_SECRET 未配置或仍为默认 dev 值：生产环境必须设置强随机会话密钥（如 openssl rand -base64 48）。"
      );
    }
    _secret = fromEnv;
  } else {
    if (!fromEnv && !_warned) {
      _warned = true;
      console.warn("[authToken] 使用内置 dev 会话密钥——仅限非生产；生产请设置 EDUAI_SESSION_SECRET。");
    }
    _secret = fromEnv || DEV_SECRET;
  }
  return _secret;
}
const enc = new TextEncoder();
const ROLES = new Set<UserRole>(["teacher", "student", "admin", "researcher", "college-admin"]);

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(str: string): Uint8Array {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function parseSessionClaims(value: unknown): SessionClaims | null {
  if (!isRecord(value)) return null;
  if (!nonEmptyString(value.id)) return null;
  if (typeof value.role !== "string" || !ROLES.has(value.role as UserRole)) return null;
  if (!Number.isInteger(value.sessionVersion) || Number(value.sessionVersion) < 1) return null;
  return {
    id: value.id,
    role: value.role as UserRole,
    sessionVersion: Number(value.sessionVersion),
    // 只认字面 true / 1：任何其它取值一律当非演示（fail-open 到"正常会话"是对的，
    // 因为演示态是**额外限制**，误判成正常最多是少限制一次开发环境的写入；
    // 反过来把正常会话误判成演示，会把真实用户的功能锁死）。
    demo: value.demo === true || value.demo === 1,
  };
}
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

/** Sign a session token (default 8h). */
export async function signSession(
  user: SessionUser,
  maxAgeSec = 60 * 60 * 8,
  opts: { demo?: boolean } = {},
): Promise<string> {
  const u: Record<string, unknown> = { id: user.id, role: user.role, sessionVersion: user.sessionVersion };
  if (opts.demo) u.demo = true; // 不写 false，省字节且让旧令牌与非演示令牌形状一致
  const body = b64url(enc.encode(JSON.stringify({ u, exp: Math.floor(Date.now() / 1000) + maxAgeSec })));
  return `${body}.${await hmac(body)}`;
}

/** Verify + decode. Returns the user or null (bad signature / expired / malformed). */
export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expect = await hmac(body);
  if (sig.length !== expect.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i); // 常量时间比较
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return parseSessionClaims(payload.u);
  } catch {
    return null;
  }
}
