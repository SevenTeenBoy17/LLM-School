"use client";

// 共享迷你折线图（评审 P2：合并 Leaderboard / class 两份重复实现，并统一修复单点/空数组除零）。
import { useId } from "react";

export function Sparkline({
  data, width = 220, height = 44, withArea = false, ariaLabel,
}: {
  data: number[]; width?: number; height?: number; withArea?: boolean; ariaLabel?: string;
}) {
  const uid = useId(); // 稳定且每实例唯一的渐变 id（避免渲染期改模块变量的副作用）
  if (!data.length) return null;
  const pad = 4;
  const denom = Math.max(1, data.length - 1); // 防除零（data.length===1 时）
  const max = Math.max(...data), min = Math.min(...data), span = Math.max(1, max - min);
  const pts = data.map((v, i) => [
    pad + (i * (width - pad * 2)) / denom,
    height - pad - ((v - min) / span) * (height - pad * 2),
  ] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = `${line} L${(width - pad).toFixed(1)} ${height - pad} L${pad} ${height - pad} Z`;
  const last = pts[pts.length - 1];
  const gid = `spark-grad-${uid.replace(/:/g, "")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img"
      aria-label={ariaLabel ?? `折线图，从 ${data[0]} 到 ${data[data.length - 1]}`}>
      {withArea && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--c-edu)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--c-edu)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path d={line} fill="none" stroke="var(--c-edu)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--c-edu)" />
    </svg>
  );
}
