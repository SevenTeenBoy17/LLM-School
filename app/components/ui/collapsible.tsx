"use client";

// 折叠面板（Disclosure）——用于「文字过多」板块的信息瘦身：默认收起、按需展开，做到「少即是多」。
// 无障碍：按钮 aria-expanded + region aria-labelledby；尊重 prefers-reduced-motion（降级为瞬时切换，无高度动画）。
// 主题化：全走 CSS 变量，明暗自适应。绝不用于隐藏安全求助/危机/隐私等关键信息（那些常驻可见）。

import { Children, isValidElement, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

// U-3 修复：把文件头那句「绝不用于隐藏安全求助/危机/隐私等关键信息」从注释变成可执行约束。
// 收起时 children 整体不在 DOM，因此不能靠 DOM 查询兜底——改为在渲染前静态遍历传入的 React 元素树。
// 只在开发环境 throw：生产环境不因一次误用而让学生看不到整页（安全的失败方向是「暴露问题给开发者」，
// 而不是「在学生面前白屏」）。
function assertNoSafetyCritical(node: ReactNode, depth = 0): void {
  if (depth > 12) return; // 防御异常深的树，正常披露结构远不到这个深度
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    if (props["data-safety-critical"] != null) {
      throw new Error(
        `[collapsible] 检测到 data-safety-critical="${String(props["data-safety-critical"])}" 出现在折叠区内。` +
          "安全求助 / AI 身份 / 隐私 / 降级来源 / 能力边界等披露命题必须常驻可见（方案 §7.2 不可折叠白名单），" +
          "请把该节点移到 <Collapsible> 之外。",
      );
    }
    if (props.children != null) assertNoSafetyCritical(props.children as ReactNode, depth + 1);
  });
}

export function Collapsible({
  title,
  summary,
  icon,
  defaultOpen = false,
  children,
  "data-testid": testId,
}: {
  title: ReactNode;
  summary?: ReactNode; // 收起时的一句话摘要，让「折叠」也传达信息
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  if (process.env.NODE_ENV !== "production") {
    assertNoSafetyCritical(children);
    assertNoSafetyCritical(summary);
  }
  const rid = useId();
  const panelId = `collapsible-panel-${rid}`;
  const btnId = `collapsible-btn-${rid}`;

  return (
    <div
      data-testid={testId}
      data-open={open}
      className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] transition-colors"
    >
      <button
        id={btnId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--rg-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)]/40"
      >
        {icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[var(--c-primary)]">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[var(--text)]">{title}</span>
          {/* 原为 truncate：窄屏会把摘要截成半句（U-3 的次生风险）。改为最多两行、按字折行，
              既保持收起态高度可控，又不再出现「AI 会尽力帮你，但可能…」这种断句。 */}
          {summary && !open && (
            <span className="mt-0.5 block line-clamp-2 text-[12px] leading-snug text-[var(--text-2)]">{summary}</span>
          )}
        </span>
        <ChevronDown
          size={16}
          className="shrink-0 text-[var(--text-3)] transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={btnId}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-[var(--border-2)] px-4 py-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
