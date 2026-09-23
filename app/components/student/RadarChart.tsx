"use client";

import { useEffect, useState } from "react";

/**
 * W-B2 · 课堂雷达（规格红线 R2/R6）。
 * 数据来自 /api/growth/radar，五维口径由服务端写死（可复算）。
 * null 维=「暂无数据」：轴保留但画虚线、标签置灰，多边形只在 ≥3 个有值维时绘制——
 * 缺数据的形状诚实地缺角，绝不用 0 或均值补位画出一张「看起来完整」的图。
 */

export interface RadarDim { key: string; label: string; value: number | null; detail: string }

export function RadarChart({ studentId }: { studentId?: string }) {
  const [dims, setDims] = useState<RadarDim[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/growth/radar${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setDims(j.dims); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [studentId]);

  if (error) return <p className="text-[13px] text-[var(--text-2)]">雷达数据加载失败，稍后再试。</p>;
  if (!dims) return <p className="text-[13px] text-[var(--text-3)]">正在加载雷达数据…</p>;

  const n = dims.length;
  const cx = 130, cy = 120, R = 86;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r] as const;
  const filled = dims.filter((d) => d.value !== null).length;
  const polygon = filled >= 3
    ? dims
        .map((d, i) => (d.value === null ? null : pt(i, R * Math.max(0.04, d.value))))
        .filter((p): p is readonly [number, number] => p !== null)
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ")
    : "";

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <svg viewBox="0 0 260 240" className="mx-auto w-full max-w-[280px]" role="img" aria-label="课堂雷达图">
        {[0.33, 0.66, 1].map((ring) => (
          <polygon
            key={ring}
            points={dims.map((_, i) => pt(i, R * ring).map((v) => v.toFixed(1)).join(",")).join(" ")}
            fill="none" stroke="var(--border-2)" strokeWidth="1"
          />
        ))}
        {dims.map((d, i) => {
          const [x, y] = pt(i, R);
          return (
            <line key={d.key} x1={cx} y1={cy} x2={x} y2={y}
              stroke={d.value === null ? "var(--border-2)" : "var(--border)"}
              strokeDasharray={d.value === null ? "3 3" : undefined} strokeWidth="1" />
          );
        })}
        {polygon && (
          <polygon points={polygon} fill="var(--c-edu)" fillOpacity="0.16" stroke="var(--c-edu)" strokeWidth="1.5" />
        )}
        {dims.map((d, i) => {
          const [x, y] = pt(i, R + 18);
          return (
            <text key={d.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              className="fill-[var(--text-2)]" fontSize="12"
              opacity={d.value === null ? 0.5 : 1}>
              {d.label}{d.value === null ? "·暂无" : ""}
            </text>
          );
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {dims.map((d) => (
          <li key={d.key} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className={d.value === null ? "text-[var(--text-3)]" : "text-[var(--text)]"}>{d.label}</span>
            <span className="text-right text-[12px] text-[var(--text-2)]">
              {d.value === null ? "暂无数据" : `${Math.round(d.value * 100)}%`} · {d.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
