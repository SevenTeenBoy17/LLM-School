// M3/B2：守护策略共享纯函数（服务端路由与客户端 GuardianShell 共用，无副作用便于单测）。
// 语义：curfewStart === curfewEnd → 宵禁停用；start > end → 跨零点窗口（如 22→6）；start < end → 同日窗口。

export interface GuardianConfig {
  limitMin: number;    // 单档提醒阈值（分钟）
  curfewStart: number; // 0-23
  curfewEnd: number;   // 0-23
}

// 2026-08-19 用户拍板：学生时段限制默认关闭（start===end=停用）。能力完整保留——
// 管理端「守护设置」随时可重设 22-6 等窗口；夜测门（render R8）以双态覆盖开/关两种形态。
export const GUARDIAN_DEFAULTS: GuardianConfig = { limitMin: 40, curfewStart: 0, curfewEnd: 0 };

export function inCurfew(hour: number, cfg: GuardianConfig): boolean {
  const { curfewStart: s, curfewEnd: e } = cfg;
  if (s === e) return false; // 停用
  return s > e ? hour >= s || hour < e : hour >= s && hour < e;
}
