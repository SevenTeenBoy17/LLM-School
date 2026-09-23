"use client";

import { useState, useEffect } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ShieldCheck, Search, FileDown, MoreHorizontal, Activity, Ban, HeartPulse, LifeBuoy, Clock } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { AUDIT_LOG } from "@/lib/data/admin";
import { exportCsv } from "@/lib/client/adminApi";
import { cn } from "@/lib/utils";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";
import type { ComponentType } from "react";

const RISK_TONE: Record<string, { bg: string; text: string; label: string }> = {
  low:  { bg: "bg-[var(--info-bg)]", text: "text-[var(--info-ink)]", label: "低" },
  mid:  { bg: "bg-[var(--warn-bg)]", text: "text-[var(--warn-ink)]", label: "中" },
  high: { bg: "bg-[var(--err-bg)]", text: "text-[var(--err-ink)]", label: "高" },
};

const STATE_TONE: Record<string, { bg: string; text: string; label: string }> = {
  handled: { bg: "bg-[var(--ok-bg)]", text: "text-[var(--ok-ink)]", label: "已处理" },
  pending: { bg: "bg-[var(--warn-bg)]", text: "text-[var(--warn-ink)]", label: "待处理" },
  mid:     { bg: "bg-[var(--warn-bg)]", text: "text-[var(--warn-ink)]", label: "待处理" },
  high:    { bg: "bg-[var(--err-bg)]", text: "text-[var(--err-ink)]", label: "待处理" },
  ignored: { bg: "bg-[var(--rg-control-bg)]", text: "text-[var(--text-3)]", label: "已忽略" },
};

type ServerAuditRow = { id: string; at: number; userId: string; role: string; path: string; action: string; result: string };

