import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/**
 * NotYetAvailable — 「这个能力还没开通」的**非控件**呈现。
 *
 * 它替换的是全站 19 处 `<Button disabled title="…未开通">`。那种写法有两个问题：
 *
 * 1. **它长得像按钮但不可点。** 用户要先点一下才知道点不了；在密集页里
 *    （admin/analytics 页头 1 个可用按钮配 3 个 disabled 占位，四者视觉等重）
 *    这直接影响可用性判断——分不清哪个是真的。
 * 2. **诚实说明只写在 `title` 属性里。** title 只在鼠标悬停时出现：
 *    触屏用户完全拿不到，读屏软件对它的支持也不一致。
 *    也就是说「未开通」这句诚实标注，恰恰在最需要它的场景下失效。
 *
 * 现在的形态刻意**不是按钮**：虚线边框 + 锁形图标 + 可见的「未开通」后缀，
 * 三者叠加让「这不是可点的东西」在视觉、语义、文本三层同时成立。
 * 详细原因走 aria-label（读屏可得）与 title（鼠标可得）双通道，
 * 而「不能点」这个最关键的信息是**可见文本**，不依赖任何悬停。
 *
 * 为什么不直接删掉：这些占位标注的是「产品打算做但还没做」，删掉等于把
 * 路线图信息也删了，而管理员恰恰需要知道「导出报告是没做，还是我没权限」。
 * 保留信息、去掉假的可点性——这是与铁律②同向的取舍（不假装有能力）。
 */
export function NotYetAvailable({
  children,
  why,
  className = "",
}: {
  /** 能力名（与原按钮文案一致，含图标） */
  children: ReactNode;
  /** 为什么还没开通——读屏与鼠标双通道可得 */
  why: string;
  className?: string;
}) {
  return (
    <span
      data-not-available="1"
      role="note"
      aria-label={`${typeof children === "string" ? children : ""}：未开通。${why}`}
      title={why}
      className={`inline-flex min-h-[var(--hit-inline)] items-center gap-1.5 rounded-[12px] border border-dashed border-[var(--border-2)] px-3 text-[13px] text-[var(--text-3)] ${className}`}
    >
      <Lock size={13} aria-hidden className="shrink-0" />
      {children}
      <span className="ml-0.5 shrink-0 rounded-full bg-[var(--rg-control-bg)] px-1.5 py-0.5 text-[11px]">
        未开通
      </span>
    </span>
  );
}
