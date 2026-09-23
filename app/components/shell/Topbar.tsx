"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Search, Bell, HelpCircle, Settings, Menu, LogOut, User, Sun, Moon, Monitor, CheckCheck, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import { CommandPalette } from "./CommandPalette";
import { InlineSearch } from "./InlineSearch";
import { useUserStore } from "@/lib/store/useUserStore";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { apiListNotifications, apiMarkNotification, apiLogout, type NotificationItem } from "@/lib/client/shellApi";
import { metaForPath, ROUTE_META } from "@/lib/nav";

function timeAgo(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  // 最长前缀匹配取代原来的扁平精确匹配表。原表漏掉了**整个 /student 命名空间**、
  // /research/artifacts、/hub/image 以及所有动态段（/prompts/[id]、/prompts/[id]/edit），
  // 这些页面一律落到兜底「EduAI Prism · 学校 AI 平台」——学生在自己的工作区里
  // 顶栏永远显示不出自己在哪一页。表与匹配逻辑都已上提到 lib/nav.ts 单一真相源。
  const { title: main, sub, parent } = metaForPath(pathname);
  const parentTitle = parent ? ROUTE_META[parent]?.title : undefined;
  // 父页名与副标题同名时不重复渲染副标题。实测 /student/tools/image 会读成
  // 「AI 工具 / 画一张图 · AI 工具」——同一个词在一行里出现两次，比不给副标题更差。
  const showSub = sub && sub !== parentTitle;
  const role = useUserStore((s) => s.role);
  const showBoardTabs = role !== "student" && !pathname.startsWith("/admin");
  const onResearch = pathname.startsWith("/research");
  const { theme, setTheme } = useTheme();
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { notifications, unread: u } = await apiListNotifications();
      if (!alive) return;
      setNotifs(notifications);
      setUnread(u);
    })();
    return () => { alive = false; };
  }, []);

  const markOne = async (id: string) => {
    const target = notifs.find((n) => n.id === id);
    if (!target || target.read) return; // 已读则无需操作
    // 乐观：同时更新条目 read 与未读徽标；失败则两者一起回滚，避免「红点消失但徽标不减」的持久发散。
    setNotifs((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    const u = await apiMarkNotification({ id });
    if (u < 0) {
      setNotifs((cur) => cur.map((n) => (n.id === id ? { ...n, read: false } : n)));
      setUnread((v) => v + 1);
    } else setUnread(u);
  };
  const markAll = async () => {
    const prev = notifs;
    const prevUnread = unread;
    setNotifs((cur) => cur.map((n) => ({ ...n, read: true })));
    setUnread(0);
    const u = await apiMarkNotification({ all: true });
    if (u < 0) { setNotifs(prev); setUnread(prevUnread); }
    else setUnread(u);
  };
  const logout = async () => {
    await apiLogout(); // 真正清除服务端会话 cookie，再跳登录页（原实现只跳转、cookie 未清）
    // persist 镜像不在这里清：SessionIdentityProvider 的 effect 会立刻用旧的
    // 服务端身份写回去（shell layout 此刻还没重渲）。清理点在登录页挂载时，
    // 那里才真正处在「没有已认证外壳」的状态。见 app/login/page.tsx。
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="app-topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border-2)] bg-[var(--topbar-bg)] px-4 backdrop-blur-md md:gap-4 md:px-7">
      <CommandPalette />
      <Sheet>
        <SheetTrigger asChild>
          <button className="lg:hidden grid h-[48px] w-[48px] min-w-[48px] shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]" aria-label="打开导航">
            <Menu size={18} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] border-r border-[var(--border-2)] bg-[var(--card)] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Primary mobile navigation for EduAI Prism.</SheetDescription>
          <MobileNav />
        </SheetContent>
      </Sheet>

      {/* 回父页：走 router.push(parent) 而**不是** history.back()。
          两者在用户从外部链接直达深层页时完全不同——back() 会退出本站，
          而用户想要的是「回到那个列表页」。层级只做一级（Polaris backAction 同款），
          多级面包屑在窄屏会把标题挤没。 */}
      {parent && (
        <button
          type="button"
          onClick={() => router.push(parent)}
          aria-label={parentTitle ? `返回${parentTitle}` : "返回上级"}
          className="grid h-[44px] w-[44px] min-w-[44px] shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] transition-colors hover:bg-[var(--rg-control-bg)] hover:text-[var(--text)]"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div className="min-w-0 shrink truncate text-[13px] text-[var(--text-2)]">
        {parentTitle && (
          <>
            <span className="text-[var(--text-3)]">{parentTitle}</span>
            <span className="mx-1.5 text-[var(--text-3)]">/</span>
          </>
        )}
        <strong className="font-semibold text-[var(--text)]">{main}</strong>
        {showSub && (
          <>
            <span className="ml-1.5 text-[var(--text-3)]">·</span>
            <span className="ml-1.5">{sub}</span>
          </>
        )}
      </div>

      {/* S1 教师端「教学 | 教研」板块快切（学生/管理端不显示；active 指示随路由） */}
      {showBoardTabs && (
        <div className="ml-4 hidden shrink-0 items-center rounded-[12px] bg-[var(--rg-control-bg)] p-0.5 text-[12px] sm:inline-flex" role="tablist" aria-label="板块切换">
          <button
            type="button" role="tab" aria-selected={!onResearch}
            onClick={() => router.push("/dashboard")}
            className={`min-h-[36px] rounded-[12px] px-3 transition-colors ${!onResearch ? "bg-[var(--card)] font-semibold text-[var(--text)] shadow-sm" : "text-[var(--text-2)] hover:text-[var(--text)]"}`}
          >教学</button>
          <button
            type="button" role="tab" aria-selected={onResearch}
            onClick={() => router.push("/research")}
            className={`min-h-[36px] rounded-[12px] px-3 transition-colors ${onResearch ? "bg-[var(--card)] font-semibold text-[var(--text)] shadow-sm" : "text-[var(--text-2)] hover:text-[var(--text)]"}`}
          >教研</button>
        </div>
      )}

      {/* H7（用户拍板）：搜索不再单独弹出——桌面原位输入+结果贴挂下方；窄屏图标仍走弹层兜底 */}
      <InlineSearch />

      <div className="flex-1 md:hidden" />

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("eduai:open-search"))}
        className="grid h-[48px] w-[48px] min-w-[48px] shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)] md:hidden"
        aria-label="打开全局搜索"
      >
        <Search size={18} />
      </button>

      <button type="button" onClick={() => toast.info("帮助中心正在整理中，可先查看知识库与提示词中心。")} className="grid h-[48px] w-[48px] min-w-[48px] shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]" aria-label="帮助">
        <HelpCircle size={18} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative grid h-[48px] w-[48px] min-w-[48px] shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]" aria-label={`通知${unread > 0 ? `，${unread} 条未读` : ""}`}>
            <Bell size={18} />
            {unread > 0 && <span className="absolute right-2 top-2 grid h-4 min-w-[16px] place-items-center rounded-full border-2 border-white bg-[var(--c-alert)] px-0.5 text-[9px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[13px] font-semibold">通知</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="inline-flex min-h-[var(--hit-row)] items-center gap-1 rounded-[12px] px-2 text-[12px] text-[var(--c-edu)] hover:bg-[var(--rg-control-bg)]">
                <CheckCheck size={12} /> 全部已读
              </button>
            )}
          </div>
          <DropdownMenuSeparator />
          {notifs.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-[var(--text-3)]">暂无通知</p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              {notifs.map((n) => (
                <button key={n.id} type="button" onClick={() => markOne(n.id)} className="flex min-h-[var(--hit-row)] w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[var(--rg-hover-bg)]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[var(--c-alert)]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-[13px] ${n.read ? "font-normal text-[var(--text-2)]" : "font-semibold"}`}>{n.title}</span>
                      <span className="shrink-0 text-[11px] text-[var(--text-3)]">{timeAgo(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-[1.6] text-[var(--text-2)]">{n.body}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="grid h-[48px] w-[48px] min-w-[48px] shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]" aria-label="设置">
            <Settings size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>账户</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User size={14} className="opacity-70" /> 个人中心
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/profile?tab=prefs")}>
            <SlidersHorizontal size={14} className="opacity-70" /> 偏好与外观
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>主题</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun size={14} className="opacity-70" /> 浅色 {theme === "light" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon size={14} className="opacity-70" /> 深色 {theme === "dark" && "✓"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor size={14} className="opacity-70" /> 跟随系统 {theme === "system" && "✓"}
          </DropdownMenuItem>
          {/* 演示身份切换：Topbar 在所有宽度下都渲染，窄屏也够得着——
              此前它只在 Sidebar 页脚，而侧栏是 hidden lg:flex，手机上根本没有入口。 */}
          <RoleSwitcher />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut size={14} className="opacity-70" /> 退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
