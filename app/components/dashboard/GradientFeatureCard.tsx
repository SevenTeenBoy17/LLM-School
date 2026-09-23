"use client";

/**
 * GradientFeatureCard — Medita「支付卡」式渐变特性卡（UI 文档 §4.2）。
 * 用于首页右栏「今日 AI 额度」等高光信息，提供 navy+amber 双调里的"单暖强调"。
 * 装饰透明圆 + 白字 + 进度条；纯 CSS，无图片资产。
 */
import type { LucideIcon } from "lucide-react";
import { gradientCss } from "@/lib/data/gradientKeys";

interface GradientFeatureCardProps {
  title: string;
  value: string;        // 主数值，如 "2,840 / 4,000 次"
  caption?: string;     // 数值下小字
  progress?: number;    // 0–100，进度条
  footnote?: string;    // 底部说明
  icon?: LucideIcon;
  gradient?: string;    // 默认 amber 暖调（Medita 信号色）
}

export function GradientFeatureCard({
  title,
  value,
  caption,
  progress,
  footnote,
  icon: Icon,
  gradient = gradientCss("warm"),
}: GradientFeatureCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[var(--r-xl)] p-4 text-white shadow-[var(--shadow-md)]"
      style={{ backgroundImage: gradient }}
    >
      {/* 装饰透明圆（Medita 卡片手法） */}
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/15" />
      <div aria-hidden className="pointer-events-none absolute -right-2 top-6 h-20 w-20 rounded-full bg-white/10" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white/90">{title}</span>
          {Icon && (
            <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-white/20">
              <Icon size={15} />
            </span>
          )}
        </div>

        <div className="mt-2.5 text-num text-[24px] font-bold leading-none">{value}</div>
        {caption && <div className="mt-1 text-[12px] text-white">{caption}</div>}

        {typeof progress === "number" && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%`, transition: "width var(--t-slow) var(--ease-out)" }}
            />
          </div>
        )}

        {footnote && <div className="mt-2.5 text-[11px] text-white/90">{footnote}</div>}
      </div>
    </div>
  );
}
