"use client";

/**
 * ProgressRing — 环形进度（UI 文档 §4.1）。Campus 成就/完成度用。
 * a11y：role="meter" + aria-valuenow/min/max + aria-label（UI 文档 §11.4）。
 * 动效：stroke-dashoffset 走 CSS transition —— 自动受 globals 的
 * prefers-reduced-motion 规则约束（无需额外处理）。
 */
interface ProgressRingProps {
  value: number;            // 0–100
  size?: number;            // px
  stroke?: number;          // px
  color?: string;           // 进度色（默认教育蓝）
  trackColor?: string;
  label: string;            // 无障碍标签，如 "本周完成度 86%"
  children?: React.ReactNode; // 圆心内容
}

export function ProgressRing({
  value,
  size = 116,
  stroke = 10,
  color = "var(--c-edu)",
  trackColor = "var(--border)",
  label,
  children,
}: ProgressRingProps) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;

  return (
    <div
      role="meter"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset var(--t-slow) var(--ease-out)" }}
        />
      </svg>
      <div aria-hidden className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
