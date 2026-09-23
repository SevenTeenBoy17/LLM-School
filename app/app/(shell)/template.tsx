// M7 路由入场帧（S0）：template 每次客户端导航都会重新挂载，.page-enter 的
// 纯 CSS keyframe（280ms fade + 6px 上浮）随之自动重播——零 JS、无 rAF/View Transitions 依赖。
// 教学↔教研板块切换、学生端 4 入口切换共用此帧；reduced-motion 由全局 0.01ms 守卫瞬时完成。
import type { ReactNode } from "react";

export default function ShellTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter flex min-w-0 flex-1">{children}</div>;
}
