import { ReactNode } from "react";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { SessionIdentityProvider } from "@/components/shell/SessionRoleProvider";
import { getSessionUser } from "@/lib/server/session";
import { isProd } from "@/lib/server/env";

export default async function ShellLayout({ children }: { children: ReactNode }) {
  // 双基调作用域的服务端真相（S0）：SSR 首帧即正确（学生=暖调），避免依赖客户端 store 水合造成的首屏错色。
  const user = await getSessionUser();
  const initialPersona = user?.role === "student" ? "student" : "teacher";
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-skip-link)] focus:rounded-[12px] focus:bg-[var(--card)] focus:px-4 focus:py-2.5 focus:text-[13px] focus:font-semibold focus:text-[var(--text)] focus:shadow-[var(--shadow-lg)] focus:ring-2 focus:ring-[var(--c-primary)]"
      >
        跳到主要内容
      </a>
      {/* T5 修复：角色相关 UI 以服务端会话角色为真相，SSR 与客户端首帧一致（消除 mismatch 导致的教师态残留） */}
      <SessionIdentityProvider
        role={user?.role ?? null}
        stage={user?.stage ?? null}
        identity={user ? { name: user.name, department: user.department, avatarLetter: user.avatarLetter } : null}
        // 与 /api/auth/switch-role 的服务端判定同源：生产禁用演示提权，UI 就不该渲染入口。
        roleSwitchEnabled={!isProd()}
      >
        <ShellFrame initialPersona={initialPersona}>{children}</ShellFrame>
      </SessionIdentityProvider>
    </>
  );
}
