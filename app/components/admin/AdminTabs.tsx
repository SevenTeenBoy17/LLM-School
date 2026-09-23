"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ShieldAlert, Users, LayoutGrid, Bot, GraduationCap, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSOLE_NAV, isNavActive } from "@/lib/nav";

/**
 * AdminTabs — 管理台二级导航。**纯渲染层**：目的地来自 lib/nav.ts 的 CONSOLE_NAV。
 *
 * 此前这里自带一份 TABS 表，是本项目的第三份导航声明，且与侧栏「管理与监控」组不一致：
 * 侧栏有「守护设置」这里没有，这里有「模型管理 / 智能体监控」侧栏没有。
 * 两者内容**不必相同**（侧栏是收敛到 4 项的主导航，这里是控制台内的全量二级导航），
 * 但必须出自同一份声明。
 */
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  BarChart3, ShieldAlert, Users, LayoutGrid, Bot, GraduationCap, Trees,
};

export function AdminTabs() {
  const pathname = usePathname() || "";
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--rg-control-radius)] border border-[var(--border-2)] bg-[var(--card)] p-1 shadow-sm">
      {CONSOLE_NAV.map((t) => {
        const Icon = ICONS[t.icon];
        // 段边界安全：裸 startsWith 会让 /admin/agent 误配 /admin/agents。
        const active = isNavActive(pathname, t.href);
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[52px] items-center gap-1.5 rounded-[12px] px-3 py-1.5 text-[13px] font-semibold transition",
              active
                ? "bg-[var(--c-primary)] text-white shadow-md"
                : "text-[var(--text-2)] hover:bg-[var(--rg-control-bg)] hover:text-[var(--text)]"
            )}
          >
            {Icon && <Icon size={13} />} {t.label}
          </Link>
        );
      })}
    </div>
  );
}
