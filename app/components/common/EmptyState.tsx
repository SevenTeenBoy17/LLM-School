import type { ReactNode } from "react";
import { FileQuestion, FilterX, ListChecks, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * EmptyState — 四分型空态（UI 范式调研第一轮 top1）。
 *
 * 为什么不做一个通用 `<Empty title desc />`：**空态不是一种状态，是四种**，
 * 它们的成因不同、用户此刻的心情不同、需要的下一步也不同。用一个组件套四种场景，
 * 结果就是全站都在说「暂无数据」——本项目实测有 **27 个 .tsx 文件**各自硬编码
 * 「还没有 / 暂无 / 尚无 / 还是空的」，这是全项目最集中的一处文案漂移。
 *
 * 四型（kind）与各自的责任：
 * · `first-use`          还没产生过数据 → 给起手式，告诉他第一条怎么来
 * · `no-results`         搜索/筛选无命中 → 回显当前条件 + 给「清除筛选」的出口
 * · `post-completion`    做完了，清空了 → **静默陈述**，不庆祝
 * · `feature-education`  功能存在但没用过 → 说清它能帮什么，再给入口
 *
 * 三条来自调研审计的硬约束（都与项目铁律咬合）：
 *
 * 1. **不放演示数据。** 调研里「预置示例内容」的分支被审计排除——班级学情、错题本
 *    一旦出现示例分数，教师与家长会当真实数据读，加个「示例」徽标也挡不住截图外传。
 *    这里只允许「模板/起手式」（空壳结构，不含任何数值）。
 *
 * 2. **`post-completion` 不做庆祝动效。** 对未成年人施加成就感刺激属注意力设计，
 *    与「不做上瘾式设计」这条对外承诺直接冲突。完成态就是一行静默的陈述。
 *
 * 3. **视觉锚点只用纯几何图标**（lucide 线性图标），不引入任何拟人插画。
 *
 * 文案不写在组件里，也不写在页面里，而是集中在 lib/data/emptyStates.ts——
 * 组件只负责呈现，页面只负责选 key。这样「全站空态怎么说话」是一处可审的事实，
 * 而不是 27 处各自为政。
 */

export type EmptyKind = "first-use" | "no-results" | "post-completion" | "feature-education";

const ICONS: Record<EmptyKind, LucideIcon> = {
  "first-use": Sparkles,
  "no-results": FilterX,
  "post-completion": ListChecks,
  "feature-education": FileQuestion,
};

interface EmptyStateProps {
  kind: EmptyKind;
  /** 一句归因：为什么这里是空的。不要写「暂无数据」——那是描述现象不是解释原因。 */
  title: string;
  /** 补充说明；no-results 型应在此回显当前筛选条件。 */
  description?: string;
  /** 主动作。post-completion 型通常不需要——完成了就该让人走开。 */
  action?: ReactNode;
  /** first-use 型的「起手式」：3-4 条空壳模板，不含任何数值。 */
  starters?: ReactNode;
  /** 紧凑模式：卡片内嵌的小空态（如侧栏、图表区），不占整屏。 */
  compact?: boolean;
}

export function EmptyState({
  kind,
  title,
  description,
  action,
  starters,
  compact = false,
}: EmptyStateProps) {
  const Icon = ICONS[kind];
  // 完成态刻意压低视觉分量：它不是需要被处理的情况，是一个可以走开的结果。
  const muted = kind === "post-completion";

  return (
    <div
      data-empty-kind={kind}
      className={
        compact
          ? "flex flex-col items-center justify-center px-4 py-8 text-center"
          : "flex flex-col items-center justify-center px-6 py-14 text-center"
      }
    >
      <span
        aria-hidden
        className={`grid place-items-center rounded-[var(--r-ctl)] ${
          compact ? "h-10 w-10" : "h-12 w-12"
        } ${muted ? "bg-[var(--rg-control-bg)] text-[var(--text-3)]" : "bg-[var(--accent-tint)] text-[var(--c-edu)]"}`}
      >
        <Icon size={compact ? 18 : 22} strokeWidth={1.75} />
      </span>

      <p className={`mt-3 font-semibold text-[var(--text)] ${compact ? "text-[13px]" : "text-[14px]"}`}>
        {title}
      </p>

      {description && (
        <p className="mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-[var(--text-2)]">
          {description}
        </p>
      )}

      {starters && <div className="mt-4 w-full max-w-[36rem]">{starters}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
