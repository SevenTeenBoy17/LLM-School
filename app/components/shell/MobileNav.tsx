"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, MessageCircle, LayoutGrid, BookOpen, Bot, Sparkles,
  BarChart3, ShieldCheck, ShieldAlert, Users, GraduationCap, LineChart,
  FlaskConical, FileText, Users2, Archive,
  Medal, Trees, ClipboardList, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/common/BrandLogo";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { activeNavHref, navFor } from "@/lib/nav";
import { PlayIcon, NAV_PLAY_ICON } from "@/components/common/PlayIcon";
import { TeacherNavIcon, hasTeacherNavIcon } from "@/components/common/TeacherNavIcon";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";

/**
 * MobileNav — 窄屏抽屉导航。**纯渲染层**：目的地来自 lib/nav.ts 的 navFor()，
 * 与 Sidebar 调的是同一个函数。
 *
 * 此前这里自带一份 NAV 表，与 Sidebar 那份**内容不同**，造成三处真实的功能不可达：
 *   · 学生：手机上打不开「成长」(/student/growth) 与「AI 工具」(/student/tools)，
 *     却多出「提示词中心」「知识库」两个生产者入口（与 S2 学生端收敛策略相反）；
 *   · 教师/科研：整个「教研」分组四项全缺；
 *   · 管理员：缺「守护设置」——未成年人保护的配置入口。
 * 没有任何一处设计记录说过要在小屏藏掉这些。这是两份表各自演化的漂移。
 *
 * 第二处修正：角色来源。原先读 `useUserStore((s) => s.role)`——那是**客户端 persist
 * 镜像**，而 Sidebar 读的是 `useSessionRole()`（服务端会话）。两者在两种情况下会分叉：
 * 登出后 persist 未清（默认 role 为 teacher），以及服务端切角色后镜像滞后。
 * 渲染哪些入口虽然不等于授予权限（proxy.ts 才是准入真相），但拿错角色会让学生
 * 首帧看到教师导航，点进去再被 307 弹回——既暴露了系统里存在哪些能力，也是坏体验。
 * 统一到服务端会话角色。
 */
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Home, LineChart, MessageCircle, Sparkles, BookOpen,
  FlaskConical, FileText, Users2, Archive,
  LayoutGrid, Bot, GraduationCap, BarChart3, ShieldCheck, ShieldAlert, Users,
  Medal, Trees, ClipboardList, SlidersHorizontal,
};

export function MobileNav() {
  const pathname = usePathname() || "";
  const role = useSessionRole();
  const groups = navFor(role);
  const currentNavHref = activeNavHref(pathname, groups);

  return (
    <nav aria-label="主导航" className="flex h-full flex-col p-5 text-[var(--text-2)]">
      <div className="pb-5">
        <BrandLogo textTone="dark" />
      </div>

      {/* 抽屉里保留分组标题：目的地变多之后（教师从 7 项到 11 项），
          无分组的一长条列表会退化成逐行阅读。这里不做折叠——抽屉本身
          已经是一层折叠，再叠一层会把「安全求助在哪」这类问题变复杂。 */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="px-3 pb-1 text-[11px] uppercase tracking-[1.5px] text-[var(--text-3)]">
              {group.section}
            </div>
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === currentNavHref;
              // 桌面与移动共享同一套学生/教师 3D 图标映射；管理端保持线性。
              const play = role === "student" ? NAV_PLAY_ICON[item.icon] : undefined;
              const teacherIconName = (role === "teacher" || role === "researcher")
                && hasTeacherNavIcon(item.id)
                ? item.id
                : null;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // min-h 用**绝对像素**：min-h-12 是 3rem，在 14px 根字号下只有 42px，
                    // 而 fontScale 最小档（0.85）会把它压到约 35.7px。命中区不能随
                    // 用户的字号偏好缩水——这正是项目「触达面积一律用绝对像素」的由来。
                    "sidebar-link flex min-h-[48px] items-center gap-3 rounded-[12px] px-3 py-3 text-[14px]",
                    active
                      ? play
                        ? "bg-[var(--accent-tint)] font-semibold text-[var(--accent)]"
                        : "bg-[var(--c-edu)] text-white"
                      : "text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)]"
                  )}
                >
                  {play ? (
                    <PlayIcon name={play} size={28} fallback={Icon} />
                  ) : item.id === "school-resources" ? (
                    <SchoolResourceIcon name="library" size={32} />
                  ) : teacherIconName ? (
                    <TeacherNavIcon name={teacherIconName} size={32} active={active} fallback={Icon} />
                  ) : Icon ? (
                    <Icon size={18} />
                  ) : null}
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-[var(--info-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--info-ink)]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
