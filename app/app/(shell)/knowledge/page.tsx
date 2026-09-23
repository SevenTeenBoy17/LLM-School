"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { Search, Plus, LayoutGrid, Rows, Send, Trash2, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/collapsible";
import { Reveal } from "@/components/common/EduArt";
import { TeacherFeatureIcon } from "@/components/common/TeacherNavIcon";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { canAccessSchoolResources } from "@/lib/nav";
import { UploadDialog } from "@/components/knowledge/UploadDialog";
import { TeacherShared } from "@/components/knowledge/TeacherShared";
import { apiListKb, apiGetKb, apiDeleteKb, apiSearchKb, humanSize, type KbFileDto, type KbFileDetail, type KbHit } from "@/lib/client/kbApi";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "card";
const SCOPES = [
  { id: "all", name: "全部可见", icon: "FolderOpen" },
  { id: "self", name: "我的上传", icon: "User" },
  { id: "course", name: "课程共享", icon: "Users" },
  { id: "college", name: "学部共享", icon: "GraduationCap" },
  { id: "all_school", name: "全校公开", icon: "Globe" },
];
// V2 §3.1 R1：原为 6 种文件类型各配一条渐变（颜色表达「归属」）。
// 类型区分本来就由图标 + 角标文字承担，颜色再编码一遍既冗余又撑爆色板。
// 统一为强调色 tint 底，仍与正文可区分，但不再用颜色编码类型。
const TYPE_TINT = "var(--accent-tint)";
function timeAgo(ts: number) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "刚刚"; if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`; return `${Math.floor(d / 86400)} 天前`;
}

export default function KnowledgePage() {
  const sessionRole = useSessionRole();
  const [files, setFiles] = useState<KbFileDto[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState("all");
  const [view, setView] = useState<ViewMode>("table");
  const [activeId, setActiveId] = useState<string>("");
  const [detail, setDetail] = useState<KbFileDetail | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<KbHit[]>([]);
  const [hitsFor, setHitsFor] = useState(""); // hits 对应的查询词，防止旧结果被标成新查询
  const [searching, setSearching] = useState(false);
  const [testQ, setTestQ] = useState("教学目标");
  const [testHits, setTestHits] = useState<KbHit[] | null>(null);
  const [notice, setNotice] = useState("");

  // 供上传完成 / 删除后刷新列表（事件处理器，非 effect）。
  const refresh = async () => {
    setLoading(true);
    const { files: list, userId: uid } = await apiListKb();
    setFiles(list); setUserId(uid); setLoading(false);
    setActiveId((cur) => cur || list[0]?.id || "");
  };

  // 首屏载入（内联 IIFE，setState 均在 await 之后）
  useEffect(() => {
    let alive = true;
    (async () => {
      const { files: list, userId: uid } = await apiListKb();
      if (!alive) return;
      setFiles(list); setUserId(uid); setLoading(false);
      setActiveId((cur) => cur || list[0]?.id || "");
    })();
    return () => { alive = false; };
  }, []);

  // 选中变化时立即清空详情（渲染期「上一次」模式，避免 effect 内 setState）
  const [detailFor, setDetailFor] = useState("");
  if (activeId !== detailFor) { setDetailFor(activeId); setDetail(null); }
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    (async () => { const d = await apiGetKb(activeId); if (alive) setDetail(d); })();
    return () => { alive = false; };
  }, [activeId]);

  // 防抖全库关键词检索（setState 仅在定时器回调，不在 effect 同步体）
  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await apiSearchKb(term);
      if (!cancelled) { setHits(r); setHitsFor(term); setSearching(false); }
    }, 240);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);
  // 仅当 hits 正是当前查询的结果才展示，否则空——切词时不把旧命中冒充成新查询。
  const searchTerm = query.trim();
  const shownHits = searchTerm && hitsFor === searchTerm ? hits : [];

  const shown = useMemo(() => {
    return files.filter((f) => {
      if (bucket === "self") return f.ownerId === userId;
      if (bucket === "course") return f.scope === "course";
      if (bucket === "college") return f.scope === "college";
      if (bucket === "all_school") return f.scope === "all";
      return true;
    });
  }, [files, bucket, userId]);

  const stats = useMemo(() => {
    const withText = files.filter((f) => f.hasText).length;
    const chunks = files.reduce((s, f) => s + f.chunkCount, 0);
    const mine = files.filter((f) => f.ownerId === userId).length;
    return { total: files.length, withText, chunks, mine };
  }, [files, userId]);

  const runTest = async () => { setTestHits(await apiSearchKb(testQ)); };
  const remove = async (id: string) => {
    const ok = await apiDeleteKb(id);
    if (!ok) { setNotice("删除失败（仅可删自己上传的）"); return; }
    setFiles((cur) => cur.filter((f) => f.id !== id));
    if (activeId === id) setActiveId("");
    setNotice("已删除该文件");
  };

  return (
    <div className="teacher-workspace teacher-knowledge-workspace flex flex-1 min-w-0">
      {/* Scope buckets */}
      <aside className="teacher-scope-rail hidden 2xl:flex w-[220px] shrink-0 flex-col gap-1 border-r border-[var(--border-2)] bg-[var(--card)]/40 p-4 backdrop-blur-sm">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">按范围浏览</div>
        {SCOPES.map((s) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Ic = (Icons as any)[s.icon] as React.ComponentType<{ size?: number }>;
          const count = s.id === "all" ? files.length
            : s.id === "self" ? files.filter((f) => f.ownerId === userId).length
            : s.id === "all_school" ? files.filter((f) => f.scope === "all").length
            : files.filter((f) => f.scope === s.id).length;
          return (
            <button key={s.id} onClick={() => setBucket(s.id)} aria-pressed={bucket === s.id}
              className={cn("flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] transition-colors",
                bucket === s.id ? "bg-[var(--rg-selected-bg)] text-[var(--c-primary)] font-semibold" : "text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)]")}>
              <span className="grid h-7 w-7 place-items-center rounded-[12px] bg-[var(--rg-control-bg)] text-[var(--text-2)]">{Ic && <Ic size={13} />}</span>
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-[11px] text-[var(--text-3)]">{count}</span>
            </button>
          );
        })}
        <div className="mt-4 rounded-[12px] border border-[var(--border-2)] p-3 text-[12px] leading-[1.7] text-[var(--text-2)]">
          校内<strong className="text-[var(--text)]">关键词检索</strong>（多词分词 + 相关性排序，非向量语义）。文本类文件（txt/md/csv…）会索引全文；PDF/Word/PPT 等暂按文件名与说明检索。
        </div>
      </aside>

      <div className="flex flex-1 min-w-0 flex-col">
        <div className="teacher-toolbar border-b border-[var(--border-2)] bg-[var(--card)]/40 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <TeacherFeatureIcon name="knowledge" size={50} fallback={FolderOpen} />
              <div>
                <h1 className="text-[24px] font-semibold tracking-tight">知识库</h1>
                <p className="text-[13px] text-[var(--text-2)]">承载教学、制度、科研资料，为 AI 回答提供校内可信来源（关键词检索）</p>
              </div>
            </div>
            <div className="flex h-10 flex-1 max-w-md items-center gap-2 rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[var(--text-3)]">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索知识库文件" className="h-10 min-h-[40px] w-full bg-transparent text-[13px] outline-none" placeholder="按文件名或正文检索，多词用空格分隔…" />
              {searching && query.trim() && <Loader2 size={13} className="animate-spin" />}
            </div>
            <div className="inline-flex rounded-[12px] bg-[var(--rg-control-bg)] p-0.5 text-[12px]">
              <button aria-pressed={view === "table"} onClick={() => setView("table")} className={cn("flex min-h-[40px] items-center gap-1 rounded-[12px] px-3 py-1", view === "table" ? "bg-[var(--card)] shadow-sm" : "text-[var(--text-2)]")}><Rows size={12} /> 表格</button>
              <button aria-pressed={view === "card"} onClick={() => setView("card")} className={cn("flex min-h-[40px] items-center gap-1 rounded-[12px] px-3 py-1", view === "card" ? "bg-[var(--card)] shadow-sm" : "text-[var(--text-2)]")}><LayoutGrid size={12} /> 卡片</button>
            </div>
            {canAccessSchoolResources(sessionRole) && <Link href="/knowledge/resources" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] font-medium text-[var(--text)] hover:bg-[var(--rg-hover-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-primary)]"><SchoolResourceIcon name="library" size={28} />校内资源库</Link>}
            <Button variant="grad" size="sm" className="min-h-[40px] gap-1.5" onClick={() => setUploadOpen(true)}><Plus size={14} /> 上传文件</Button>
          </div>

          {/* 学生端「老师分享的资料」（产物工作区 V2）：仅学生可见，空态零渲染。 */}
          <div className="mt-4"><TeacherShared /></div>
          <Reveal className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "文件总数", value: String(stats.total), grad: "var(--accent-focus)", icon: "FileText" },
              { label: "已索引全文", value: String(stats.withText), grad: "var(--accent-focus)", icon: "CircleCheck" },
              { label: "分段总数", value: String(stats.chunks), grad: "var(--accent-focus)", icon: "Rows3" },
              { label: "我的上传", value: String(stats.mine), grad: "var(--accent-focus)", icon: "User" },
            ].map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Ic = (Icons as any)[s.icon] as React.ComponentType<{ size?: number }>;
              return (
                <div key={s.label} className="teacher-kpi surface-card flex items-center gap-3 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[12px] text-white" style={{ background: s.grad }}>{Ic && <Ic size={16} />}</div>
                  <div><div className="text-[11px] text-[var(--text-3)]">{s.label}</div><div className="text-num text-[18px] font-bold">{s.value}</div></div>
                </div>
              );
            })}
          </Reveal>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-5">
            {/* 搜索命中优先展示 */}
            {searchTerm && (
              <div className="mb-4 surface-card p-4">
                <div className="mb-2 text-[12px] font-semibold text-[var(--text-2)]">检索「{searchTerm}」· {shownHits.length} 条命中</div>
                {shownHits.length === 0 && !searching && <div className="text-[12px] leading-[1.7] text-[var(--text-3)]">没有命中，换个关键词试试。PDF / Word / PPT 等二进制文件未提取正文，仅按文件名检索。</div>}
                <div className="space-y-1.5">
                  {shownHits.map((h) => (
                    <button key={h.fileId} onClick={() => setActiveId(h.fileId)} className="block w-full rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2 text-left hover:bg-[var(--rg-selected-bg)]">
                      <div className="text-[13px] font-semibold">{h.name}</div>
                      <div className="mt-0.5 text-[12px] leading-[1.6] text-[var(--text-2)]">{h.snippet}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchTerm ? null : loading ? (
              <div className="flex items-center gap-2 p-8 text-[13px] text-[var(--text-3)]"><Loader2 size={16} className="animate-spin" /> 正在载入…</div>
            ) : shown.length === 0 ? (
              <div className="teacher-empty-stage mx-auto mt-12 max-w-[420px] rounded-[20px] border border-[var(--border-2)] p-8 text-center">
                <TeacherFeatureIcon name="knowledge" size={54} fallback={FolderOpen} className="mx-auto" />
                <h3 className="mt-3 text-[14px] font-semibold">这里还没有文件</h3>
                <p className="mt-1 text-[13px] text-[var(--text-2)]">点右上角「上传文件」，txt/md/csv 会索引全文，其余按文件名检索。</p>
                <Button variant="primary" size="sm" className="mt-4 min-h-[40px] gap-1.5" onClick={() => setUploadOpen(true)}><Plus size={14} /> 上传第一份资料</Button>
              </div>
            ) : view === "table" ? (
              <div className="teacher-data-table surface-card overflow-x-auto">
                <div className="grid min-w-[640px] grid-cols-[minmax(220px,1fr)_56px_88px_72px_88px_44px] gap-3 border-b border-[var(--border-2)] bg-[var(--rg-hover-bg)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">
                  <span>文件名</span><span>类型</span><span>上传者</span><span>范围</span><span>更新</span><span></span>
                </div>
                {shown.map((f) => (
                  <div key={f.id} className={cn("grid min-w-[640px] grid-cols-[minmax(220px,1fr)_56px_88px_72px_88px_44px] items-center gap-3 border-b border-[var(--border-2)] px-4 py-3 transition hover:bg-[var(--rg-hover-bg)]", activeId === f.id && "bg-[var(--rg-selected-bg)]")}>
                    <button onClick={() => setActiveId(f.id)} className="flex min-h-[40px] items-center gap-2.5 min-w-0 text-left">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] text-white text-[11px] font-bold" style={{ backgroundImage: TYPE_TINT }}>{f.type}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold">{f.name}</div>
                        <div className="text-[11px] text-[var(--text-2)]">{humanSize(f.sizeBytes)} · {f.chunkCount} 段{f.hasText ? "" : " · 仅文件名可检索"}</div>
                      </div>
                    </button>
                    <span className="text-[12px] text-[var(--text-2)]">{f.type}</span>
                    <span className="text-[12px] truncate">{f.uploader}</span>
                    <span className="text-[12px] text-[var(--text-2)]">{f.scope === "self" ? "仅本人" : f.scope === "course" ? "课程" : f.scope === "college" ? "学部" : "全校"}</span>
                    <span className="text-[12px] text-[var(--text-3)]">{timeAgo(f.createdAt)}</span>
                    {f.ownerId === userId
                      ? <button onClick={() => remove(f.id)} aria-label={`删除 ${f.name}`} className="grid h-[40px] w-[40px] place-items-center rounded-[12px] text-[var(--text-3)] hover:bg-[var(--err-bg)] hover:text-[var(--c-alert)]"><Trash2 size={14} /></button>
                      : <span />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((f) => (
                  <div key={f.id} className={cn("scroll-reveal surface-card p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]", activeId === f.id && "ring-2 ring-[var(--c-edu)]/40")}>
                    <button onClick={() => setActiveId(f.id)} className="flex min-h-[40px] w-full items-start gap-3 text-left">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white font-bold" style={{ backgroundImage: TYPE_TINT }}>{f.type}</span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[14px] font-semibold">{f.name}</div>
                        <div className="mt-0.5 text-[12px] text-[var(--text-2)]">{humanSize(f.sizeBytes)} · {f.chunkCount} 段</div>
                      </div>
                    </button>
                    {f.ownerId === userId && <button onClick={() => remove(f.id)} className="mt-2 inline-flex min-h-[40px] min-w-[40px] items-center gap-1 text-[11px] text-[var(--c-alert)] hover:underline"><Trash2 size={12} /> 删除</button>}
                  </div>
                ))}
              </div>
            )}
            {notice && <div role="status" aria-live="polite" className="mt-3 text-[12px] text-[var(--text-2)]">{notice}</div>}
          </div>
        </div>
      </div>

      {/* Detail */}
      <aside className="teacher-detail-rail hidden xl:flex w-[320px] 2xl:w-[360px] shrink-0 flex-col border-l border-[var(--border-2)] bg-[var(--card)]/40 backdrop-blur-sm">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {detail ? (
            <div className="min-w-0 max-w-full overflow-hidden p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white text-[11px] font-bold" style={{ backgroundImage: TYPE_TINT }}>{detail.type}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-[14px] font-semibold">{detail.name}</h3>
                  <div className="mt-1 text-[12px] text-[var(--text-2)]">{humanSize(detail.sizeBytes)} · {detail.uploader} · {timeAgo(detail.createdAt)}</div>
                </div>
              </div>

              <PdSection label="索引状态（关键词，非向量）">
                <div className="space-y-1.5 text-[12px]">
                  <Row k="文本提取" v={detail.hasText ? "已索引全文" : "未提取（二进制文件）"} ok={detail.hasText} />
                  <Row k="分段数" v={`${detail.chunkCount} 段`} ok />
                  <Row k="可检索范围" v={detail.hasText ? "文件名 + 正文" : "仅文件名"} ok={detail.hasText} />
                </div>
              </PdSection>

              {detail.textPreview && (
                <div className="mt-5">
                  <Collapsible title="正文预览（前 600 字）" summary="点击展开已索引的正文片段">
                    <div className="max-h-[220px] overflow-y-auto break-words rounded-[12px] bg-[var(--rg-hover-bg)] p-2.5 text-[12px] leading-[1.7] text-[var(--text-2)] whitespace-pre-wrap">{detail.textPreview}</div>
                  </Collapsible>
                </div>
              )}

              <PdSection label="检索测试 · 关键词命中真实片段">
                <div className="rounded-[12px] border border-[var(--border-2)] bg-[var(--rg-hover-bg)] p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <input value={testQ} onChange={(e) => setTestQ(e.target.value)} aria-label="在知识库中试问一个关键词" className="h-9 flex-1 rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]" placeholder="输入关键词" />
                    <Button onClick={runTest} aria-label="运行检索测试" variant="grad" size="sm" className="min-h-[40px] px-3"><Send size={12} /></Button>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {testHits === null ? (
                      <div className="text-[12px] text-[var(--text-3)]">输入关键词并发送，返回真实命中片段（跨你可见的全部文件）。</div>
                    ) : testHits.length === 0 ? (
                      <div className="text-[12px] text-[var(--text-3)]">没有命中。</div>
                    ) : testHits.map((h) => (
                      <div key={h.fileId} className="text-[12px]">
                        <span className="font-semibold">{h.name}</span>
                        <span className="ml-1 break-words text-[var(--text-2)]">{h.snippet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PdSection>
            </div>
          ) : (
            <div className="p-8 text-center text-[13px] text-[var(--text-3)]">选择左侧文件查看详情</div>
          )}
        </div>
      </aside>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={refresh} />
    </div>
  );
}

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2">
      <span>{k}</span><span className={ok ? "font-semibold text-[var(--c-growth)]" : "text-[var(--text-2)]"}>{v}</span>
    </div>
  );
}

function PdSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">{label}</div>
      {children}
    </div>
  );
}
