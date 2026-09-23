// 趣味分级（delight）准入策略 —— 纯函数，无状态、无 DOM、无 React。
//
// 为什么是纯函数而不是 <DelightBoundary> 包装层 + 自定义 eslint plugin：
// 方案 v2 曾提出后者，第二轮审阅判为过度反应——本项目要管的趣味组件是**可枚举的 4 个**
// （celebrate-pop / EmptyState 插画 / 拟人形象 / thinking 动词行），为它们建一套通用分级运行时，
// 边际收益不抵维护成本；而自定义 eslint plugin 在无 CI 的单人项目里，一旦随版本升级报错，
// 最省力的修法就是把它注释掉——「L4 全站禁用」这条最重要的红线又回到口头约定。
// 纯函数 + 组件内一行早返回，运行时强度相同（生产同样生效），且单测便宜、不会被跳过。
//
// 断言测的是**行为**（DOM 里有没有 [data-delight]），不是机制，两种实现在门前完全等价。

import type { UserRole, Stage } from "@/lib/types";

/** L0 静态插画 · L1 微反馈 · L2 进度可视化 · L3 拟人形象表情反应 · L4 全屏庆祝/虚拟货币/装扮/对战 */
export type DelightLevel = 0 | 1 | 2 | 3 | 4;

/** L4 全站禁用——不是配额，是红线。任何取值都不得放行 L4。 */
export const MAX_ALLOWED_LEVEL: DelightLevel = 3;

/**
 * 该角色 × 学段允许的最高趣味等级。
 *
 * **fail-closed 的方向在这里与防代写相反，务必看清**：
 * `useUserStore` 里那句「安全默认取最强保护学段」说的是**防代写强度**（primary 管得最严）。
 * 搬到趣味配额上方向正好翻转——未知学段若回落 primary，等于给 17 岁学生首帧塞一个
 * 给 6 岁准备的拟人形象。所以这里 **未知 → L1（最低拟人化）**。
 */
export function allowed(role: UserRole | null | undefined, stage: Stage | null | undefined): DelightLevel {
  if (!role) return 1;                 // 未登录 / 身份未就绪
  if (role !== "student") return 1;    // 教师 / 管理员 / 研究员：仅微反馈
  switch (stage) {
    case "primary":
      return 3;
    case "junior":
      return 3;
    case "senior":
      return 1;                        // 高中段默认不出现拟人形象
    default:
      return 1;                        // 学段缺失 → 最低拟人化
  }
}

/** 本轮响应的安全属性——与 /api/chat 的 kind / source 同源 */
export interface SafetyContext {
  kind?: string | null;
  source?: string | null;
  /** 安全求助面板是否已打开（useSafetyStore.open）——全站常驻浮标可从任意页触发 */
  safetyOpen?: boolean;
  /** 本会话内是否**曾经**出现过 crisis/care（一旦出现，该会话剩余时间不恢复 delight） */
  sessionHadCrisis?: boolean;
}

const SUPPRESSING_KINDS = new Set(["crisis", "care", "scaffold"]);
const SUPPRESSING_SOURCES = new Set(["safety", "care", "integrity-scaffold"]);

/**
 * 是否必须抑制一切趣味元素（方案 §7.8 不可共现清单）。
 *
 * 抑制必须是 `return null`（组件不存在），不是 CSS 隐藏——一个卡通形象出现在
 * 「我想伤害自己」的回应旁边，会把一次严肃求助转译成游戏场景。
 *
 * 注意 `safetyOpen`：形象已退出 chat，但**真正剩下的共现路径是全站常驻的求助浮标**——
 * `/student/home` 的页脚还主动引导学生去点它。只按响应 kind 判定会守着一个没有守护对象的页面。
 */
export function suppressed(ctx: SafetyContext | null | undefined): boolean {
  if (!ctx) return false;
  if (ctx.safetyOpen) return true;
  if (ctx.sessionHadCrisis) return true;
  if (ctx.kind && SUPPRESSING_KINDS.has(ctx.kind)) return true;
  if (ctx.source && SUPPRESSING_SOURCES.has(ctx.source)) return true;
  return false;
}

/** 组件侧唯一入口：`if (!canRender(level, role, stage, ctx)) return null;` */
export function canRender(
  level: DelightLevel,
  role: UserRole | null | undefined,
  stage: Stage | null | undefined,
  ctx?: SafetyContext | null,
): boolean {
  if (level > MAX_ALLOWED_LEVEL) return false; // L4 全站禁用
  if (suppressed(ctx)) return false;
  return level <= allowed(role, stage);
}
