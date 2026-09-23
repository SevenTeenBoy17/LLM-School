"use client";

import { Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ChartMount } from "@/components/ui/chart-mount";
import type { DashboardAdminWorkspace } from "@/lib/data/dashboardSnapshot";
import { CHART_TOOLTIP_STYLE } from "@/lib/data/chartStyle";

interface CollegeDistributionChartProps {
  data: DashboardAdminWorkspace["collegeDistribution"];
}

interface SystemHealthProps {
  items: DashboardAdminWorkspace["systemHealth"];
}

export function CollegeDistributionChart({ data }: CollegeDistributionChartProps) {
  return (
    <div className="h-[280px]" role="img" aria-label="按后端用户部门聚合的使用分布柱状图">
      <ChartMount>
        {({ width, height }) => (
          <BarChart width={width} height={height} data={data} layout="vertical" margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" width={102} tick={{ fontSize: 12, fill: "var(--text-2)" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(v: unknown) => [Number(v).toLocaleString("zh-CN"), "账号数"]}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
              {data.map((c, i) => (<Cell key={`${c.name}-${i}`} fill={c.color} />))}
            </Bar>
          </BarChart>
        )}
      </ChartMount>
    </div>
  );
}

export function SystemHealth({ items }: SystemHealthProps) {
  return (
    <div className="space-y-1">
      {items.map((r) => (
        <div key={r.name} className="flex items-center justify-between rounded-[12px] px-2.5 py-2 transition hover:bg-[var(--rg-hover-bg)]">
          <div className="flex items-center gap-2">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              r.state === "online" ? "bg-[var(--c-growth)]" : "bg-[var(--c-gold)]",
            )} />
            <span className="text-[13px] text-[var(--text)]">{r.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-num text-[var(--text-2)]">{r.latency}</span>
            <span className={cn(
              "rounded-full px-2 py-0.5 font-semibold",
              r.state === "online" ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
            )}>
              {r.state === "online" ? "在线" : "繁忙"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
