"use client";

import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { KpiCard } from "@/components/admin/KpiCard";
import { AgentKanban } from "@/components/admin/AgentKanban";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, MoreHorizontal, FileDown, Columns3, LayoutList, Loader2 } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { AGENTS as SEED_AGENTS } from "@/lib/data/agents";
import { apiListAgents, apiSetAgentStatus, type ClientAgent } from "@/lib/client/libraryApi";
import { exportCsv } from "@/lib/client/adminApi";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";

const CATS = ["全部", "教学", "科研", "行政", "学习"] as const;

export default function AgentsMonitorPage() {
  const [view, setView] = useState<"kanban" | "table">("table");
  const [agents, setAgents] = useState<ClientAgent[]>(SEED_AGENTS);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<(typeof CATS)[number]>("全部");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { agents: list } = await apiListAgents();
      if (!alive) return;
      if (list.length) setAgents(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => (cat === "全部" ? agents : agents.filter((a) => a.category === cat)), [agents, cat]);

  // KPI 由真实智能体实算（不编造）
  const kpis = useMemo(() => {
    const pub = agents.filter((a) => a.status === "pub").length;
    const review = agents.filter((a) => a.status === "review").length;
    const disabled = agents.filter((a) => a.status === "disabled").length;
    const calls = agents.reduce((s, a) => s + a.calls, 0);
    const rated = agents.filter((a) => a.score > 0);
    const avg = rated.length ? (rated.reduce((s, a) => s + a.score, 0) / rated.length).toFixed(1) : "—";
    return [
      { label: "累计调用", value: calls.toLocaleString(), delta: "全部合计", icon: "MessageCircle", accent: "var(--ok)" },
      { label: "已发布", value: String(pub), delta: "面向师生", icon: "Bot", accent: "var(--c-primary)" },
      { label: "平均评分", value: avg, delta: `${rated.length} 个`, icon: "Star", accent: "var(--warn)" },
      { label: "已停用", value: String(disabled), delta: "管理员停用", icon: "AlertTriangle", accent: "var(--err)" },
      { label: "待审核", value: String(review), delta: "等待复核", icon: "ShieldAlert", accent: "var(--proc)" },
    ];
  }, [agents]);

  const exportData = () => exportCsv(
    "智能体清单.csv",
    ["名称", "创建者", "分类", "模型", "知识库", "调用", "评分", "状态"],
    shown.map((a) => [a.name, a.creator, a.category, a.recommendedModel, a.knowledgeBase, a.calls, a.score, a.status])
  );

  const setStatus = async (agent: ClientAgent, status: ClientAgent["status"], label: string) => {
    setUpdatingId(agent.id);
    setNotice("");
    const next = await apiSetAgentStatus(agent.id, status);
    if (next) {
      setAgents((cur) => cur.map((a) => (a.id === agent.id ? next : a)));
      setNotice(`已${label}「${agent.name}」`);
    } else {
      setNotice(`处理失败：${agent.name}`);
    }
    setUpdatingId("");
  };

  return (
    <div data-register="console" className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><Bot size={20} /></span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">管理与监控中心 · 智能体监控</h1>
            <p className="text-[13px] text-[var(--text-2)]">查看所有智能体运行情况、评分与审批流（数据来自真实智能体库）</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[12px] bg-[var(--rg-control-bg)] p-0.5 text-[12px]">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
                className={`min-h-[var(--hit-min)] rounded-[12px] px-3 py-1 ${cat === c ? "bg-[var(--card)] shadow-sm font-semibold" : "text-[var(--text-2)]"}`}>{c}</button>
            ))}
          </div>
          <Button onClick={exportData} disabled={shown.length === 0} variant="grad" size="sm" className="min-h-[var(--hit-min)] gap-1.5"><FileDown size={13} /> 导出数据</Button>
        </div>
      </div>

      <AdminTabs />

      <Reveal className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (<KpiCard key={k.label} kpi={k} />))}
      </Reveal>

      <Card>
        <CardHeader>
          <CardTitle>智能体发布与监控 <span className="text-[12px] font-normal text-[var(--text-3)]">· 共 {shown.length}</span></CardTitle>
          <div className="inline-flex rounded-[12px] border border-[var(--border-2)] bg-[var(--bg-2)] p-0.5">
            <button onClick={() => setView("table")} aria-pressed={view === "table"} className={`inline-flex min-h-[var(--hit-min)] items-center gap-1 rounded-[12px] px-3 py-1 text-[12px] font-semibold transition ${view === "table" ? "bg-[var(--card)] text-[var(--text)] shadow-sm" : "text-[var(--text-2)]"}`}><LayoutList size={13} /> 表格</button>
            <button onClick={() => setView("kanban")} aria-pressed={view === "kanban"} className={`inline-flex min-h-[var(--hit-min)] items-center gap-1 rounded-[12px] px-3 py-1 text-[12px] font-semibold transition ${view === "kanban" ? "bg-[var(--card)] text-[var(--text)] shadow-sm" : "text-[var(--text-2)]"}`}><Columns3 size={13} /> 看板 <span className="text-[11px] text-[var(--text-3)]">示例</span></button>
          </div>
        </CardHeader>
        <CardContent>
          {notice && <div role="status" aria-live="polite" className="mb-3 rounded-[12px] bg-[var(--rg-selected-bg)] px-3 py-2 text-[12px] text-[var(--text-2)]">{notice}</div>}
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-[13px] text-[var(--text-3)]"><Loader2 size={16} className="animate-spin" /> 正在载入…</div>
          ) : view === "kanban" ? <AgentKanban /> : (
          <div className="surface-card overflow-x-auto" role="table" aria-label="智能体监控表格">
            <div role="row" className="grid min-w-[1240px] grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.9fr_0.55fr_0.55fr_0.75fr_1.4fr] gap-2 border-b border-[var(--border-2)] bg-[var(--rg-hover-bg)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">
              <span role="columnheader">智能体</span><span role="columnheader">创建者</span><span role="columnheader">分类</span><span role="columnheader">模型</span><span role="columnheader">知识库</span><span role="columnheader">调用</span><span role="columnheader">评分</span><span role="columnheader">状态</span><span role="columnheader">治理动作</span>
            </div>
            {shown.map((a) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Ic = (Icons as any)[a.icon] as React.ComponentType<{ size?: number }>;
              const busy = updatingId === a.id;
              return (
                <div key={a.id} role="row" className="grid min-w-[1240px] grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.9fr_0.55fr_0.55fr_0.75fr_1.4fr] items-center gap-2 border-b border-[var(--border-2)] px-3 py-2.5 transition hover:bg-[var(--rg-hover-bg)]">
                  <div role="cell" className="flex items-center gap-2 min-w-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundImage: a.gradient }}>
                      {Ic && <Ic size={14} />}
                    </span>
                    <span className="truncate text-[13px] font-semibold">{a.name}</span>
                  </div>
                  <span role="cell" className="truncate text-[12px] text-[var(--text-2)]">{a.creator}</span>
                  <span role="cell"><Badge>{a.category}</Badge></span>
                  <span role="cell" className="text-[12px]">{a.recommendedModel}</span>
                  <span role="cell" className="truncate text-[12px] text-[var(--text-2)]">{a.knowledgeBase || "—"}</span>
                  <span role="cell" className="text-num text-[12px] font-semibold">{a.calls.toLocaleString()}</span>
                  <span role="cell" className="text-num text-[12px] font-semibold text-[var(--warn-ink)]">{a.score || "—"}</span>
                  <span role="cell"><Badge variant={a.status === "pub" ? "green" : a.status === "review" ? "gold" : a.status === "disabled" ? "red" : "default"}>
                    {a.status === "pub" ? "已发布" : a.status === "review" ? "待审核" : a.status === "disabled" ? "已下线" : "草稿"}
                  </Badge></span>
                  <span role="cell" className="flex flex-wrap items-center gap-1.5">
                    {a.status === "review" && (
                      <>
                        <Button onClick={() => setStatus(a, "pub", "通过发布")} disabled={busy} variant="grad" size="sm" className="min-h-[42px] px-3 text-[11px]">通过发布</Button>
                        <Button onClick={() => setStatus(a, "draft", "退回草稿")} disabled={busy} variant="outline" size="sm" className="min-h-[42px] px-3 text-[11px]">退回草稿</Button>
                      </>
                    )}
                    {a.status === "pub" && (
                      <Button onClick={() => setStatus(a, "disabled", "停用")} disabled={busy} variant="outline" size="sm" className="min-h-[42px] px-3 text-[11px]">停用</Button>
                    )}
                    {a.status === "disabled" && (
                      <Button onClick={() => setStatus(a, "pub", "重新发布")} disabled={busy} variant="outline" size="sm" className="min-h-[42px] px-3 text-[11px]">重新发布</Button>
                    )}
                    {a.status === "draft" && <span className="text-[11px] text-[var(--text-3)]">等待创建者提交</span>}
                  </span>
                </div>
              );
            })}
            {shown.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-[var(--text-3)]">该分类下暂无智能体</p>}
          </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>近期审核与异常事件 <span className="ml-1 text-[11px] font-normal text-[var(--text-3)]">· 示例数据</span></CardTitle>
          <NotYetAvailable why="审核历史需事件流水后端 · 演示未开通"><MoreHorizontal size={13} className="mr-1" /> 查看历史</NotYetAvailable>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-[11px] text-[var(--text-3)]">以下为界面示例；真实的智能体送审/审批请在「智能体工作台」与本页表格状态查看，危机/求助工单见「安全审计」。</p>
          <div className="space-y-2">
            {[
              { name: "学校制度咨询助手", who: "校办", state: "待审核",    time: "2 分钟前", risk: "mid" },
              { name: "实验报告评阅助手", who: "陈教授", state: "草稿待修订", time: "1 小时前", risk: "low" },
              { name: "新生问答助手",     who: "信息中心", state: "异常回答 +3", time: "2 小时前", risk: "high" },
              { name: "课件生成助手",     who: "教研组", state: "已发布",     time: "今日",     risk: "low" },
            ].map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-2.5">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  e.risk === "high" ? "bg-[var(--err-bg)] text-[var(--err-ink)]" : e.risk === "mid" ? "bg-[var(--warn-bg)] text-[var(--warn-ink)]" : "bg-[var(--info-bg)] text-[var(--info-ink)]"
                }`}>{e.risk === "high" ? "高" : e.risk === "mid" ? "中" : "低"}</span>
                <span className="flex-1 text-[13px]">
                  <span className="font-semibold">{e.name}</span>
                  <span className="ml-2 text-[var(--text-2)]">{e.state}</span>
                </span>
                <span className="text-[11px] text-[var(--text-3)]">{e.who} · {e.time}</span>
                <NotYetAvailable why="示例事件不可处理；真实审批在智能体工作台">处理</NotYetAvailable>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
