"use client";

// 教育主题 SVG 配图系统（真生图 API 不可用→自绘矢量兜底）：主题化明暗、响应式、零外部依赖。
// + Reveal：进入淡入的分场景动效包装（纯 CSS keyframes，见 globals.css .reveal-in）。

import type { CSSProperties, ReactNode } from "react";

// 进入淡入（功能页「轻」动效）。delay 用于错峰。
// 刻意不用 motion/rAF/IntersectionObserver：JS 驱动的入场在后台标签页/嵌套滚动容器下
// 可能永不完成，把内容卡在 opacity:0——CSS 动画由合成器推进，永远收敛到可见态；
// reduced-motion 由 globals.css 的 0.01ms 守卫瞬时完成。y 偏移固定 14px（keyframes 内）。
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={className ? `reveal-in ${className}` : "reveal-in"}
      style={delay ? ({ "--reveal-delay": `${delay}s` } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}

// Dashboard 欢迎横幅的装饰主视觉：抽象「校园 + AI 轨道 + 成长曲线」，走品牌渐变，明暗自适应。
// 纯装饰（aria-hidden），不承载信息。
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="eduHeroA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--c-primary-2)" />
          <stop offset="0.5" stopColor="var(--c-edu)" />
          <stop offset="1" stopColor="var(--c-cyan)" />
        </linearGradient>
        <linearGradient id="eduHeroB" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--c-violet)" />
          <stop offset="1" stopColor="var(--c-cyan)" />
        </linearGradient>
        <radialGradient id="eduHeroGlow" cx="0.7" cy="0.35" r="0.7">
          <stop offset="0" stopColor="var(--c-cyan)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--c-cyan)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft glow */}
      <ellipse cx="168" cy="56" rx="86" ry="70" fill="url(#eduHeroGlow)" />

      {/* orbit rings (AI 引力/轨道母题，呼应品牌)；M2 ambient 慢浮动（reduced-motion 自动静止） */}
      <g className="float-soft" stroke="url(#eduHeroA)" strokeWidth="1.6" opacity="0.55" fill="none">
        <ellipse cx="168" cy="72" rx="60" ry="26" />
        <ellipse cx="168" cy="72" rx="60" ry="26" transform="rotate(58 168 72)" />
      </g>
      {/* orbit nodes */}
      <circle cx="168" cy="72" r="12" fill="url(#eduHeroA)" />
      <circle cx="164" cy="68" r="3.4" fill="white" opacity="0.85" />
      <circle cx="226" cy="66" r="4.2" fill="var(--c-gold)" />
      <circle cx="112" cy="86" r="3.4" fill="var(--c-growth)" />
      <circle cx="196" cy="42" r="3" fill="var(--c-violet)" />

      {/* 成长曲线（学情/趋势母题） */}
      <path
        d="M12 132 C 40 132, 48 96, 72 92 S 108 106, 128 78 S 168 40, 196 44"
        stroke="url(#eduHeroB)"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* 书本/知识底座 */}
      <g opacity="0.9">
        <rect x="20" y="120" width="52" height="10" rx="3" fill="url(#eduHeroA)" />
        <rect x="26" y="112" width="52" height="10" rx="3" fill="var(--c-edu)" opacity="0.6" />
        <rect x="32" y="104" width="52" height="10" rx="3" fill="var(--c-cyan)" opacity="0.42" />
      </g>
      {/* spark（错相浮动，与轨道形成呼吸感而非表演感） */}
      <path className="float-soft-2" d="M206 20 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 z" fill="var(--c-gold)" />
    </svg>
  );
}

// 小型学科色点图案（卡片角标/空态点缀用）。
export function DotMotif({ className }: { className?: string }) {
  const cols = ["var(--c-edu)", "var(--c-cyan)", "var(--c-violet)", "var(--c-growth)", "var(--c-gold)"];
  return (
    <svg aria-hidden viewBox="0 0 88 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {cols.map((c, i) => (
        <circle key={i} cx={12 + i * 16} cy={12} r={i === 2 ? 6 : 4} fill={c} opacity={0.8 - i * 0.08} />
      ))}
    </svg>
  );
}
