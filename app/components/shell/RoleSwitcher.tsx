"use client";

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useUserStore } from "@/lib/store/useUserStore";
import { useSessionRole, useRoleSwitchEnabled } from "@/components/shell/SessionRoleProvider";
import { markDemoSwitch, clearDemoSwitch } from "@/components/shell/demoIdentity";
import { homeFor, ROLE_LABEL, SWITCHABLE_ROLES } from "@/lib/nav";
import type { UserRole } from "@/lib/types";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

/**
 * RoleSwitcher — 演示用「切换身份」，Sidebar 页脚与 Topbar 账户下拉共用。
 *
 * 抽出来解决两件事：
 *
 * 1. **移动端此前完全没有切换入口。** 它原先只写在 Sidebar 页脚，而 `<aside>` 是
 *    `hidden lg:flex` —— 小于 1024px 就不存在。Topbar 在所有宽度下都渲染，放进它的
 *    账户下拉，窄屏才够得着。
 *
 * 2. **生产环境不再渲染死控件。** `/api/auth/switch-role` 在生产一律 403，而这里
 *    此前无条件渲染全部 5 个角色项——那是 5 个点了必然失败的按钮，并且向学生
 *    暴露了系统里存在「管理员 / 学院管理员」这两种角色。现在由服务端下发的
 *    `roleSwitchEnabled` 决定是否渲染：无权即不可见。
 *
 * 切换成功才动本地状态：服务端未授权时不改 store、不跳转，杜绝「前端单方面提权」
 * 导致 UI 与 proxy 准入漂移（铁律④）。
 */
export function RoleSwitcher() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const sessionRole = useSessionRole();
  const enabled = useRoleSwitchEnabled();

  if (!enabled) return null;

  const switchRole = async (r: UserRole) => {
    if (r === sessionRole) return;
    try {
      const res = await fetch("/api/auth/switch-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: r }),
      });
      if (!res.ok) return; // 服务端未授权/不可用 → 不改本地状态、不跳转
      const { user: u } = await res.json();
      // 记下「我从哪来」，好让常驻横幅能给出一条回去的路。
      // 切回原始角色时清记号，否则横幅会在用户已经回家之后继续挂着。
      const origin = useUserStore.getState().role;
      if (u.role === origin) clearDemoSwitch();
      else markDemoSwitch(sessionRole);
      setUser({
        name: u.name,
        role: u.role,
        stage: u.stage,
        department: u.department,
        avatarLetter: u.avatarLetter,
      });
      router.push(homeFor(u.role));
      router.refresh(); // 让 shell layout 用新会话重新取服务端身份
    } catch {
      /* 网络异常：保持现状，不前端提权 */
    }
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-[11px] font-normal text-[var(--text-3)]">
        切换身份（演示）
      </DropdownMenuLabel>
      {SWITCHABLE_ROLES.map((r) => (
        <DropdownMenuItem key={r} onSelect={() => switchRole(r)}>
          <span className="flex-1">{ROLE_LABEL[r]}</span>
          {r === sessionRole && <Check size={14} className="text-[var(--c-primary)]" />}
        </DropdownMenuItem>
      ))}
    </>
  );
}
