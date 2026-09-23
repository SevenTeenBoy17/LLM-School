"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Database, Info, LineChart, RefreshCw, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeroArt, Reveal } from "@/components/common/EduArt";
import { TeacherFeatureGlyph } from "@/components/common/TeacherFeatureGlyph";
import { CollegeDistributionChart, SystemHealth } from "@/components/dashboard/AdminView";
import { GradientFeatureCard } from "@/components/dashboard/GradientFeatureCard";
import { ModelDonut } from "@/components/dashboard/ModelDonut";
import { QuickActionGrid } from "@/components/dashboard/QuickActionGrid";
import { StatRow } from "@/components/dashboard/StatRow";
import { TodayCourses } from "@/components/dashboard/TodayCourses";
import { TodoList } from "@/components/dashboard/TodoList";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { RightRail, RailSection } from "@/components/shell/RightRail";
import { canAccessConsole } from "@/lib/nav";
import { greeting } from "@/lib/greeting";
import { useUserStore } from "@/lib/store/useUserStore";
import type {
  DashboardAdminWorkspace,
  DashboardHonestState,
  DashboardSafetyItem,
  DashboardSnapshot,
  DashboardSourceSummary,
  DashboardWorkspace,
} from "@/lib/data/dashboardSnapshot";

type ViewMode = "teacher" | "admin";

