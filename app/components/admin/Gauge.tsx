"use client";

/**
 * Gauge — 270° 半环仪表（UI 文档 §4.1，对标 AIRecruit360 的 92.67% 准确率环）。
 * Console 严肃调：单一品牌蓝渐变弧 + 中心数值。a11y：role="meter"。
 * 动效走 CSS transition，自动受 globals 的 prefers-reduced-motion 约束。
 */
interface GaugeProps {
  value: number;       // 当前值
  max?: number;        // 满值，默认 100
  label: string;       // 中心下方说明
  sub?: string;        // 更小的副说明
  ariaLabel?: string;
}

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
};

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const [x1, y1] = polar(cx, cy, r, start);
  const [x2, y2] = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function Gauge({ value, max = 100, label, sub, ariaLabel }: GaugeProps) {
  const f = Math.max(0, Math.min(1, value / max));
  const S = 200, cx = 100, cy = 100, r = 82, stroke = 16;
  const A0 = 225, SPAN = 270; // 底部留 90° 缺口
  const track = arcPath(cx, cy, r, A0, A0 + SPAN);
  const val = arcPath(cx, cy, r, A0, A0 + SPAN * Math.max(f, 0.0001));

  return (
    <div
      role="meter"
      aria-valuenow={Math.round(value * 10) / 10}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel ?? `${label} ${value}%`}
      className="relative grid place-items-center"
      style={{ width: S, height: S }}
    >
      <svg width={S} height={S} aria-hidden>
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--c-primary)" />
            <stop offset="0.5" stopColor="var(--c-edu)" />
            <stop offset="1" stopColor="var(--c-cyan)" />
          </linearGradient>
        </defs>
        <path d={track} fill="none" stroke="var(--border)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={val}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ transition: "all var(--t-slow) var(--ease-out)" }}
        />
      </svg>
      <div aria-hidden className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-num text-[34px] font-bold leading-none text-[var(--text)]">
            {value}<span className="text-[16px]">%</span>
          </div>
          <div className="mt-1.5 text-[12px] font-semibold text-[var(--text-2)]">{label}</div>
          {sub && <div className="mt-0.5 text-[11px] text-[var(--text-2)]">{sub}</div>}
        </div>
      </div>
    </div>
  );
}
