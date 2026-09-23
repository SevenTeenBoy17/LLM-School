"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserCog } from "lucide-react";
import { useUserStore } from "@/lib/store/useUserStore";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import {
  subscribeDemoIdentity, readDemoOrigin, readDemoOriginServer, clearDemoSwitch,
} from "@/components/shell/demoIdentity";
import { homeFor, ROLE_LABEL } from "@/lib/nav";
import type { UserRole } from "@/lib/types";

/**
 * DemoIdentityBanner — 「你正处在演示身份里」的常驻提示。
 *
 * 为什么必须常驻而不是一次性 toast：切换身份之后，**全站没有任何东西在提醒你**
 * 现在看到的不是自己的数据。此前唯一的线索是侧栏页脚的姓名文字，而侧栏在
 * <1024px 根本不渲染——手机上切完角色是零反馈的。
 *
 * 一位老师以学生身份浏览时，看到的每一条学情都可能被误当成真实数据带走。
 * Canvas 的 Student View 用「全屏描边 + 底部常驻条 + 显式退出」三重冗余防的正是这个：
 * 让「我不在自己身份里」这件事在任何滚动位置、任何子页面都无法被忽略。
 * 这里取其中最关键的两重——常驻条 + 显式退出——不做全屏描边（会与 data-persona
 * 双基调打架，且描边在窄屏会吃掉本就紧张的横向空间）。
 *
 * 三条约束：
 * · **不可折叠。** 可折叠的提示等于没有提示。
 * · **不遮挡安全求助。** 它是文档流内的一条（不是 fixed），推动 Topbar 下移而非覆盖，
 *   所以不会盖住 SafetyHelp 浮标（铁律①：安全求助不得被遮挡）。
 * · **退出按钮 44×44。** 它是这条横幅存在的意义，不能是一个点不中的小字链接。
 */
export function DemoIdentityBanner() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const sessionRole = useSessionRole();
  // 订阅外部数据源（sessionStorage）而不是在 effect 里 setState：
  // 后者会引起级联渲染，且 sessionStorage 的同标签页写入不发 storage 事件，
  // 用 effect 读一次也追不上 RoleSwitcher 的写入。
  // 服务端快照恒为 null——横幅是提示而非安全披露，晚一帧出现可以接受；
  // 用 SSR 猜值反而会造成水合不一致。
  const recorded = useSyncExternalStore(subscribeDemoIdentity, readDemoOrigin, readDemoOriginServer);
  // 记号等于当前角色 = 已经切回来了，记号是陈旧的。这里**只是不渲染**，
  // 不在渲染期做清理（渲染必须无副作用）；真正的清理在 RoleSwitcher 与 exit 里。
  const origin: UserRole | null = recorded && recorded !== sessionRole ? recorded : null;

  if (!origin) return null;

  const exit = async () => {
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: origin }),
      });
      if (!res.ok) return;
      const { user: u } = await res.json();
      clearDemoSwitch();
      setUser({
        name: u.name,
        role: u.role,
        stage: u.stage,
        department: u.department,
        avatarLetter: u.avatarLetter,
      });
      router.push(homeFor(u.role));
      router.refresh();
    } catch {
      /* 网络异常：横幅留着，用户仍知道自己在演示态 */
    }
  };

  return (
    <div
      data-demo-identity="1"
      role="status"
      className="flex min-h-[var(--hit-row)] shrink-0 items-center gap-3 border-b border-[var(--warn)] bg-[var(--warn-bg)] px-4 py-1.5 text-[13px] text-[var(--warn-ink)] md:px-7"
    >
      <UserCog size={16} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 leading-snug">
        你正在以「{ROLE_LABEL[sessionRole]}」身份浏览（演示切换）。
        <span className="hidden sm:inline">这里显示的不是你自己的数据，也不要把它当作真实学情带走。</span>
      </p>
      <button
        type="button"
        onClick={exit}
        className="inline-flex min-h-[var(--hit-min)] shrink-0 items-center gap-1.5 rounded-[12px] border border-[var(--warn)] px-3 text-[13px] font-semibold transition-colors hover:bg-[var(--warn)]/10"
      >
        <LogOut size={14} aria-hidden />
        退回{ROLE_LABEL[origin]}
      </button>
    </div>
  );
}
