"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useUserStore } from "@/lib/store/useUserStore";
import { canAccessClass, homeFor } from "@/lib/nav";

/**
 * 班级学情守卫（评审 P1-3 + 苏格拉底裁决）：/class 含其他学生的实名掌握度，学生绝不可访问。
 * 与 admin/layout 同模式：默认拒绝 + 水合中性加载态，绝不在首帧渲染他人 PII。
 * 允许：teacher/researcher/admin/college-admin；拒绝：student（重定向回 /learn）。
 */
export default function ClassLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const role = useUserStore((s) => s.role);
  const [mounted, setMounted] = useState(false);
  const allowed = canAccessClass(role); // 白名单 default-deny（评审 P1）：仅任教角色可见全班实名诊断

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect -- 有意挂载门，杜绝 SSR 默认角色误放行
    if (!allowed) router.replace(homeFor(role));
  }, [allowed, role, router]);

  if (!mounted || !allowed) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-[var(--text-3)]" role="status" aria-live="polite">
        <Loader2 size={18} className="mr-2 animate-spin" /> 正在校验访问权限…
      </div>
    );
  }
  return <>{children}</>;
}
