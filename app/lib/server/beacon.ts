import "server-only";

/**
 * M2/B4（审查修订）：proxy→/api/audit 越权 beacon 的内部密钥。
 * - 拆出独立 server-only 模块：nav.ts 被多个客户端组件导入会进 client bundle，密钥字面量不得随之泄漏；
 * - 生产 fail-closed：未设置 EDUAI_BEACON_SECRET 时返回 null → proxy 不带头、路由一律 401（beacon 静默停用，
 *   宁可少记审计也不接受可伪造密钥）；开发环境用默认值保持易用；
 * - 常时比较：避免逐字符早退的时序侧信道。
 */

export const BEACON_HEADER = "x-eduai-beacon";

export function beaconSecret(): string | null {
  const s = process.env.EDUAI_BEACON_SECRET;
  if (s) return s;
  return process.env.NODE_ENV === "production" ? null : "eduai-internal-beacon-v1";
}

/** 常时字符串比较（长度不同直接 false，但比较主体不早退）。 */
export function beaconEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
