"use client";

import { useState } from "react";
import Image from "next/image";
import type { ComponentType } from "react";

/** 兜底图标的最小契约。刻意不写 LucideIcon——nav.ts 的图标表声明为
 *  ComponentType<{size?}>（它要能被边缘运行时导入，不牵进 lucide 的类型），
 *  收窄成 LucideIcon 会让导航传不进来。 */
type IconLike = ComponentType<{ size?: number; className?: string }>;
import { cn } from "@/lib/utils";

/**
 * H14 · Soft 3D 卡通图标（学生域）。
 *
 * 为什么只在学生域、只在特定位置用：全站图标审计给出的事实是——学生域 155 处图标里
 * 只有 32 处适合 3D。密集列表、状态指示（勾/叉）、表单控件、11 处 loading 转圈、
 * 以及**全部安全与危机入口**都必须保持线性——3D 的光影会破坏「靠形状对立瞬读」，
 * 而危机路径的严肃性优先于视觉一致性。所以这个组件是**点状使用**的，不是全局替换。
 *
 * 资产缺席时回退传入的线性图标：页面永远不因为一张图没加载就缺一块。
 */
export type PlayIconName =
  | "home" | "chat" | "tools" | "growth" | "badge" | "manor" | "project"
  | "codex" | "ask" | "gem" | "mindmap" | "image" | "summary" | "knowledge" | "explore";

const FILE: Record<PlayIconName, string> = {
  home: "nav-home", chat: "nav-chat", tools: "nav-tools", growth: "nav-growth",
  badge: "nav-badge", manor: "nav-manor", project: "nav-project",
  codex: "codex-book", ask: "action-ask", gem: "progress-gem",
  mindmap: "nav-mindmap", image: "nav-image", summary: "nav-summary",
  knowledge: "nav-knowledge", explore: "nav-explore",
};

/**
 * 导航目的地 → 3D 图标。键是 lib/nav.ts 里的 lucide 图标名。
 * **只给学生**：教师与管理端导航保持线性图标（控制台的扫读效率优先）。
 * 只覆盖学生的 7 个一级目的地——没映射到的项自动回落线性图标，不会缺图。
 */
export const NAV_PLAY_ICON: Record<string, PlayIconName> = {
  Home: "home",
  MessageCircle: "chat",
  Sparkles: "tools",
  GraduationCap: "growth",
  Medal: "badge",
  Trees: "manor",
  ClipboardList: "project",
};

export function PlayIcon({
  name, size = 28, className, fallback: Fallback, float = false,
}: {
  name: PlayIconName;
  /** 渲染盒尺寸（px）。低于 24px 不要用 3D——细节会糊成一坨，改用线性图标。 */
  size?: number;
  className?: string;
  /** 资产加载失败时的线性兜底 */
  fallback?: IconLike;
  /** 悬停浮起（用于可点击的入口卡；纯装饰位不要开） */
  float?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return Fallback
      ? <Fallback size={Math.round(size * 0.62)} className={cn("shrink-0 text-[var(--play-primary)]", className)} />
      : <span className={cn("inline-block shrink-0 rounded-full bg-[var(--rg-control-bg)]", className)} style={{ width: size, height: size }} aria-hidden />;
  }
  return (
    <Image
      src={`/art/icons/${FILE[name]}.webp`}
      alt="" aria-hidden
      width={size * 2} height={size * 2} unoptimized
      onError={() => setBroken(true)}
      className={cn("shrink-0 object-contain", float && "play-float", className)}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * 页面身份图标。取代此前 7 个学生页**逐字相同**的写法
 * （同一个 44×44 渐变方块 + 白色 20px 线性图标，只换图标名）——那正是「AI 味」的
 * 机械来源：模具一样、图标又是标题的直译，页面之间零身份差异。
 * 现在直接让 3D 图标本身承担身份，去掉底板：13 枚图标各有主色，两页不会再长得一样。
 */
export function PageIcon({ name, fallback }: { name: PlayIconName; fallback?: IconLike }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center">
      <PlayIcon name={name} size={46} fallback={fallback} className="drop-shadow-[0_4px_8px_rgba(91,33,182,0.22)]" />
    </span>
  );
}
