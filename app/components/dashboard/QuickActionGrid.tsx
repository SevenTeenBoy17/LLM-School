"use client";

import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DashboardQuickAction } from "@/lib/data/dashboardSnapshot";
import { gradientCss } from "@/lib/data/gradientKeys";
import { TeacherFeatureIcon, type TeacherNavIconName } from "@/components/common/TeacherNavIcon";

interface QuickActionGridProps {
  actions: DashboardQuickAction[];
}

const QUICK_ACTION_ICONS: Record<string, TeacherNavIconName> = {
  lesson: "research-courseware",
  quiz: "prompts",
  feedback: "agent",
  knowledge: "knowledge",
  class: "class",
  integrity: "manor-evidence",
};

// S1 bento 布局（全站唯一一处 bento，land-book 实证：bento 只用于「能力总览」时刻）。
//
// 主界面重构第二批修正：hero 原为 md 下 1 列 ×2 行，三列网格里 6 项的铺法是
// hero(2格) + 5 小卡 → 第三行只有一张小卡、左右都是空洞（孤儿卡，实拍可见）。
// 改为 **2×2**：hero(4格) + 右列 2 + 底行 3 = 6 项完美铺满零空洞。
// ⚠️ 这个铺法假设 actions 恰为 6 项（当前后端契约）；数量变化时 grid-flow-dense
// 会回填空洞、末卡跨列规则兜底奇数行，退化是均匀网格而不是烂尾。
// ≤sm 两列：hero 占满首行（不再 ×2 行——窄屏纵向空间贵），奇数张小卡时末卡跨双列。
export function QuickActionGrid({ actions }: QuickActionGridProps) {
  const router = useRouter();
  return (
    <div className="grid grid-flow-dense grid-cols-2 gap-3 md:grid-cols-3 md:[grid-auto-rows:minmax(82px,auto)]">
      {actions.map((q, i) => {
        const Icon = (Icons as unknown as Record<string, LucideIcon>)[q.icon];
        const featureIcon = QUICK_ACTION_ICONS[q.id];
        const isHero = i === 0;
        // 移动端两列下，hero 后剩奇数张小卡时最后一张会孤儿成行——让它跨双列收平。
        const isTrailingOdd = !isHero && i === actions.length - 1 && (actions.length - 1) % 2 === 1;
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => router.push(q.seed ? `${q.href}?seed=${encodeURIComponent(q.seed)}` : q.href)}
            data-testid={`dashboard-quick-${q.id}`}
            className={
              "teacher-feature-surface surface-card card-lift group relative overflow-hidden text-left" +
              (isHero
                ? " col-span-2 flex min-h-[120px] flex-col justify-between p-5 md:col-span-2 md:row-span-2"
                : isTrailingOdd
                  ? " col-span-2 min-h-[82px] p-3.5 md:col-span-1"
                  : " min-h-[82px] p-3.5")
            }
          >
            {isHero && (
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "var(--grad-primary)" }} />
            )}
            <div className={isHero ? "relative flex flex-col gap-3" : "flex flex-col items-start gap-2"}>
              {featureIcon ? (
                <TeacherFeatureIcon name={featureIcon} size={isHero ? 50 : 40} fallback={Icon} />
              ) : (
                <div
                  className={`grid shrink-0 place-items-center rounded-[12px] text-white shadow-md transition-transform group-hover:scale-110 ${isHero ? "h-12 w-12" : "h-10 w-10"}`}
                  style={{ backgroundImage: gradientCss(q.gradient) }}
                >
                  {Icon && <Icon size={isHero ? 22 : 18} />}
                </div>
              )}
              <div className="min-w-0">
                <div className={`font-semibold text-[var(--text)] ${isHero ? "text-[14px]" : "text-[14px]"}`}>{q.title}</div>
                <div className={`mt-0.5 text-[12px] leading-snug text-[var(--text-2)] ${isHero ? "" : "line-clamp-2"}`}>{q.desc}</div>
              </div>
            </div>
            {isHero && <span className="relative mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)]">开始备课 →</span>}
          </button>
        );
      })}
    </div>
  );
}
