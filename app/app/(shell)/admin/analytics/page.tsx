"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend } from "recharts";
import { Calendar, Filter, FileText, LineChart, Loader2, RefreshCw } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { KpiCard, type Kpi } from "@/components/admin/KpiCard";
import { HourHeatmap } from "@/components/admin/HourHeatmap";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartMount } from "@/components/ui/chart-mount";
import { Gauge } from "@/components/admin/Gauge";
import { AdoptionFunnel } from "@/components/admin/AdoptionFunnel";
import { CHART_TOOLTIP_STYLE } from "@/lib/data/chartStyle";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";

type Tone = "blue" | "violet" | "cyan" | "green" | "red" | "gold";

interface AnalyticsSnapshot {
  generatedAt: number;
  kpis: Array<{
    id: string;
    label: string;
    value: string;
    delta: string;
    icon: string;
    tone: Tone;
  }>;
  dailyUsage: Array<{ day: string; value: number; tokens: number }>;
  colleges: Array<{ name: string; value: number; color: string }>;
  adoptionFunnel: Array<{ stage: string; value: number; color: string }>;
  aiAccuracy: {
    value: number;
    feedbackCount: number;
    breakdown: Array<{ label: string; pct: number; color: string }>;
  };
  topAgents: Array<{ rank: number; name: string; category: string; calls: number; growth: number; color: string }>;
  costShare: Array<{ name: string; value: number; color: string }>;
  hourHeatmap: number[][];
  systemHealth: Array<{ name: string; state: "online" | "busy"; latency: string }>;
  sourceSummary: {
    users: number;
    chatSessions: number;
    chatMessages: number;
    agents: number;
    kbFiles: number;
    auditRows: number;
    tickets: number;
    feedbackRows: number;
  };
}

/**
 * 语义强调色（**单色**，不是渐变）。KpiCard 从「饱和渐变图标块 + 模糊球」减为
 * 「浅底色块 + 同色图标」后，只需要一个颜色；底色由 color-mix 从同一令牌派生 12%。
 * 六档取自既有语义令牌，不新增色值。
 */
const ACCENTS: Record<Tone, string> = {
  blue: "var(--info)",
  violet: "var(--proc)",
  cyan: "var(--c-cyan)",
  green: "var(--ok)",
  red: "var(--err)",
  gold: "var(--warn)",
};

function kpiFromSnapshot(item: AnalyticsSnapshot["kpis"][number]): Kpi {
  return {
    label: item.label,
    value: item.value,
    delta: item.delta,
    icon: item.icon,
    accent: ACCENTS[item.tone],
  };
}

