"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, GraduationCap, Medal, Trees } from "lucide-react";
import { PlayIcon } from "@/components/common/PlayIcon";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { cn } from "@/lib/utils";

/**
 * H14 · 学生端底部胶囊导航（仅窄屏 · 仅学生）。
 *
 * 为什么只给学生、只给窄屏：胶囊底栏 + 中央凸起主按钮是**手机 App 的**导航范式，
 * 桌面端已有左侧栏，两套并存等于同一件事给两个入口；教师与管理端是桌面工作台，
 * 底部悬浮栏会挡住数据表格的最后一行。
 *
 * 中央大按钮指向「问 AI」——学生端唯一高频主行动。中央键不是装饰位，
 * 放一个没人按的东西比不放更糟。
 *
 * 与既有汉堡抽屉的关系：抽屉仍在（承载全部目的地与设置），底栏只放 4 个最高频的，
 * 不试图替代它。z 走登记令牌 --z-tabbar(45)：弹层、夜间遮罩、安全求助浮标都在它之上。
 */
const TABS = [
  { href: "/student/home", label: "首页", play: "home", icon: Home },
  { href: "/student/growth", label: "成长", play: "growth", icon: GraduationCap },
  { href: "/student/badges", label: "徽章", play: "badge", icon: Medal },
  { href: "/student/manor", label: "庄园", play: "manor", icon: Trees },
] as const;

/** 底部已被固定输入占据的路由：底栏在这里既遮安全披露脚注、又遮发送键。
 *  这不是审美取舍——render 门 R-G2 实测抓到「no-web-search / upload-scope 两条
 *  白名单披露在 390px 下被浮层遮挡」，安全披露必须可见不被遮挡是硬判据。 */
const BOTTOM_OCCUPIED = ["/chat"];

/** 底栏是否渲染。ShellFrame 的底部留白必须用**同一个判据**——
 *  两处各判各的，就会出现「栏不在但留白还在」把页面撑高（R5 布局守卫实测抓到）。 */
export function useTabBarVisible(): boolean {
  const role = useSessionRole();
  const pathname = usePathname();
  if (role !== "student") return false;
  return !BOTTOM_OCCUPIED.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export function PlayTabBar() {
  const visible = useTabBarVisible();
  const pathname = usePathname();
  if (!visible) return null;

  return (
    <nav aria-label="快捷导航"
      className="fixed inset-x-0 bottom-0 z-[var(--z-tabbar)] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      <div className="relative flex w-full max-w-[420px] items-end justify-between rounded-full bg-[#241B3D] px-3 pb-2 pt-2 shadow-[0_10px_28px_rgba(36,27,61,0.34)]">
        {TABS.slice(0, 2).map((t) => <Tab key={t.href} tab={t} active={pathname === t.href} />)}

        {/* 中央凸起主按钮：问 AI */}
        <Link href="/chat" aria-label="去问 AI"
          className="play-3d play-gloss -mt-7 grid h-14 w-14 shrink-0 place-items-center rounded-full [--lip:#B0347A]"
          style={{ backgroundImage: "var(--play-grad-pp)" }}>
          <PlayIcon name="ask" size={30} />
        </Link>

        {TABS.slice(2).map((t) => <Tab key={t.href} tab={t} active={pathname === t.href} />)}
      </div>
    </nav>
  );
}

function Tab({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  return (
    <Link href={tab.href} aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[44px] min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-full px-1 transition-colors",
        active ? "text-white" : "text-white/55"
      )}>
      <PlayIcon name={tab.play} size={26} fallback={tab.icon} className={cn(!active && "opacity-70 saturate-[0.7]")} />
      <span className="text-[11px] font-semibold leading-none">{tab.label}</span>
    </Link>
  );
}
