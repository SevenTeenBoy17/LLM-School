"use client";

import { ReactNode, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { DemoIdentityBanner } from "@/components/shell/DemoIdentityBanner";
import { OnboardingGuide } from "@/components/onboarding/OnboardingGuide";
import { SafetyHelp } from "@/components/common/SafetyHelp";
import { GuardianShell } from "@/components/student/GuardianShell";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { homeFor } from "@/lib/nav";
import { PlayTabBar, useTabBarVisible } from "./PlayTabBar";
import { cn } from "@/lib/utils";

export function ShellFrame({ children, initialPersona = "teacher" }: { children: ReactNode; initialPersona?: "teacher" | "student" }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  // 角色以**服务端会话**为真相（T5 P1 的修法此前只覆盖了 chat，没覆盖 shell 自身）。
  // 这里关系到 GuardianShell（守护三件套）是否挂载——用客户端 persist store 判定意味着
  // store 被清空/过期时，学生会静默失去守护能力。useSessionRole 内部已回落 store，
  // 因此对未包在 provider 内的场景仍保持既有行为。
  const role = useSessionRole();
  const isAdminRoute = pathname.startsWith("/admin");
  const register = isAdminRoute || role !== "student" ? "console" : "campus";
  const workspace = role === "student" ? "student" : isAdminRoute ? "admin" : "teacher";
  const rootRef = useRef<HTMLDivElement>(null);

  // 未成年人保护：学生不得进入管理端（即便手动输入 URL），重定向回学习探索。
  useEffect(() => {
    if (role === "student" && pathname.startsWith("/admin")) {
      router.replace(homeFor("student"));
    }
  }, [role, pathname, router]);

  // 双基调作用域（S0）：SSR 用服务端会话真相（initialPersona），运行时角色切换后命令式更新
  // DOM 属性——两端渲染一致（无水合告警），切角色也即时换基调。
  const tabBarVisible = useTabBarVisible();

  useEffect(() => {
    const p = role === "student" ? "student" : "teacher";
    if (rootRef.current && rootRef.current.dataset.persona !== p) rootRef.current.dataset.persona = p;
  }, [role]);

  return (
    <div ref={rootRef} data-register={register} data-persona={initialPersona} data-workspace={workspace} className="app-shell flex min-h-screen bg-[var(--bg)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 演示身份横幅在 Topbar **之上**且在文档流内：它推动内容下移而不是覆盖，
            因此不会遮挡 SafetyHelp 浮标（铁律①：安全求助不得被遮挡）。 */}
        <DemoIdentityBanner />
        <Topbar />
        <main id="main" tabIndex={-1}
          className={cn("app-content-shell flex min-w-0 flex-1 outline-none",
            // H14：给底部胶囊导航让出高度，否则页尾内容被压在栏下（窄屏且学生才有该栏）
            tabBarVisible && "pb-[84px] md:pb-0")}>
          {children}
        </main>
      </div>
      <OnboardingGuide />
      {!isAdminRoute && <SafetyHelp />}
      {/* S2 守护三件套：仅学生角色全局挂载（对话/工具/成长共用同一时长池） */}
      {role === "student" && <GuardianShell />}
      <PlayTabBar />
    </div>
  );
}
