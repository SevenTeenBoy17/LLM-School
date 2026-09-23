"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, MessageCircle, LayoutGrid, BookOpen, Bot, BarChart3, ShieldCheck, ShieldAlert, Users, LogOut, ChevronDown, Sparkles, GraduationCap, LineChart, FlaskConical, FileText, Users2, Archive, Medal, Trees, ClipboardList, SlidersHorizontal, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/store/useUserStore";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { BrandLogo } from "@/components/common/BrandLogo";
import { activeNavHref, navFor, type NavGroup } from "@/lib/nav";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { PlayIcon, NAV_PLAY_ICON } from "@/components/common/PlayIcon";
import { TeacherNavIcon, hasTeacherNavIcon } from "@/components/common/TeacherNavIcon";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";
import { PanelResizeHandle, usePersistentPanelWidth } from "@/components/shell/PanelResizeHandle";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * 图标解析表：nav.ts 存**字符串名**（它被 proxy.ts 的边缘运行时导入，不能牵进 React）。
 * 这里用显式映射而不是 `import * as Icons` —— 后者会把整个 lucide 打进包，
 * 而 Sidebar 在每一页都渲染；显式表既可 tree-shake，缺项也是可门禁的。
 */
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Home, LineChart, MessageCircle, Sparkles, BookOpen,
  FlaskConical, FileText, Users2, Archive,
  LayoutGrid, Bot, GraduationCap, BarChart3, ShieldCheck, ShieldAlert, Users,
  Medal, Trees, ClipboardList, SlidersHorizontal,
};

const PRIMARY_SIDEBAR_PREFERENCE_EVENT = "eduai:primary-sidebar-preference";
const primarySidebarPreferenceMemory = new Map<string, boolean>();

function subscribePrimarySidebarPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PRIMARY_SIDEBAR_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PRIMARY_SIDEBAR_PREFERENCE_EVENT, onChange);
  };
}

function readPrimarySidebarPreference(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "collapsed") return true;
    if (stored === "expanded") return false;
  } catch {
    // 受限浏览器中退回当前页面内存态。
  }
  return primarySidebarPreferenceMemory.get(key) ?? false;
}

function writePrimarySidebarPreference(key: string, collapsed: boolean) {
  primarySidebarPreferenceMemory.set(key, collapsed);
  try {
    window.localStorage.setItem(key, collapsed ? "collapsed" : "expanded");
  } catch {
    // 本地存储不可用时，当前页面仍可正常折叠和恢复。
  }
  window.dispatchEvent(new Event(PRIMARY_SIDEBAR_PREFERENCE_EVENT));
}

