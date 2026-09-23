"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ChartMount } from "@/components/ui/chart-mount";
import type { DashboardModelShare } from "@/lib/data/dashboardSnapshot";
import { CHART_TOOLTIP_STYLE } from "@/lib/data/chartStyle";
import { EmptyState } from "@/components/common/EmptyState";
import { emptyCopy } from "@/lib/data/emptyStates";

interface ModelDonutProps {
  data: DashboardModelShare[];
  total: number;
}

export function ModelDonut({ data, total }: ModelDonutProps) {
  // 零数据不画图。此处原有一条兜底：data 为空时替换成单元素数组，
  // 该元素名为「暂无调用」、占比写满、计数写一、配色取边框灰。
  // 它会渲染出一个**完整的 100% 环**——形状上与「有数据」完全一致，只有读了图例
  // 才知道那一整圈代表"没有"。UI 调研第二轮把它与 HourHeatmap 的假作息数据
  // 并列为本项目仅有的两处「已发生」的图形层编造。零数据的正确形态是空态，不是假环。
  if (!data.length) {
    const copy = emptyCopy("dashboard.noModelCalls");
    return <EmptyState kind={copy.kind} title={copy.title} description={copy.description} compact />;
  }
  const rows = data;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[160px] w-[160px]">
        <ChartMount ariaLabel="当前后端记录中的模型调用占比环形图">
          {({ width, height }) => (
            <PieChart width={width} height={height}>
              <Pie data={rows} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="count" paddingAngle={2}>
                {/* 描边不是装饰：相邻扇区仅靠 paddingAngle 的空隙区分时，
                    低视力用户在近邻色之间读不出边界（WCAG 1.4.11 非文本对比）。 */}
                {rows.map((d) => (
                  <Cell key={d.name} fill={d.color} stroke="var(--card)" strokeWidth={1} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown, _name: unknown, item: { payload?: DashboardModelShare }) => [
                  `${Number(v).toLocaleString("zh-CN")} 次`,
                  item.payload?.name ?? "模型",
                ]}
                contentStyle={CHART_TOOLTIP_STYLE}
              />
            </PieChart>
          )}
        </ChartMount>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11px] text-[var(--text-3)]">真实调用</div>
            <div className="text-num text-[18px] font-bold">{total.toLocaleString("zh-CN")}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 text-[13px]">
        {rows.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="text-num shrink-0 font-semibold">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