function matchesServerAuditQuery(row: ServerAuditRow, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  return [
    new Date(row.at).toLocaleString("zh-CN", { hour12: false }),
    row.userId,
    row.role,
    row.path,
    row.action,
    row.result,
    row.result === "deny" ? "拒绝" : "放行",
  ].some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

export default function AuditPage() {
  const [filter, setFilter] = useState<"all" | "high" | "pending" | "ignored">("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const list = AUDIT_LOG.filter((r) => {
    if (filter === "all") return true;
    if (filter === "high") return r.risk === "high";
    if (filter === "pending") return r.state === "pending" || r.state === "mid" || r.state === "high";
    if (filter === "ignored") return r.state === "ignored";
    return true;
  }).filter((r) => {
    if (!normalizedQuery) return true;
    return [r.when, r.who, r.role, r.op, r.resource, r.risk, r.state]
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  // 服务端真实审计（proxy 越权拦截 + 受保护接口读取）——把越权记录真正落库后回读
  const [serverAudit, setServerAudit] = useState<ServerAuditRow[]>([]);
  const [auditError, setAuditError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setServerAudit(d.audit ?? []); })
      .catch(() => { if (alive) setAuditError("服务端审计读取失败，请稍后重试。"); });
    return () => { alive = false; };
  }, []);

  // 安全求助/举报工单（来自 /api/chat 危机硬拦截 + SafetyHelp）——闭合「建工单→有人跟进」最后一公里
  const [tickets, setTickets] = useState<{ id: string; at: number; userId: string; type: string; status: string; detail?: string }[]>([]);
  const [ticketsError, setTicketsError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/safety/tickets")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setTickets(d.tickets ?? []); })
      .catch(() => { if (alive) setTicketsError("安全工单读取失败，请稍后重试。"); });
    return () => { alive = false; };
  }, []);

  const updateTicket = async (id: string, status: "received" | "in_progress" | "resolved") => {
    setTicketsError("");
    try {
      const res = await fetch("/api/safety/tickets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setTickets((current) => current.map((ticket) => ticket.id === id ? data.ticket : ticket));
    } catch {
      setTicketsError("工单状态更新失败，请稍后重试。");
    }
  };

  const filteredServerAudit = serverAudit.filter((row) => matchesServerAuditQuery(row, normalizedQuery));

  // 概览数字一律实算自已加载的服务端真实数据（评审 P0·铁律⑤：不再写死编造数；未加载完显示 0）。
  const riskSummary: { label: string; value: number; Icon: ComponentType<{ size?: number }>; tone: "red" | "gold" }[] = [
    { label: "服务端审计记录", value: serverAudit.length, Icon: Activity, tone: "gold" },
    { label: "越权访问拦截", value: serverAudit.filter((a) => a.result === "deny").length, Icon: Ban, tone: "red" },
    { label: "危机干预", value: serverAudit.filter((a) => a.action === "crisis_intervention").length, Icon: HeartPulse, tone: "red" },
    { label: "安全求助工单", value: tickets.filter((t) => t.type === "help").length, Icon: LifeBuoy, tone: "gold" },
    { label: "待跟进工单", value: tickets.filter((t) => t.status !== "resolved").length, Icon: Clock, tone: "gold" },
  ];

  return (
    <div className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><ShieldCheck size={20} /></span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">管理与监控中心 · 安全审计</h1>
            <p className="text-[13px] text-[var(--text-2)]">敏感信息、异常访问、违规上传、风险对话的完整审计日志</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="grad" size="sm" className="min-h-[var(--hit-min)] gap-1.5"
            disabled={filteredServerAudit.length === 0}
            title={filteredServerAudit.length === 0 ? "暂无匹配的服务端审计记录可导出" : "导出当前筛选的真实服务端审计为 CSV"}
            onClick={() => {
              try {
                exportCsv(
                  "服务端审计日志.csv",
                  ["时间", "用户", "角色", "路径", "操作", "结果"],
                  filteredServerAudit.map((a) => [new Date(a.at).toLocaleString("zh-CN", { hour12: false }), a.userId, a.role, a.path, a.action, a.result === "deny" ? "拒绝" : "放行"])
                );
                setExportNotice(`已生成 ${filteredServerAudit.length} 条真实审计 CSV${normalizedQuery ? `（筛选：${query.trim()}）` : ""}`);
              } catch {
                setExportNotice("CSV 导出失败，请刷新后重试");
              }
            }}
          ><FileDown size={13} /> 导出日志（服务端真实记录）</Button>
          {exportNotice ? (
            <span role="status" className="text-[12px] font-semibold text-[var(--ok-ink)]">{exportNotice}</span>
          ) : null}
        </div>
      </div>

      <AdminTabs />

      {/* Risk summary —— 实算自服务端真实数据 */}
      <Reveal className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {riskSummary.map((s) => (
          <div key={s.label} className="surface-card relative overflow-hidden p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "grid h-10 w-10 place-items-center rounded-[12px]",
                s.tone === "red" ? "bg-[var(--err-bg)] text-[var(--err-ink)]" : "bg-[var(--warn-bg)] text-[var(--warn-ink)]"
              )}><s.Icon size={20} /></div>
              <div>
                <div className="text-num text-[18px] font-bold">{s.value}</div>
                <div className="text-[11px] text-[var(--text-2)]">{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </Reveal>

      <Card>
        <CardHeader className="flex-col items-start gap-3 md:flex-row md:items-center">
          <div className="min-w-0">
            <CardTitle>安全审计日志 <Badge className="ml-1 bg-[var(--warn-bg)] text-[var(--warn-ink)]" variant="default">样例数据</Badge></CardTitle>
            <p className="mt-0.5 text-[12px] text-[var(--text-2)]">界面演示用样例 · 共 {AUDIT_LOG.length} 条 · 真实记录见下方「实时访问审计 · 服务端」与「安全求助 / 举报工单」</p>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="w-full md:w-auto">
            <TabsList className="w-full flex-wrap justify-start md:w-auto">
              <TabsTrigger className="min-h-[var(--hit-min)] flex-1 px-2 md:min-h-[40px] md:flex-none md:px-3" value="all">全部</TabsTrigger>
              <TabsTrigger className="min-h-[var(--hit-min)] flex-1 px-2 md:min-h-[40px] md:flex-none md:px-3" value="high">高风险</TabsTrigger>
              <TabsTrigger className="min-h-[var(--hit-min)] flex-1 px-2 md:min-h-[40px] md:flex-none md:px-3" value="pending">待处理</TabsTrigger>
              <TabsTrigger className="min-h-[var(--hit-min)] flex-1 px-2 md:min-h-[40px] md:flex-none md:px-3" value="ignored">已忽略</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex h-12 w-full max-w-md items-center gap-2 rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[var(--text-3)]">
              <Search size={13} />
              <input
                aria-label="搜索审计记录"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-full w-full bg-transparent text-[13px] outline-none"
                placeholder="搜索用户、操作或资源..."
              />
            </div>
            <NotYetAvailable why="样例数据不支持批量处理；真实工单请在下方逐条跟进">批量处理</NotYetAvailable>
          </div>

          <div className="surface-card overflow-x-auto">
            <div className="grid min-w-[920px] grid-cols-[88px_1.4fr_1fr_1.4fr_70px_90px_50px] gap-3 border-b border-[var(--border-2)] bg-[var(--rg-hover-bg)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">
              <span>时间</span><span>用户</span><span>操作</span><span>涉及资源</span><span>风险</span><span>状态</span><span></span>
            </div>
            {list.length === 0 ? (
              <div className="min-w-[920px] px-3 py-8 text-center text-[13px] text-[var(--text-3)]">
                未找到匹配的样例审计记录
              </div>
            ) : list.map((r, i) => {
              const tone = RISK_TONE[r.risk];
              const stone = STATE_TONE[r.state];
              const avColor = ["var(--info)", "var(--err)", "var(--proc)", "var(--ok)", "var(--warn)", "var(--c-cyan)", "var(--c-primary)", "var(--c-violet)"][i % 8];
              return (
                <div key={i} className="grid min-w-[920px] grid-cols-[88px_1.4fr_1fr_1.4fr_70px_90px_50px] items-center gap-3 border-b border-[var(--border-2)] px-3 py-2.5 transition hover:bg-[var(--rg-hover-bg)]">
                  <span className="text-num text-[12px] text-[var(--text-2)]">{r.when}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: avColor }}>{r.who[0]}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{r.who}</div>
                      <div className="text-[11px] text-[var(--text-3)]">{r.role}</div>
                    </div>
                  </div>
                  <span className="truncate text-[12px]">{r.op}</span>
                  <span className="truncate text-[12px] text-[var(--text-2)]">{r.resource}</span>
                  <span><Badge className={cn("font-semibold", tone.bg, tone.text)} variant="default">{tone.label}</Badge></span>
                  <span><Badge className={cn(stone.bg, stone.text)} variant="default">{stone.label}</Badge></span>
                  <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-[12px] text-[var(--text-3)]">
                    <MoreHorizontal size={14} />
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 服务端真实审计（来自 proxy 越权拦截 + 受保护接口） */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>实时访问审计 · 服务端</CardTitle>
            <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
              来自 proxy 越权拦截与受保护接口的真实记录 · 共 {serverAudit.length} 条{normalizedQuery ? ` · 当前筛选 ${filteredServerAudit.length} 条` : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {auditError ? (
            <p role="alert" className="rounded-[12px] bg-[var(--err-bg)] px-3 py-2 text-[13px] text-[var(--err-ink)]">{auditError}</p>
          ) : serverAudit.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--text-3)]">暂无服务端审计记录（以学生身份访问 /admin 或 /class 会产生越权拦截记录）。</p>
          ) : filteredServerAudit.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--text-3)]">未找到匹配的服务端审计记录</p>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {filteredServerAudit.map((a) => (
                  <div key={a.id} className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3 shadow-[var(--rg-shadow)]">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-num text-[12px] text-[var(--text-2)]">{new Date(a.at).toLocaleString("zh-CN", { hour12: false })}</span>
                      {a.result === "deny"
                        ? <Badge className="bg-[var(--err-bg)] text-[var(--err-ink)]" variant="default">拒绝</Badge>
                        : <Badge className="bg-[var(--ok-bg)] text-[var(--ok-ink)]" variant="default">放行</Badge>}
                    </div>
                    <div className="text-[13px] font-semibold">{a.userId} <span className="text-[var(--text-3)]">· {a.role}</span></div>
                    {/* data-allow-break：break-all 会关掉中文避头尾（句号/逗号被顶到行首），
                        全站禁用，仅在「无空格的机器串」上按此属性显式登记豁免。
                        这里是接口路径，是 URL 而非中文句子，不适用避头尾规则。 */}
                    <div
                      data-allow-break="path"
                      className="mt-1 break-all font-mono text-[12px] text-[var(--text-2)]"
                    >
                      {a.path}
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--text-2)]">{a.action}</div>
                  </div>
                ))}
              </div>
              <div className="surface-card hidden overflow-x-auto md:block">
                <div className="grid min-w-[760px] grid-cols-[150px_1fr_1.4fr_1fr_80px] gap-3 border-b border-[var(--border-2)] bg-[var(--rg-hover-bg)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">
                  <span>时间</span><span>用户 / 角色</span><span>路径</span><span>操作</span><span>结果</span>
                </div>
                {filteredServerAudit.map((a) => (
                  <div key={a.id} className="grid min-w-[760px] grid-cols-[150px_1fr_1.4fr_1fr_80px] items-center gap-3 border-b border-[var(--border-2)] px-3 py-2.5 text-[12px] hover:bg-[var(--rg-hover-bg)]">
                    <span className="text-num text-[12px] text-[var(--text-2)]">{new Date(a.at).toLocaleString("zh-CN", { hour12: false })}</span>
                    <span className="truncate"><span className="font-semibold">{a.userId}</span> <span className="text-[var(--text-3)]">· {a.role}</span></span>
                    <span className="truncate font-mono text-[12px] text-[var(--text-2)]">{a.path}</span>
                    <span className="truncate text-[var(--text-2)]">{a.action}</span>
                    <span>{a.result === "deny"
                      ? <Badge className="bg-[var(--err-bg)] text-[var(--err-ink)]" variant="default">拒绝</Badge>
                      : <Badge className="bg-[var(--ok-bg)] text-[var(--ok-ink)]" variant="default">放行</Badge>}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 安全求助/举报工单队列（仅安全/心理团队可见，求助内容对任课老师匿名） */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>安全求助 / 举报工单 · 待跟进</CardTitle>
            <p className="mt-0.5 text-[12px] text-[var(--text-2)]">来自 AI 对话危机识别与「安全求助」入口的真实工单 · 共 {tickets.length} 条 · 仅校内安全 / 心理团队可见</p>
          </div>
        </CardHeader>
        <CardContent>
          {ticketsError ? (
            <p role="alert" className="rounded-[12px] bg-[var(--err-bg)] px-3 py-2 text-[13px] text-[var(--err-ink)]">{ticketsError}</p>
          ) : tickets.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--text-3)]">暂无待跟进工单（学生在对话中触发危机信号、或使用「安全求助」会在此生成工单）。</p>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {tickets.map((t) => (
                  <div key={t.id} className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3 shadow-[var(--rg-shadow)]">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-num text-[12px] text-[var(--text-2)]">{new Date(t.at).toLocaleString("zh-CN", { hour12: false })}</span>
                      {t.status === "resolved"
                        ? <Badge className="bg-[var(--ok-bg)] text-[var(--ok-ink)]" variant="default">已处理</Badge>
                        : t.status === "in_progress"
                          ? <Badge className="bg-[var(--info-bg)] text-[var(--info-ink)]" variant="default">跟进中</Badge>
                          : <Badge className="bg-[var(--err-bg)] text-[var(--err-ink)]" variant="default">待跟进</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{t.userId}</span>
                      {t.type === "help"
                        ? <Badge className="bg-[var(--p-rose)] text-[var(--p-rose-ink)]" variant="default">求助</Badge>
                        : <Badge className="bg-[var(--warn-bg)] text-[var(--warn-ink)]" variant="default">举报</Badge>}
                    </div>
                    <div className="mt-2 break-words text-[12px] leading-5 text-[var(--text-2)]">{t.detail ?? "—"}</div>
                    {t.status === "received" && (
                      <button type="button" onClick={() => updateTicket(t.id, "in_progress")} className="mt-3 min-h-[var(--hit-min)] w-full rounded-[12px] border border-[var(--border-2)] px-3 text-[12px] font-semibold text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]">
                        跟进
                      </button>
                    )}
                    {t.status === "in_progress" && (
                      <button type="button" onClick={() => updateTicket(t.id, "resolved")} className="mt-3 min-h-[var(--hit-min)] w-full rounded-[12px] border border-[var(--border-2)] px-3 text-[12px] font-semibold text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]">
                        完成
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="surface-card hidden overflow-x-auto md:block">
                <div className="grid min-w-[760px] grid-cols-[150px_1fr_90px_1.4fr_150px] gap-3 border-b border-[var(--border-2)] bg-[var(--rg-hover-bg)] px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">
                  <span>时间</span><span>发起人</span><span>类型</span><span>来源 / 备注</span><span>状态</span>
                </div>
                {tickets.map((t) => (
                  <div key={t.id} className="grid min-w-[760px] grid-cols-[150px_1fr_90px_1.4fr_150px] items-center gap-3 border-b border-[var(--border-2)] px-3 py-2.5 text-[12px] hover:bg-[var(--rg-hover-bg)]">
                    <span className="text-num text-[12px] text-[var(--text-2)]">{new Date(t.at).toLocaleString("zh-CN", { hour12: false })}</span>
                    <span className="truncate font-semibold">{t.userId}</span>
                    <span>{t.type === "help"
                      ? <Badge className="bg-[var(--p-rose)] text-[var(--p-rose-ink)]" variant="default">求助</Badge>
                      : <Badge className="bg-[var(--warn-bg)] text-[var(--warn-ink)]" variant="default">举报</Badge>}</span>
                    <span className="truncate text-[var(--text-2)]">{t.detail ?? "—"}</span>
                    <span className="flex flex-wrap items-center gap-1">
                      {t.status === "resolved"
                        ? <Badge className="bg-[var(--ok-bg)] text-[var(--ok-ink)]" variant="default">已处理</Badge>
                        : t.status === "in_progress"
                          ? <Badge className="bg-[var(--info-bg)] text-[var(--info-ink)]" variant="default">跟进中</Badge>
                          : <Badge className="bg-[var(--err-bg)] text-[var(--err-ink)]" variant="default">待跟进</Badge>}
                      {t.status === "received" && (
                        <button type="button" onClick={() => updateTicket(t.id, "in_progress")} className="min-h-[40px] rounded-md border border-[var(--border-2)] px-3 text-[11px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]">
                          跟进
                        </button>
                      )}
                      {t.status === "in_progress" && (
                        <button type="button" onClick={() => updateTicket(t.id, "resolved")} className="min-h-[40px] rounded-md border border-[var(--border-2)] px-3 text-[11px] text-[var(--text-2)] hover:bg-[var(--rg-control-bg)]">
                          完成
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-[12px] border border-[var(--err)]/30 bg-[var(--err-bg)] p-4 text-[13px] text-[var(--err-ink)]">
        <strong className="inline-flex items-center gap-1.5"><ShieldAlert size={14} /> 安全合规提醒：</strong>
        所有审计日志保留 180 天，敏感操作（导出 / 删除 / 权限变更）保留 3 年，符合等保 2.0 三级要求。
      </div>
    </div>
  );
}
