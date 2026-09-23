"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { Search, Plus, Sparkles, ShieldCheck, MoreHorizontal, Send, Filter, Star, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/common/EduArt";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiDeleteAgent, apiSetAgentStatus, type ClientAgent } from "@/lib/client/libraryApi";
import { apiSetFavorite } from "@/lib/client/chatApi";
import { TeacherFeatureGlyph, featureGlyphForAgent } from "@/components/common/TeacherFeatureGlyph";
import { AgentTemplateLibrary } from "@/components/agent/AgentTemplateLibrary";
import { AGENT_TEMPLATES } from "@/lib/agent/templates";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import s from "@/components/agent/agent-workbench.module.css";

const TABS = [
  { id: "all", label: "全部" },
  { id: "教学", label: "教学" },
  { id: "科研", label: "科研" },
  { id: "行政", label: "行政" },
  { id: "学习", label: "学习" },
  { id: "my", label: "我创建的" },
  { id: "draft", label: "草稿 / 审核" },
];

export default function AgentPage() {
  return <Suspense fallback={<GenerationProgress label="正在读取工作台" />}><AgentRoute /></Suspense>;
}

function AgentRoute() {
  const search = useSearchParams();
  const initialView = search.get("view") === "agents" ? "agents" : "templates";
  return <AgentWorkbench key={initialView} initialView={initialView} />;
}