function SourceReadback({ summary }: { summary: DashboardSourceSummary }) {
  const rows = [
    ["会话", summary.sessions],
    ["用户提问", summary.userMessages],
    ["AI 返回", summary.assistantMessages],
    ["知识库", summary.knowledgeFiles],
    ["收藏/反馈", summary.favorites + summary.feedback],
    ["诚信聚合", summary.integrityWeekly],
    ["班级学生", summary.classStudents],
    ["待批改", summary.pendingGrading],
    ["账号", summary.users],
    ["审计", summary.auditRows],
    ["工单", summary.tickets],
  ].filter(([, value]) => Number(value) > 0);

  const totalRecords = rows.reduce((sum, [, v]) => sum + Number(v), 0);
  return (
    <div data-testid="dashboard-source-readback" className="mt-4">
      <Collapsible
        title="后端来源回读"
        summary={rows.length ? `${rows.length} 类数据源 · 共 ${totalRecords.toLocaleString("zh-CN")} 条记录（点击展开明细）` : "后端暂无可计数记录"}
        icon={<TeacherFeatureGlyph name="source-database" size={28} fallback={Database} />}
      >
        <div className="grid grid-cols-2 gap-2 text-[12px] text-[var(--text-2)] sm:grid-cols-3 lg:grid-cols-6">
          {rows.length ? rows.map(([label, value]) => (
            <div key={String(label)} className="rounded-[12px] bg-[var(--rg-hover-bg)] px-2.5 py-2">
              <div>{label}</div>
              <div className="text-num mt-0.5 text-[14px] font-semibold text-[var(--text)]">{Number(value).toLocaleString("zh-CN")}</div>
            </div>
          )) : (
            <div className="col-span-full rounded-[12px] bg-[var(--rg-hover-bg)] px-2.5 py-2 text-[var(--text-3)]">后端暂无可计数记录</div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}

function HonestStates({ items }: { items: DashboardHonestState[] }) {
  const connected = items.filter((i) => i.status === "connected").length;
  return (
    <div data-testid="dashboard-honest-states">
      <Collapsible
        title="数据诚实状态"
        summary={`已接入 ${connected} / 共 ${items.length}（已接入 · 估算 · 未接入 分开显示）`}
        icon={<ShieldCheck size={15} />}
      >
        <div className="grid gap-2 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} data-status={item.status} className="rounded-[12px] border border-[var(--border-2)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-semibold text-[var(--text)]">{item.title}</div>
                <Badge variant={item.status === "connected" ? "green" : item.status === "estimated" ? "primary" : "outline"}>
                  {item.status === "connected" ? "已接入" : item.status === "estimated" ? "估算" : "未接入"}
                </Badge>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-2)]">{item.note}</p>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

function SafetyList({ items }: { items: DashboardSafetyItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <div key={s.id} data-status={s.status} className="flex items-center justify-between gap-3 rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2">
          <span className="text-[13px] text-[var(--text-2)]">{s.name}</span>
          <span className={`text-[12px] font-semibold ${s.ok ? "text-[var(--ok-ink)]" : "text-[var(--text-3)]"}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function AdminQueues({ admin }: { admin: DashboardAdminWorkspace }) {
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>治理队列</CardTitle>
          <Link href="/admin/agents" className="inline-flex min-h-[36px] items-center text-[12px] text-[var(--c-edu)] hover:underline">前往处理 →</Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {admin.queueItems.length ? admin.queueItems.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-[58px] items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-3 transition hover:bg-[var(--rg-hover-bg)]">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[13px] font-semibold text-[var(--c-primary)]">
                  {item.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{item.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">{item.desc}</div>
                </div>
                <span className="shrink-0 text-[11px] text-[var(--text-3)]">{item.time}</span>
                {item.urgent && <Badge variant="red">紧急</Badge>}
              </Link>
            )) : (
              <div className="rounded-[12px] border border-[var(--border-2)] p-3 text-[13px] text-[var(--text-2)]">当前没有待审核智能体或未解决安全工单。</div>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>审计预览</CardTitle>
          <Link href="/admin/audit" className="inline-flex min-h-[36px] items-center text-[12px] text-[var(--c-edu)] hover:underline">查看全部 →</Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {admin.auditPreview.map((row) => (
              <Link key={row.id} href={row.href} className="flex min-h-[48px] items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-2.5 transition hover:bg-[var(--rg-hover-bg)]">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.risk === "high" ? "bg-[var(--err-bg)] text-[var(--err-ink)]" : "bg-[var(--warn-bg)] text-[var(--warn-ink)]"}`}>
                  {row.risk === "high" ? "高" : "中"}
                </span>
                <span className="min-w-0 flex-1 text-[13px]">
                  <span className="font-semibold">{row.who}</span>
                  <span className="ml-1.5 text-[var(--text-2)]">{row.op}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-3)]">{row.time}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-1 min-w-0 flex-col p-5 md:p-7">
      <div className="surface-card p-5">
        <div className="text-[14px] font-semibold text-[var(--text)]">正在读取后端工作台快照</div>
        <div className="mt-2 text-[13px] text-[var(--text-2)]">等待 `/api/dashboard` 返回后再评价页面内容。</div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 min-w-0 flex-col p-5 md:p-7">
      <div className="surface-card p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--err-ink)]">
          <AlertCircle size={18} />
          工作台快照读取失败
        </div>
        <div className="mt-2 text-[13px] text-[var(--text-2)]">{error}</div>
        <Button type="button" variant="outline" size="sm" className="mt-4 min-h-[42px] gap-2" onClick={onRetry}>
          <RefreshCw size={14} />
          重新读取
        </Button>
      </div>
    </div>
  );
}

async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const res = await fetch("/api/dashboard", { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body as DashboardSnapshot;
}

export default function DashboardPage() {
  const router = useRouter();
  const role = useUserStore((s) => s.role);
  const name = useUserStore((s) => s.name);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>(role === "admin" || role === "college-admin" ? "admin" : "teacher");
  // 工作台 composer 草稿（AI 平台调研范式 1 的改造版：教师端保留总览，
  // 但把「开始一次 AI 工作」的入口提到首屏第一交互位；提交即带 seed 直达 /chat）。
  const [draft, setDraft] = useState("");
  const hour = useSyncExternalStore(() => () => {}, () => new Date().getHours(), () => 9);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await fetchDashboardSnapshot());
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetchDashboardSnapshot()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "unknown_error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const canUseAdmin = Boolean(snapshot?.admin) || canAccessConsole(role);
  const effectiveAdmin = Boolean(snapshot?.admin) && mode === "admin";
  const workspace: DashboardWorkspace | null = useMemo(() => {
    if (!snapshot) return null;
    return effectiveAdmin && snapshot.admin ? snapshot.admin : snapshot.teacher;
  }, [effectiveAdmin, snapshot]);

  if (loading) return <LoadingState />;
  if (error || !snapshot || !workspace) return <ErrorState error={error ?? "empty_dashboard_snapshot"} onRetry={loadDashboard} />;

  const teacher = snapshot.teacher;
  const admin = snapshot.admin;
  const displayName = snapshot.user.name || name;
  const displayRole = snapshot.user.role || role;
  const title = effectiveAdmin ? workspace.title : greeting(displayName, displayRole, hour);

  return (
    <>
      <div className="teacher-workspace flex flex-1 min-w-0 flex-col p-5 md:p-7 max-w-full overflow-x-hidden">
        {/* 欢迎横幅：品牌渐变微染 + SVG 教育主视觉（自绘矢量，真生图不可用之兜底），信息不增、观感升级 */}
        <div className="teacher-page-hero relative mb-5 overflow-hidden rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)]">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "var(--grad-primary)" }} />
          <HeroArt aria-hidden className="pointer-events-none absolute -right-2 top-1/2 hidden h-[128px] w-[192px] -translate-y-1/2 opacity-90 md:block" />
          <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-end md:justify-between md:pr-[210px]">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">{title}</h1>
            <p className="mt-1.5 text-[13px] text-[var(--text-2)]">{workspace.subtitle}</p>
            <span data-testid="dashboard-real-badge" className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--rg-control-bg)] px-2.5 py-0.5 text-[11px] text-[var(--text-3)]">
              <Info size={11} /> {workspace.badge}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canUseAdmin && (
              <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="teacher" className="min-h-[40px] px-3">教学视角</TabsTrigger>
                  <TabsTrigger value="admin" disabled={!admin} className="min-h-[40px] px-3">管理视角</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <Button variant="outline" size="sm" className="min-h-[40px] gap-1.5" onClick={loadDashboard}>
              <RefreshCw size={14} /> 刷新快照
            </Button>
            <Button variant="grad" size="sm" onClick={() => router.push("/chat")} className="min-h-[40px] gap-1.5">
              <Sparkles size={14} /> 发起新对话
            </Button>
          </div>
          </div>
        </div>

        {/* AI 工作台入口（调研落地）：composer + 任务语言 chips 是现代 AI 平台主页的
            第一交互位（Claude/ChatGPT 均为会话优先）；教师端不能全盘会话优先（需要总览），
            折中为「总览保留，入口前置」。chips 直接复用后端下发的 recommendedPrompts——
            真实数据、任务语言、预审文案，不在前端另造一套（反模式：无来源的个性化
            不许渲染）。原页面底部的「推荐提示词」卡随之上移合并，消灭同数据双呈现。 */}
        {!effectiveAdmin && (
          <div className="teacher-command-bar mb-5 rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)] p-4 md:p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = draft.trim();
                if (t) router.push("/chat?seed=" + encodeURIComponent(t));
              }}
              className="flex items-center gap-3"
            >
              <Sparkles size={16} aria-hidden className="shrink-0 text-[var(--c-edu)]" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="描述你要做的事，回车直达 AI 对话…"
                aria-label="快速发起 AI 对话"
                className="min-h-[44px] w-full min-w-0 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
              />
              <Button type="submit" variant="grad" size="sm" className="min-h-[40px] shrink-0 gap-1.5">
                开始 <ArrowRight size={14} />
              </Button>
            </form>
            {teacher.recommendedPrompts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {teacher.recommendedPrompts.slice(0, 4).map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => router.push("/chat?seed=" + encodeURIComponent(text))}
                    className="min-h-[36px] rounded-full bg-[var(--rg-selected-bg)] px-3 py-1.5 text-left text-[13px] text-[var(--info-ink)] transition hover:-translate-y-px hover:bg-[var(--rg-control-hover)]"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <StatRow stats={workspace.stats} />
        <SourceReadback summary={workspace.sourceSummary} />

        {!effectiveAdmin ? (
          <>
            {teacher.classOverview ? (
              <Link href={teacher.classOverview.href} data-testid="dashboard-class-card" className="teacher-feature-surface mt-5 flex flex-wrap items-center gap-4 rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4 transition hover:border-[var(--c-edu)]/40 hover:shadow-[var(--shadow-md)]">
                <TeacherFeatureGlyph name="class-mastery" size={50} fallback={LineChart} />
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--text)]">班级学情 · {teacher.classOverview.className}</div>
                  <div className="text-[12px] text-[var(--text-2)]">平均掌握 {teacher.classOverview.avgMastery}% · 待批改 {teacher.classOverview.pendingGrading} 份</div>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--c-edu)]">进入诊断 <ArrowRight size={14} /></span>
              </Link>
            ) : (
              <div data-testid="dashboard-class-card" data-status="not_connected" className="mt-5 rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4">
                <div className="text-[14px] font-semibold text-[var(--text)]">班级学情未接入当前角色</div>
                <div className="mt-1 text-[12px] text-[var(--text-2)]">仅教师/科研角色读取班级明细；本页不会用示例班级冒充真实数据。</div>
              </div>
            )}

            <Reveal className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>真实使用趋势</CardTitle>
                    <CardDescription>最近 7 日来自消息与会话后端</CardDescription>
                  </div>
                  <Badge variant="primary">no-store</Badge>
                </CardHeader>
                <CardContent>
                  {/* 空数据不画空坐标轴（调研反模式：无真实数据的占位模块是噪音；
                      铁律②的图表版）。一句诚实说明的信息量高于一张全零的折线图。 */}
                  {workspace.trend.data.some((pt) => pt.primary > 0 || pt.secondary > 0) ? (
                    <TrendChart trend={workspace.trend} />
                  ) : (
                    <p className="py-6 text-[13px] text-[var(--text-2)]">最近 7 日暂无真实调用；发起对话后这里会出现趋势曲线。</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>模型调用占比</CardTitle>
                  <Badge>后端记录</Badge>
                </CardHeader>
                <CardContent>
                  {workspace.modelTotal > 0 ? (
                    <ModelDonut data={workspace.modelShare} total={workspace.modelTotal} />
                  ) : (
                    <p className="py-6 text-[13px] text-[var(--text-2)]">暂无模型调用记录；这里只统计真实调用，不显示演示数据。</p>
                  )}
                </CardContent>
              </Card>
            </Reveal>

            <Reveal delay={0.08} className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>教学快捷入口</CardTitle>
                  <Link href="/chat" className="inline-flex min-h-[36px] items-center text-[12px] text-[var(--c-edu)] hover:underline">查看全部 →</Link>
                </CardHeader>
                <CardContent><QuickActionGrid actions={teacher.quickActions} /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>最近会话</CardTitle>
                  <Link href="/chat" className="inline-flex min-h-[36px] items-center text-[12px] text-[var(--c-edu)] hover:underline">历史记录 →</Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {teacher.recentChats.length ? teacher.recentChats.map((r) => (
                      <Link key={r.id} href={r.href} data-testid="dashboard-recent-chat" className="flex min-h-[56px] items-center gap-3 rounded-[12px] p-2 transition hover:bg-[var(--rg-hover-bg)]">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-[13px] font-semibold text-white" style={{ background: r.color }}>
                          {r.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-[var(--text)]">{r.name}</div>
                          <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">{r.desc}</div>
                        </div>
                        <div className="shrink-0 text-[11px] text-[var(--text-3)]">{r.time}</div>
                      </Link>
                    )) : (
                      <div className="rounded-[12px] border border-[var(--border-2)] p-3 text-[13px] text-[var(--text-2)]">当前账号暂无会话记录；创建新对话后这里会显示真实会话。</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Reveal>

            {/* 「推荐提示词」卡已上移合并进顶部 composer 的 chips（同一份
                recommendedPrompts 数据不再双呈现）；「提示词中心」入口保留在侧栏导航。
                V2 减噪存档：此处更早前还有一张「平台安全状态」Card，与右栏 RailSection
                「安全状态」渲染同一份 workspace.safetyItems，已删；保留右栏那处。
                门禁 G9 断言：dashboard 全页「安全状态」类标题只出现一次。 */}

            <div className="mt-4">
              <HonestStates items={workspace.honestStates} />
            </div>
          </>
        ) : admin ? (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-[360px_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>系统运行状态</CardTitle>
                  <Badge variant="green">后端可读</Badge>
                </CardHeader>
                <CardContent><SystemHealth items={admin.systemHealth} /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>部门账号分布</CardTitle>
                  <Badge variant="primary">当前用户表</Badge>
                </CardHeader>
                <CardContent><CollegeDistributionChart data={admin.collegeDistribution} /></CardContent>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>模型调用趋势</CardTitle>
                  <Badge variant="primary">最近 7 日</Badge>
                </CardHeader>
                <CardContent>
                  {admin.trend.data.some((pt) => pt.primary > 0 || pt.secondary > 0) ? (
                    <TrendChart trend={admin.trend} />
                  ) : (
                    <p className="py-6 text-[13px] text-[var(--text-2)]">最近 7 日暂无真实调用；平台产生调用后这里会出现趋势曲线。</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>模型调用占比</CardTitle>
                  <Badge>后端记录</Badge>
                </CardHeader>
                <CardContent>
                  {admin.modelTotal > 0 ? (
                    <ModelDonut data={admin.modelShare} total={admin.modelTotal} />
                  ) : (
                    <p className="py-6 text-[13px] text-[var(--text-2)]">暂无模型调用记录；这里只统计真实调用，不显示演示数据。</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <AdminQueues admin={admin} />
            <div className="mt-4">
              <HonestStates items={admin.honestStates} />
            </div>
          </>
        ) : null}
      </div>

      <RightRail>
        {/* 教师端配额从橙色渐变大卡降为中性小节（调研落地 + 铁律③）：
            「今日 AI 配额」的橙色大数字读作计费仪表，而这是**公平使用**额度——
            资源紧张时排队的语义，不是花钱的语义。管理端保留大卡（那是平台读数）。 */}
        {effectiveAdmin ? (
          <GradientFeatureCard
            title="平台调用读数"
            icon={Wallet}
            value={`${workspace.quota.used.toLocaleString("zh-CN")} / ${workspace.quota.total.toLocaleString("zh-CN")} ${workspace.quota.unit}`}
            caption={`已用 ${workspace.quota.percent}%`}
            progress={workspace.quota.percent}
            footnote={workspace.quota.footnote}
          />
        ) : (
          <RailSection title="今日公平使用">
            <div className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--text-2)]">今日额度</span>
                <span className="text-[13px] font-semibold text-[var(--text)]">
                  {workspace.quota.used.toLocaleString("zh-CN")} / {workspace.quota.total.toLocaleString("zh-CN")} {workspace.quota.unit}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--rg-control-bg)]">
                <div className="h-full rounded-full bg-[var(--c-edu)]" style={{ width: Math.min(100, workspace.quota.percent) + "%" }} />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
                公平使用额度，用完当日排队而非付费——{workspace.quota.footnote}
              </p>
            </div>
          </RailSection>
        )}
        <RailSection title={effectiveAdmin ? "治理队列" : "今日事项"}>
          <TodayCourses courses={workspace.courses} />
        </RailSection>
        <RailSection title="待办事项">
          <TodoList todos={workspace.todos} />
        </RailSection>
        <RailSection title="安全状态">
          <SafetyList items={workspace.safetyItems} />
        </RailSection>
      </RightRail>
    </>
  );
}
