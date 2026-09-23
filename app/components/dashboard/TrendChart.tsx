"use client";

import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { ChartMount } from "@/components/ui/chart-mount";
import type { DashboardTrend } from "@/lib/data/dashboardSnapshot";
import { CHART_TOOLTIP_STYLE } from "@/lib/data/chartStyle";
import { chartColor } from "@/lib/data/gradientKeys";

interface TrendChartProps {
  trend: DashboardTrend;
}

export function TrendChart({ trend }: TrendChartProps) {
  return (
    <div className="h-[240px]">
      <ChartMount ariaLabel={`最近 7 日趋势图，展示${trend.primaryLabel}与${trend.secondaryLabel}`}>
        {({ width, height }) => (
          <AreaChart width={width} height={height} data={trend.data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="dashPrimary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={chartColor(0)} stopOpacity={0.32} />
                <stop offset="1" stopColor={chartColor(0)} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dashSecondary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={chartColor(1)} stopOpacity={0.28} />
                <stop offset="1" stopColor={chartColor(1)} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border-2)" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="day" stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {/* type="linear" 而非 monotone：样条会在稀疏或缺口数据点之间
                生成真实数据里不存在的起伏峰谷，属图形层面的编造。
                dot 让真实测点可见——两点之间那条线是连线，不是观测。 */}
            <Area type="linear" dataKey="primary" name={trend.primaryLabel} stroke={chartColor(0)} strokeWidth={2.2} fill="url(#dashPrimary)" dot={{ r: 2, strokeWidth: 0 }} />
            <Area type="linear" dataKey="secondary" name={trend.secondaryLabel} stroke={chartColor(1)} strokeWidth={2.2} fill="url(#dashSecondary)" dot={{ r: 2, strokeWidth: 0 }} />
          </AreaChart>
        )}
      </ChartMount>
    </div>
  );
}