// H2（2026-08-19 用户拍板）：campus 侧栏由深靛蓝渐变改为与 console 同族的白霜浅色——
// 全部复用 console 已过门禁的令牌类（对比度/色板断言零新增），admin 侧样式零变化。
export function Sidebar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const user = useUserStore();
  // 导航分组按**服务端角色**渲染：store 是展示信息（姓名/头像）的镜像，不作权限真相。
  const sessionRole = useSessionRole();
  const isConsole = pathname.startsWith("/admin");
  const sidebarPreferenceKey = `eduai.shell.sidebar.v1.${isConsole ? "admin" : sessionRole}`;
  const sidebarWidthPreferenceKey = `eduai.shell.sidebar-width.v1.${isConsole ? "admin" : sessionRole}`;
  const sidebarDefaultWidth = isConsole ? 204 : 244;
  const sidebarMinWidth = isConsole ? 184 : 208;
  const sidebarMaxWidth = isConsole ? 300 : 320;
  const readSidebarPreference = useCallback(
    () => readPrimarySidebarPreference(sidebarPreferenceKey),
    [sidebarPreferenceKey]
  );
  const collapsed = useSyncExternalStore(
    subscribePrimarySidebarPreference,
    readSidebarPreference,
    () => false
  );
  const setCollapsed = useCallback(
    (value: boolean) => writePrimarySidebarPreference(sidebarPreferenceKey, value),
    [sidebarPreferenceKey]
  );
  const sidebarWidth = usePersistentPanelWidth({
    storageKey: sidebarWidthPreferenceKey,
    defaultWidth: sidebarDefaultWidth,
    minWidth: sidebarMinWidth,
    maxWidth: sidebarMaxWidth,
  });
  // 目的地集合由 nav.ts 统一产出——MobileNav 调的是同一个函数，
  // 「桌面与移动目的地一致」这条门禁断言才不是恒真的装饰。
  const visibleNav = navFor(sessionRole);
  const currentNavHref = activeNavHref(pathname, visibleNav);

  // S1 分组折叠态：教师默认展开「教学」、科研默认展开「教研」，其余收起；
  // 当前路由所在分组强制展开（导航不会把用户所在位置藏起来）。
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    teaching: sessionRole !== "researcher",
    research: sessionRole === "researcher",
    tools: false,
    // F7 学生三组：成长默认展开（高频回访面），项目收起（有 NEW 徽标引导）
    "student-growth": true,
    "student-project": false,
  }));

  // F7：学生积分余额（个人卡上的庄园全局入口）。展示性数据，失败静默不占位。
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => {
    if (sessionRole !== "student") return;
    let alive = true;
    fetch("/api/points").then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setPoints(d.balance); })
      .catch(() => { /* 静默：余额是锦上添花，不该让侧栏报错 */ });
    return () => { alive = false; };
  }, [sessionRole]);
  const groupHasActive = (g: NavGroup) =>
    g.items.some((it) => it.href === currentNavHref);
  const isGroupOpen = (g: NavGroup) =>
    !g.collapsible || (openGroups[g.id] ?? false) || groupHasActive(g);


  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    // persist 镜像不在这里清：SessionIdentityProvider 的 effect 会立刻用旧的
    // 服务端身份写回去（shell layout 此刻还没重渲）。清理点在登录页挂载时。
    router.push("/login");
  };

  return (
    <aside
      id="primary-app-sidebar"
      data-testid="primary-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      aria-label={collapsed ? "主导航图标坞" : "主导航面板"}
      style={{
        width: collapsed ? 72 : sidebarWidth.width,
        flexBasis: collapsed ? 72 : sidebarWidth.width,
      }}
      className={cn(
        "app-sidebar sticky top-0 hidden h-dvh min-h-0 self-start lg:flex shrink-0 flex-col overflow-hidden transition-colors duration-200",
        collapsed
          ? "border-r border-[var(--border-2)] bg-[var(--rail-bg)] p-2 pb-3 text-[var(--text-2)] backdrop-blur-md"
          : isConsole
          ? "border-r border-[var(--border-2)] bg-[var(--rail-bg)] p-3 pb-4 text-[var(--text-2)] shadow-none backdrop-blur-md"
          : "border-r border-[var(--border-2)] bg-[var(--rail-bg)] p-5 pb-4 text-[var(--text-2)] backdrop-blur-md"
      )}
    >
      {!collapsed && (
        <PanelResizeHandle
          testId="primary-sidebar-resize-handle"
          label="调整主导航宽度"
          edge="end"
          width={sidebarWidth.width}
          minWidth={sidebarWidth.minWidth}
          maxWidth={sidebarWidth.maxWidth}
          onResize={sidebarWidth.resize}
          onCommit={sidebarWidth.commit}
          onReset={sidebarWidth.reset}
        />
      )}
      <div className={cn("relative flex shrink-0", collapsed ? "flex-col items-center gap-2 pb-3" : "items-center justify-between gap-2", isConsole && !collapsed ? "pb-4" : !collapsed ? "pb-5" : "")}>
        {collapsed ? (
          <BrandLogo size={36} withText={false} textTone="dark" opacity={0.96} />
        ) : isConsole ? (
          <div className="flex items-center gap-2.5 rounded-[12px] px-1.5 py-1">
            <BrandLogo size={34} withText={false} textTone="dark" opacity={0.92} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-bold text-[var(--text)]">EduAI Prism</div>
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">Console</div>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <BrandLogo size={38} textTone="dark" />
          </div>
        )}
        <button
          type="button"
          data-testid="primary-sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "展开主导航" : "收起主导航为图标坞"}
          aria-expanded={!collapsed}
          aria-controls="primary-app-sidebar-navigation"
          title={collapsed ? "展开主导航" : "收起主导航"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[var(--border-2)] bg-[var(--rg-control-bg)] text-[var(--text-2)] shadow-[0_3px_10px_rgba(56,76,110,0.08)] transition-colors hover:bg-[var(--rg-control-hover)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-focus)]"
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden /> : <PanelLeftClose size={18} aria-hidden />}
        </button>
      </div>

      {/* 导航占满账户区上方的剩余高度，溢出时独立滚动；内边距保留焦点环空间。 */}
      <nav id="primary-app-sidebar-navigation" aria-label="主导航" className={cn(
        "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain",
        collapsed ? "primary-sidebar-icon-nav" : "-mx-[4px] px-[4px] py-[4px]"
      )}>
      {visibleNav.map((group) => (
        <div key={group.id} className="relative">
          {!collapsed && group.collapsible ? (
            <button
              type="button"
              aria-expanded={isGroupOpen(group)}
              onClick={() => setOpenGroups((cur) => ({ ...cur, [group.id]: !isGroupOpen(group) }))}
              // 折叠控件的可发现性是这类导航被反复点名的失败点：分组 header 原先
              // 没有 min-height（内容高约 27px）、箭头只有 12px，看起来像一行标签
              // 而不是可按的东西。命中区提到 44px **绝对像素**（不用 rem——rem 会
              // 随 fontScale 0.85 档缩到 37px），箭头 12→16px。
              className={cn(
                "flex min-h-[44px] w-full items-center gap-1.5 px-3 pb-1.5 pt-3 text-left text-[11px] uppercase tracking-[1.5px] transition-colors",
                "text-[var(--text-3)] hover:text-[var(--text-2)]"
              )}
            >
              <span className="flex-1">{group.section}</span>
              <ChevronDown size={16} className="transition-transform duration-200" style={{ transform: isGroupOpen(group) ? "none" : "rotate(-90deg)" }} />
            </button>
          ) : !collapsed ? (
            <div className={cn("px-3 pb-1.5 pt-3 text-[11px] uppercase tracking-[1.5px]", "text-[var(--text-3)]")}>{group.section}</div>
          ) : null}
          {(collapsed || isGroupOpen(group)) && group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.href === currentNavHref;
            // 学生与教师共用软 3D 语汇，但使用独立图集。教师图标按 nav id 映射，
            // 因而「课题与论文」和「课件工坊」不会再共用同一枚 FileText 图标。
            // 管理控制台仍保持线性图标，严肃操作与高密度扫描不受影响。
            const play = sessionRole === "student" ? NAV_PLAY_ICON[item.icon] : undefined;
            const teacherIconName = !isConsole
              && (sessionRole === "teacher" || sessionRole === "researcher")
              && hasTeacherNavIcon(item.id)
              ? item.id
              : null;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "sidebar-link relative my-0.5 flex min-h-[52px] items-center rounded-[12px] text-[14px] transition-colors",
                  collapsed ? "mx-auto h-[52px] w-[52px] justify-center p-0" : "gap-3 px-3 py-2.5",
                  active
                    ? play
                      ? "bg-[var(--accent-tint)] font-semibold text-[var(--accent)]"
                      : "bg-[var(--c-edu)] text-white shadow-[0_8px_18px_rgba(10,132,255,0.22)]"
                    : "text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)]"
                )}
              >
                {active && (
                  <span
                    className="absolute top-2 bottom-2 w-[3px] rounded-r-md"
                    /* 选中态左侧竖条：原为青→紫渐变的固定 hex。改走 --accent-focus，
                       于是它在 console（教师靛蓝）与 campus（学生钴蓝）两个 register 里
                       自动跟随各自的强调色，而不是两边都顶着同一条外来渐变。 */
                    style={{ background: "var(--accent-focus)", left: collapsed ? "-10px" : "-4px" }}
                  />
                )}
                <span className={collapsed ? "primary-sidebar-icon-slot" : "contents"} aria-hidden="true">
                  {play ? (
                    <PlayIcon name={play} size={26} fallback={Icon} />
                  ) : item.id === "school-resources" ? (
                    <SchoolResourceIcon name="library" size={32} />
                  ) : teacherIconName ? (
                    <TeacherNavIcon name={teacherIconName} size={32} active={active} fallback={Icon} />
                  ) : Icon ? (
                    <Icon size={17} />
                  ) : null}
                </span>
                <span className={collapsed ? "sr-only" : "flex-1"}>{item.label}</span>
                {item.badge && (
                  <span className={cn(collapsed ? "sr-only" : "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold", "bg-[var(--info-bg)] text-[var(--info-ink)]")}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      </nav>

      <div className={cn("shrink-0", collapsed ? "mt-auto pt-2" : "mt-[12px]")}>
        {/* F7：积分余额 + 庄园全局入口（规格 §IA 底部个人卡）——只学生可见，纯本人数据 */}
        {!collapsed && sessionRole === "student" && points !== null && (
          <Link href="/student/manor"
            className={cn("mb-2 flex items-center justify-between rounded-[12px] px-3 py-2 transition", "bg-[var(--rg-control-bg)] hover:bg-[var(--rg-control-hover)]")}>
            <span className={cn("text-[11px]", "text-[var(--text-3)]")}>我的积分</span>
            <span className={cn("text-[13px] font-semibold", "text-[var(--text)]")}>{points} <span className="font-normal opacity-60">→ 庄园</span></span>
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full">
            <div className={cn("relative flex w-full items-center rounded-[12px] transition", collapsed ? "h-[52px] justify-center p-1" : "gap-3 p-2.5", "bg-[var(--rg-control-bg)] hover:bg-[var(--rg-control-hover)]")}>
              <div
                /* 头像块原为金色渐变配棕字。除了是裸 hex，它在琥珀那一端的对比度只有
                   **4.36:1**——13px 粗体不算 WCAG 的「大字」，要求 4.5:1，属边缘不达标。
                   改为强调色底 + 白字后：教师端 7.9:1 / 学生端 5.12:1，两端都过 AA。
                   （注释里刻意不写具体 hex：色门是全文件扫描，注释中的字面量同样计数。） */
                className="grid h-9 w-9 place-items-center rounded-[12px] text-white font-bold text-[13px]"
                style={{ background: "var(--accent-focus)" }}
              >
                {user.avatarLetter}
              </div>
              <div className={cn("flex flex-col text-left leading-tight min-w-0", collapsed && "sr-only")}>
                <span className={cn("text-[13px] font-semibold truncate", "text-[var(--text)]")}>{user.name}</span>
                <span className={cn("text-[11px] truncate", "text-[var(--text-3)]")}>{user.department}</span>
              </div>
              {!collapsed && <ChevronDown size={14} className="ml-auto opacity-60" />}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuLabel>个人</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <Users size={14} className="opacity-70" /> 个人中心
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/profile?tab=prefs")}>
              <SlidersHorizontal size={14} className="opacity-70" /> 偏好与外观
            </DropdownMenuItem>
            {/* 切换身份抽成共用组件：Topbar 的账户下拉也用它，窄屏才有入口
                （侧栏是 hidden lg:flex）。生产环境由服务端 flag 决定不渲染，
                不再摆 5 个点了必然 403 的死控件。 */}
            <RoleSwitcher />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut size={14} className="opacity-70" /> 退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