function generatedAtLabel(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 403 ? "当前账号无权查看后台分析数据" : "后台分析数据加载失败");
      setData(await res.json() as AnalyticsSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "后台分析数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAnalytics();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  const kpis = useMemo(() => (data?.kpis ?? []).map(kpiFromSnapshot), [data?.kpis]);
  const accuracyBadge = data?.aiAccuracy.feedbackCount
    ? `${data.aiAccuracy.feedbackCount.toLocaleString("zh-CN")} 条真实反馈`
    : "暂无反馈";

  return (
    <div data-register="console" className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><LineChart size={20} /></span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">管理与监控中心 · 数据看板</h1>
            <p className="text-[13px] text-[var(--text-2)]">来自真实后端接口的用户、对话、知识库、智能体、安全与反馈运行态势</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="green">后端实时</Badge>
          {data && <span className="text-[12px] text-[var(--text-3)]">刷新于 {generatedAtLabel(data.generatedAt)}</span>}
          <Button type="button" onClick={loadAnalytics} variant="outline" size="sm" className="h-[48px] min-h-[48px] gap-1.5" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} 刷新
          </Button>
          <NotYetAvailable why="当前展示后端近 7 日数据；自定义时间筛选未开通"><Calendar size={13} /> 近 7 日</NotYetAvailable>
          <NotYetAvailable why="当前按账号部门聚合；学院筛选未开通"><Filter size={13} /> 全部部门</NotYetAvailable>
          <NotYetAvailable why="真实数据接口已接入；完整报告导出尚未开通"><FileText size={13} /> 导出报告</NotYetAvailable>
        </div>
      </div>

      <AdminTabs />

      {error ? (
        <Card>
          <CardContent>
            <div role="alert" className="rounded-[12px] bg-[var(--err-bg)] px-3 py-2 text-[13px] font-semibold text-[var(--err-ink)]">
              {error}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading && !data ? (
        <Card>
          <CardContent>
            <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] text-[var(--text-2)]">
              <Loader2 size={16} className="animate-spin" />
              正在读取后端分析数据...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <Reveal className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} kpi={kpi} />
            ))}
          </Reveal>

          <Card>
            <CardHeader>
              <CardTitle>数据来源读回</CardTitle>
              <Badge variant="primary">API /api/admin/analytics</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-[12px] md:grid-cols-4">
                {[
                  ["账号", data.sourceSummary.users],
                  ["会话", data.sourceSummary.chatSessions],
                  ["消息", data.sourceSummary.chatMessages],
                  ["智能体", data.sourceSummary.agents],
                  ["知识库文件", data.sourceSummary.kbFiles],
                  ["审计日志", data.sourceSummary.auditRows],
                  ["安全工单", data.sourceSummary.tickets],
                  ["反馈", data.sourceSummary.feedbackRows],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-[12px] border border-[var(--border-2)] px-3 py-2">
                    <div className="text-[11px] text-[var(--text-3)]">{label}</div>
                    <div className="text-num text-[18px] font-bold text-[var(--text)]">{Number(value).toLocaleString("zh-CN")}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>近 7 日调用趋势</CardTitle>
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">调用次数来自 chat_usage，Token 为 AI 回复文本估算</p>
                </div>
                <Badge variant="primary">后端读回</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]" role="img" aria-label="近 7 日真实调用趋势面积图">
                  <ChartMount>
                    {({ width, height }) => (
                      <AreaChart width={width} height={height} data={data.dailyUsage} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="adminTrend" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0" stopColor="var(--info)" stopOpacity={0.35} />
                            <stop offset="1" stopColor="var(--info)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border-2)" strokeDasharray="3 4" vertical={false} />
                        <XAxis dataKey="day" stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        {/* linear 而非 monotone：样条会在数据点之间造出未测量的峰谷。 */}
                        <Area type="linear" dataKey="value" name="调用次数" stroke="var(--info)" strokeWidth={2.4} fill="url(#adminTrend)" dot={{ r: 2, strokeWidth: 0 }} />
                      </AreaChart>
                    )}
                  </ChartMount>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>部门账号分布</CardTitle>
                <Badge variant="primary">真实用户表</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[240px]" role="img" aria-label="按账号部门聚合的用户分布柱状图">
                  <ChartMount>
                    {({ width, height }) => (
                      <BarChart width={width} height={height} data={data.colleges} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11.5, fill: "var(--text-2)" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          formatter={(v: unknown) => [Number(v).toLocaleString("zh-CN"), "账号数"]}
                        />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {data.colleges.map((c, i) => (<Cell key={`${c.name}-${i}`} fill={c.color} />))}
                        </Bar>
                      </BarChart>
                    )}
                  </ChartMount>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.12} className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>AI 回答采纳漏斗</CardTitle>
                  <p className="mt-0.5 text-[12px] text-[var(--text-2)]">由对话、收藏与反馈实时聚合；安全事件不属漏斗一级，见上方「安全/越权事件」</p>
                </div>
                <Badge variant="primary">真实累计</Badge>
              </CardHeader>
              <CardContent>
                <div role="img" aria-label="AI 回答采纳漏斗，来自真实后端聚合；安全事件另在上方 KPI 单列">
                  <AdoptionFunnel data={data.adoptionFunnel} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI 回答满意度</CardTitle>
                <Badge variant={data.aiAccuracy.feedbackCount ? "green" : "default"}>{accuracyBadge}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <Gauge
                    value={data.aiAccuracy.value}
                    label="好评占比"
                    sub={data.aiAccuracy.feedbackCount ? `基于 ${data.aiAccuracy.feedbackCount.toLocaleString("zh-CN")} 条真实反馈` : "等待更多真实反馈"}
                    ariaLabel={`AI 回答好评占比 ${data.aiAccuracy.value}%`}
                  />
                  <div className="mt-3 w-full space-y-1.5">
                    {data.aiAccuracy.breakdown.map((b) => (
                      <div key={b.label} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-2 text-[var(--text-2)]">
                          <span className="h-2 w-2 rounded-sm" style={{ background: b.color }} />
                          {b.label}
                        </span>
                        <span className="text-num font-semibold text-[var(--text)]">{b.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>使用高峰热力图</CardTitle>
                <Badge>近 7 日消息</Badge>
              </CardHeader>
              <CardContent>
                <HourHeatmap grid={data.hourHeatmap} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>热门智能体 TOP 5</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.topAgents.map((a, i) => (
                    <div key={a.name} className={`flex items-center gap-3 py-1.5 ${i ? "border-t border-[var(--border-2)] pt-2.5" : ""}`}>
                      <div className="grid h-7 w-7 place-items-center rounded-[12px] text-white text-num text-[12px] font-bold" style={{ background: a.color }}>{a.rank}</div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[13px] font-semibold">{a.name}</div>
                        <div className="text-[11px] text-[var(--text-3)]">{a.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-num text-[14px] font-bold">{a.calls.toLocaleString("zh-CN")}</div>
                        <div className="text-[11px] font-semibold text-[var(--text-3)]">累计调用</div>
                      </div>
                    </div>
                  ))}
                  {data.topAgents.length === 0 && <p className="py-4 text-center text-[12px] text-[var(--text-3)]">暂无智能体调用数据</p>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>各模型回复占比 · 真实累计</CardTitle>
                <Badge variant="primary">{data.sourceSummary.chatMessages.toLocaleString("zh-CN")} 条消息</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]" role="img" aria-label="各模型 AI 回复占比饼图">
                  <ChartMount>
                    {({ width, height }) => (
                      <PieChart width={width} height={height}>
                        <Pie data={data.costShare} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                          {data.costShare.map((c) => (<Cell key={c.name} fill={c.color} />))}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    )}
                  </ChartMount>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>系统运行状态</CardTitle>
                <Badge variant="green">真实读回</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {data.systemHealth.map((r) => (
                    <div key={r.name} className="flex items-center justify-between rounded-[12px] px-2.5 py-1.5 hover:bg-[var(--rg-hover-bg)]">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${r.state === "online" ? "bg-[var(--c-growth)]" : "bg-[var(--c-gold)]"}`} />
                        <span className="text-[13px]">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-num text-[var(--text-2)]">{r.latency}</span>
                        <span className={`rounded-full px-2 py-0.5 ${r.state === "online" ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--warn-bg)] text-[var(--warn-ink)]"}`}>
                          {r.state === "online" ? "正常" : "需关注"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