function AgentWorkbench({ initialView }: { initialView: "templates" | "agents" }) {
  const router = useRouter();
  const [agents, setAgents] = useState<ClientAgent[]>([]);
  const [view, setView] = useState<"templates" | "agents">(initialView);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState("");
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"calls" | "score">("calls");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setLoadError("");
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (!res.ok) throw new Error("unavailable");
        const data = await res.json() as { agents: ClientAgent[]; favorites: string[]; userId: string };
        if (!alive) return;
        setAgents(data.agents); setFavorites(new Set(data.favorites)); setUserId(data.userId);
      } catch { if (alive) setLoadError("智能体列表暂时无法读取，当前不展示统计。可重试加载。"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [reload]);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const filtered = agents.filter((a) => {
      if (tab === "draft" && a.status === "pub") return false;
      if (tab === "my" && a.ownerId !== userId) return false;
      if (tab !== "all" && tab !== "draft" && tab !== "my" && a.category !== tab) return false;
      if (q && !`${a.name} ${a.description} ${a.capabilities.join(" ")} ${a.knowledgeBase}`.toLocaleLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((x, y) => (sortBy === "calls" ? y.calls - x.calls : y.score - x.score));
  }, [agents, tab, query, userId, sortBy]);

  const kpis = useMemo(() => {
    const pub = agents.filter((a) => a.status === "pub").length;
    const review = agents.filter((a) => a.status === "review").length;
    const draft = agents.filter((a) => a.status === "draft").length;
    const calls = agents.reduce((s, a) => s + a.calls, 0);
    const rated = agents.filter((a) => a.score > 0);
    const avg = rated.length ? (rated.reduce((s, a) => s + a.score, 0) / rated.length).toFixed(1) : "—";
    return [
      { label: "智能体总数", value: String(agents.length), d: `已发布 ${pub} / 草稿 ${draft}`, icon: "Bot", glyph: "agent-workspace" as const },
      { label: "累计调用", value: calls.toLocaleString(), d: "全部智能体合计", icon: "MessageCircle", glyph: "conversations" as const },
      { label: "平均评分", value: avg, d: `覆盖 ${rated.length} 个智能体`, icon: "Star", glyph: "verified-quality" as const },
      { label: "已发布", value: String(pub), d: "面向师生开放", icon: "ShieldCheck", glyph: "published-toolbox" as const },
      { label: "待审核", value: String(review), d: "等待管理端复核", icon: "ShieldAlert", glyph: "research-review" as const },
    ];
  }, [agents]);

  const toggleFav = async (id: string, name: string) => {
    const on = !favorites.has(id);
    setFavorites((cur) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; });
    const ok = await apiSetFavorite("agent", id, on, name);
    if (!ok) { setFavorites((cur) => { const n = new Set(cur); if (on) n.delete(id); else n.add(id); return n; }); setNotice("收藏失败"); }
  };
  const submitReview = async (id: string) => {
    const a = await apiSetAgentStatus(id, "review");
    if (a) { setAgents((cur) => cur.map((x) => (x.id === id ? a : x))); setNotice(`「${a.name}」已提交审核`); }
    else setNotice("提交失败（仅草稿可提交，且需为创建者）");
  };
  const remove = async (id: string) => {
    const ok = await apiDeleteAgent(id);
    if (!ok) { setNotice("删除失败（仅可删除自己创建的）"); return; }
    setAgents((cur) => cur.filter((a) => a.id !== id));
    setNotice("已删除该智能体");
  };
  const use = (id: string) => router.push(`/chat?agent=${encodeURIComponent(id)}`);
  const edit = (id: string) => router.push(`/agent/new?id=${encodeURIComponent(id)}`);

  return (
    <div data-testid="agent-workbench" className={`${s.workbench} mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 md:p-7 overflow-x-hidden`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <TeacherFeatureGlyph name="agent-workspace" size={54} fallback={Icons.Bot} priority />
          <div>
            <h1 className="text-[24px] font-semibold">智能体工作台</h1>
            <p className="text-[13px] text-[var(--text-2)]">备课、评价与教研，从一个具体任务开始</p>
          </div>
        </div>
        <div className="flex h-[40px] min-w-[220px] flex-1 max-w-md items-center gap-2 rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[var(--text-3)]">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索智能体" className="h-full min-w-0 w-full bg-transparent text-[13px] outline-none" placeholder={view === "templates" ? "搜索任务，如：量规、观课、家校..." : "搜索智能体名称、能力或绑定知识库..."} />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--rg-selected-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--c-primary)]">
          <Icons.Bot size={11} /> 已发布 {loading || loadError ? "--" : agents.filter((a) => a.status === "pub").length} 个
        </span>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/admin/agents"><ShieldCheck size={13} /> 发布审批</Link>
        </Button>
        <Button asChild variant="grad" size="sm" className="gap-1.5">
          <Link href="/agent/new"><Plus size={14} /> 新建智能体</Link>
        </Button>
      </div>

      {/* KPIs（真实统计，非编造） */}
      <div className={s.stats} aria-label="现有智能体统计">{kpis.map(k => <div className={s.stat} key={k.label} title={k.d}><span>{k.label}</span><strong>{loading || loadError ? "--" : k.value}</strong></div>)}</div>
      <div className={s.viewTabs} role="group" aria-label="工作台视图">
        <button aria-pressed={view === "templates"} onClick={() => { setView("templates"); setQuery(""); }}><Icons.LayoutGrid size={17} />场景助手<span>{AGENT_TEMPLATES.length}</span></button>
        <button aria-pressed={view === "agents"} onClick={() => { setView("agents"); setQuery(""); setReload(n => n + 1); }}><Icons.Bot size={17} />现有智能体<span>{loading || loadError ? "--" : agents.length}</span></button>
      </div>
      {loadError && <div role="alert" className="mt-3 text-sm text-[var(--err-ink)]">{loadError} <button className="underline" onClick={() => setReload(n => n + 1)}>重新加载</button></div>}
      {view === "templates" ? <AgentTemplateLibrary key={userId} query={query} clearQuery={() => setQuery("")} userId={userId} inspectExisting={() => { setView("agents"); setQuery(""); setReload(n => n + 1); }} /> : <>
      {loading && <div className="mt-4"><GenerationProgress label="正在读取智能体列表" /></div>}

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab} className="max-w-full overflow-x-auto">
          <TabsList>
            {TABS.map((t) => (<TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>))}
          </TabsList>
        </Tabs>
        <span className="text-[12px] text-[var(--text-3)]">共 {list.length} 个智能体</span>
        <div className="ml-auto">
          <Button onClick={() => setSortBy((s) => (s === "calls" ? "score" : "calls"))} variant="outline" size="sm" className="gap-1.5">
            <Filter size={12} /> 排序 · {sortBy === "calls" ? "调用量" : "评分"}
          </Button>
        </div>
      </div>

      {notice && <div role="status" aria-live="polite" className="mt-3 text-[12px] text-[var(--text-2)]">{notice}</div>}
      {!loading && !loadError && !list.length && <p role="status" className="mt-5 text-sm text-[var(--text-2)]">暂无匹配的智能体。可以清除搜索，或从场景助手创建个人草稿。</p>}

      {/* Grid */}
      <Reveal delay={0.08} className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Link
          href="/agent/new"
          className="surface-card group flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[var(--border)] p-7 text-center transition-all hover:-translate-y-0.5 hover:border-[var(--c-edu)]/40 hover:shadow-[var(--shadow-md)]"
        >
          <div className="grid h-12 w-12 place-items-center rounded-[12px] text-white shadow-md transition-transform group-hover:scale-110"
            style={{ backgroundImage: "linear-gradient(135deg,var(--c-cyan),var(--proc))" }}>
            <Plus size={20} />
          </div>
          <h3 className="text-[14px] font-semibold">新建智能体</h3>
          <p className="text-[12px] leading-[1.7] text-[var(--text-2)]">
            配置你的专属 AI 助手：基础信息 → 模型 → 提示词 → 知识库 → 发布
          </p>
          <Badge variant="violet"><Sparkles size={11} className="mr-1" /> 从模板创建</Badge>
        </Link>

        {!loadError && !loading && list.map((a) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Ic = (Icons as any)[a.icon] as React.ComponentType<{ size?: number }>;
          const owned = !!userId && a.ownerId === userId;
          const canLaunch = a.status === "pub" || (owned && a.status !== "disabled");
          return (
            <div key={a.id} className="surface-card group relative overflow-hidden p-5">
              <div className="flex items-start gap-3">
                <TeacherFeatureGlyph name={featureGlyphForAgent(a.icon)} size={50} fallback={Ic} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {/* title：长名在窄卡截断时把全名交还给悬停/长按（视觉门的可恢复截断谓词）。 */}
                    <div title={a.name} className="truncate text-[14px] font-semibold">{a.name}</div>
                  </div>
                  {/* 来源分级并入 meta 行（受管目录范式）：它与「由 X 创建」同层语义，
                      放卡头会挤压长名导致平板档截断（视觉门实抓）。只渲染字段说的话——
                      旧行无 origin 不渲染任何分级。 */}
                  <div className="mt-0.5 truncate text-[11px] text-[var(--text-2)]">
                    {a.category} · 由 {a.creator} 创建{owned && " · 我"}
                    {a.origin === "school" && <span className="ml-1.5 font-semibold text-[var(--c-edu)]">· 校方审定</span>}
                    {a.origin === "teacher" && <span className="ml-1.5">· 教师自建</span>}
                  </div>
                </div>
                {a.status === "pub" && <Badge variant="green">已发布</Badge>}
                {a.status === "draft" && <Badge>草稿</Badge>}
                {a.status === "review" && <Badge variant="gold">待审核</Badge>}
                {a.status === "disabled" && <Badge variant="red">已停用</Badge>}
              </div>
              <p className="mt-3 line-clamp-2 text-[12px] leading-[1.7] text-[var(--text-2)]">{a.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.capabilities.map((c) => (<Badge key={c}>{c}</Badge>))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-[12px] bg-[var(--rg-hover-bg)] p-2.5 text-[11px]">
                <div><div className="text-[var(--text-3)]">模型</div><div className="text-num font-semibold">{a.recommendedModel}</div></div>
                <div><div className="text-[var(--text-3)]">调用</div><div className="text-num font-semibold">{a.calls.toLocaleString()}</div></div>
                <div><div className="text-[var(--text-3)]">评分</div><div className="text-num font-semibold text-[var(--c-gold)]">{a.score || "—"}</div></div>
              </div>
              <div className="mt-1.5 text-[11px] text-[var(--text-2)]"><Icons.BookOpen className="inline" size={11} /> 绑定知识库：{a.knowledgeBase || "未绑定"}</div>
              <div className="mt-3 flex gap-1.5">
                <Button onClick={() => use(a.id)} disabled={!canLaunch} variant="grad" size="sm" className="flex-1 gap-1"><Send size={12} /> {a.status === "pub" ? "开始使用" : "预览测试"}</Button>
                <Button onClick={() => (owned ? edit(a.id) : toggleFav(a.id, a.name))} variant="outline" size="sm" className="gap-1" aria-label={owned ? `编辑 ${a.name}` : `收藏 ${a.name}`}>
                  {owned ? <><Pencil size={12} /> 编辑</> : <Star size={13} className={favorites.has(a.id) ? "fill-current text-[var(--c-gold)]" : ""} />}
                </Button>
                <details className="relative">
                  <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-[12px] border border-[var(--border-2)] text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)] [&::-webkit-details-marker]:hidden" aria-label={`${a.name} 更多操作`}>
                    <MoreHorizontal size={14} />
                  </summary>
                  <div role="menu" className="absolute right-0 z-10 mt-1 min-w-[150px] overflow-hidden rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] py-1 shadow-lg">
                    <button role="menuitem" onClick={() => toggleFav(a.id, a.name)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--rg-hover-bg)]">
                      <Star size={12} className={favorites.has(a.id) ? "fill-current text-[var(--c-gold)]" : ""} /> {favorites.has(a.id) ? "取消收藏" : "收藏"}
                    </button>
                    {owned && a.status === "draft" && (
                      <button role="menuitem" onClick={() => submitReview(a.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--rg-hover-bg)]">
                        <Upload size={12} /> 提交审核
                      </button>
                    )}
                    {owned && (
                      <button role="menuitem" onClick={() => edit(a.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--rg-hover-bg)]">
                        <Pencil size={12} /> 编辑
                      </button>
                    )}
                    {owned && (
                      <button role="menuitem" onClick={() => remove(a.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-[var(--c-alert)] hover:bg-[var(--err-bg)]">
                        <Trash2 size={12} /> 删除
                      </button>
                    )}
                  </div>
                </details>
              </div>
            </div>
          );
        })}
      </Reveal>

      </>}
    </div>
  );
}
