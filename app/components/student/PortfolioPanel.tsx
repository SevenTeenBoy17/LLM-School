"use client";

import { useEffect, useState } from "react";
import { FolderHeart, Lock, Printer, ArrowLeft, ArrowUpRight, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * W-B3 · 成长档案袋（规格⑦）。
 * 双版=两种产物：简约版（遴选 ≤6 条 + 客观数据摘要）/ 详细版（全量时间线）。
 * 空栏目=鼓励性占位而非警告（广东综评「避免面面俱到」）；数据缺失显示「暂无」，不补造（R6）。
 * AI 建议只展示教师已发布定稿，署名双归因 + 常驻「仅供参考」脚注（R5）。
 */

interface Entry { kind: "activity" | "evaluation"; at: number; subject?: string; title?: string; studentText?: string; teacherText?: string; tag?: string; artifactName?: string; source?: string; artifactId?: string; revision?: number }
interface Summary {
  mode: string;
  objective: { quiz: { total: number; correct: number }; mistakes: { total: number; reviewed: number }; activeDays7: number };
  entries: Entry[];
  evaluations: Array<{ id: string; tag: string; createdAt: number }>;
  truncated: boolean;
}
interface Advice { id: string; text: string; publishedAt: number | null; teacherName: string }
interface SnapMeta { id: string; term: string; createdAt: number }
interface Snapshot { term: string; createdAt: number; payload: { term: string; studentName: string; lockedAt: number; summary: Summary } }

/** 学期建议名：8-1 月为秋季学期，2-7 月为春季学期。 */
function suggestTerm(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  return m >= 8 ? `${d.getFullYear()} 秋季学期` : m <= 1 ? `${d.getFullYear() - 1} 秋季学期` : `${d.getFullYear()} 春季学期`;
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

export function PortfolioPanel() {
  const [mode, setMode] = useState<"simple" | "full">("simple");
  const [data, setData] = useState<Summary | null>(null);
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [error, setError] = useState(false);
  // G3：学期归档（确认→锁定→版本化）+ 只读回看 + 打印
  const [snaps, setSnaps] = useState<SnapMeta[]>([]);
  const [term, setTerm] = useState(suggestTerm());
  const [viewing, setViewing] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const loadSnaps = () => {
    fetch("/api/portfolio/snapshots").then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setSnaps(d.snapshots ?? [])).catch(() => { /* 归档区加载失败不拦主体 */ });
  };
  useEffect(loadSnaps, []);

  const lock = async () => {
    if (busy || !term.trim()) return;
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/portfolio/snapshots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ term: term.trim() }) });
      const d = await r.json();
      if (r.ok) { setNote("已归档锁定——这一册从此不再改动，只能追加新学期。"); loadSnaps(); }
      else setNote(d.message || "归档失败");
    } catch { setNote("网络异常，请重试"); } finally { setBusy(false); }
  };

  const openSnap = async (id: string) => {
    setNote("");
    try {
      const r = await fetch(`/api/portfolio/snapshots?id=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (r.ok) setViewing(d);
      else setNote(d.message || "读取失败");
    } catch { setNote("网络异常，请重试"); }
  };

  useEffect(() => {
    let alive = true;
    fetch(`/api/portfolio/summary?mode=${mode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [mode]);

  useEffect(() => {
    let alive = true;
    fetch("/api/portfolio/advice")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setAdvice(d.advice ?? []); })
      .catch(() => { /* 建议区加载失败不拦档案主体 */ });
    return () => { alive = false; };
  }, []);

  if (error) return <p className="text-[13px] text-[var(--text-2)]">档案袋加载失败，稍后再试。</p>;
  if (!data) return <p className="text-[13px] text-[var(--text-3)]">正在整理你的档案袋…</p>;

  // G3 只读回看：冻结数据 + 打印（print CSS 只显打印区，组件内联避免动 globals）
  if (viewing) {
    const s = viewing.payload.summary;
    return (
      <div className="space-y-3">
        <style>{`@media print { body * { visibility: hidden; } .pf-print, .pf-print * { visibility: visible; } .pf-print { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button type="button" onClick={() => setViewing(null)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-[12px] border border-[var(--border-2)] px-3 text-[13px] text-[var(--text-2)] transition-colors hover:text-[var(--text)]">
            <ArrowLeft size={14} /> 返回
          </button>
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text)]"><Lock size={14} className="text-[var(--text-3)]" /> {viewing.term} · 已锁定版本</span>
          <button type="button" onClick={() => window.print()}
            className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-4 text-[13px] font-semibold text-white shadow-sm"
            style={{ backgroundImage: "var(--grad-primary)" }}>
            <Printer size={14} /> 打印报告
          </button>
        </div>
        <div className="pf-print rounded-[12px] border border-[var(--border-2)] p-4">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">{viewing.payload.studentName} · {viewing.term} 成长档案</h3>
          <p className="mt-0.5 text-[12px] text-[var(--text-3)]">归档于 {new Date(viewing.payload.lockedAt).toLocaleDateString("zh-CN")} · 锁定后未改动 · i-learning</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { label: "近30天小测", value: s.objective.quiz.total > 0 ? `${s.objective.quiz.correct}/${s.objective.quiz.total} 题答对` : "暂无" },
              { label: "错题清理", value: s.objective.mistakes.total > 0 ? `${s.objective.mistakes.reviewed}/${s.objective.mistakes.total} 道已清` : "暂无" },
              { label: "近7天学习", value: s.objective.activeDays7 > 0 ? `${s.objective.activeDays7} 天有学习记录` : "暂无" },
            ].map((x) => (
              <div key={x.label} className="rounded-[10px] border border-[var(--border-2)] p-2.5">
                <div className="text-[12px] text-[var(--text-3)]">{x.label}</div>
                <div className="text-[13px] font-semibold text-[var(--text)]">{x.value}</div>
              </div>
            ))}
          </div>
          <h4 className="mt-4 text-[14px] font-semibold text-[var(--text)]">成长记录（学期精选）</h4>
          {s.entries.length === 0 ? (
            <p className="mt-1.5 text-[13px] text-[var(--text-2)]">本学期暂无入册记录。</p>
          ) : (
            <ul className="mt-1.5 space-y-2">
              {s.entries.map((e, i) => (
                <li key={i} className="rounded-[10px] border border-[var(--border-2)] p-2.5">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{e.subject} · {e.title}</div>
                  {e.studentText && <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{e.studentText}</p>}
                  {e.teacherText && <p className="mt-0.5 text-[12px] text-[var(--text-2)]">老师评语：{e.teacherText}</p>}
                  {e.artifactName && <p className="mt-0.5 text-[12px] text-[var(--text-3)]">佐证材料：{e.artifactName}</p>}
                  {e.source === "manor" && <p className="mt-1 text-[12px] text-[var(--text-3)]">个人庄园 · 归档时版本 {e.revision ?? "未记录"}</p>}
                </li>
              ))}
            </ul>
          )}
          {s.evaluations.length > 0 && (
            <>
              <h4 className="mt-4 text-[14px] font-semibold text-[var(--text)]">课堂点评</h4>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">{s.evaluations.map((e) => e.tag).join("、")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[12px] bg-[var(--rg-control-bg)] p-0.5 text-[13px]" role="tablist" aria-label="档案袋版式">
          <button role="tab" aria-selected={mode === "simple"} onClick={() => setMode("simple")}
            className={cn("min-h-[38px] rounded-[12px] px-3.5", mode === "simple" ? "bg-[var(--card)] font-semibold shadow-sm" : "text-[var(--text-2)]")}>简约版</button>
          <button role="tab" aria-selected={mode === "full"} onClick={() => setMode("full")}
            className={cn("min-h-[38px] rounded-[12px] px-3.5", mode === "full" ? "bg-[var(--card)] font-semibold shadow-sm" : "text-[var(--text-2)]")}>详细版</button>
        </div>
        <p className="text-[12px] text-[var(--text-3)]">简约版是学期精选，详细版是全量记录流水。</p>
      </div>

      {/* 客观数据摘要：系统自动导入，不可编辑（规格⑥-3 双通道分权） */}
      <section aria-label="客观数据" className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "近30天小测", value: data.objective.quiz.total > 0 ? `${data.objective.quiz.correct}/${data.objective.quiz.total} 题答对` : "暂无" },
          { label: "错题清理", value: data.objective.mistakes.total > 0 ? `${data.objective.mistakes.reviewed}/${data.objective.mistakes.total} 道已清` : "暂无" },
          { label: "近7天学习", value: data.objective.activeDays7 > 0 ? `${data.objective.activeDays7} 天有学习记录` : "暂无" },
        ].map((s) => (
          <div key={s.label} className="rounded-[12px] border border-[var(--border-2)] p-3">
            <div className="text-[12px] text-[var(--text-3)]">{s.label} · 系统自动记录</div>
            <div className="mt-0.5 text-[13px] font-semibold text-[var(--text)]">{s.value}</div>
          </div>
        ))}
      </section>

      {/* 成长记录：只收教师批准入册的活动（学生自报不直达档案，规格⑥-3） */}
      <section aria-label="成长记录">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text)]"><FolderHeart size={15} className="text-[var(--accent)]" /> 成长记录{mode === "simple" ? "（精选）" : "（全量时间线）"}</h3>
        {data.entries.length === 0 ? (
          <p className="mt-2 rounded-[12px] border border-dashed border-[var(--border-2)] p-4 text-[13px] text-[var(--text-2)]">
            这里还空着——完成一次项目活动并通过老师批阅后，它就会出现在这里。第一条记录永远是最难的，也是最值得的。
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.entries.map((e, i) => (
              <li key={i} className="rounded-[12px] border border-[var(--border-2)] p-3">
                {e.kind === "activity" ? (
                  <>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded-full border border-[var(--border-2)] px-2 py-0.5 text-[12px] text-[var(--text-2)]">{e.subject}</span>
                      <span className="text-[13px] font-semibold text-[var(--text)]">{e.title}</span>
                      <span className="ml-auto text-[12px] text-[var(--text-3)]">{fmtDay(e.at)} 入册</span>
                    </div>
                    {e.studentText && <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-2)]">{e.studentText}</p>}
                    {e.teacherText && <p className="mt-1 text-[12px] text-[var(--text-2)]">老师评语：{e.teacherText}</p>}
                    {e.artifactName && <p className="mt-0.5 text-[12px] text-[var(--text-3)]">佐证材料：{e.artifactName}</p>}
                    {e.source === "manor" && e.artifactId && <a href={`/student/manor?artifactId=${encodeURIComponent(e.artifactId)}`} className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-[13px] text-[var(--accent)]"><Sprout size={15} />查看庄园成果 · 版本 {e.revision ?? "未记录"}<ArrowUpRight size={15} /></a>}
                  </>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-2 text-[13px]">
                    <span className="text-[var(--text)]">课堂点评 · {e.tag}</span>
                    {e.teacherText && <span className="text-[var(--text-2)]">{e.teacherText}</span>}
                    <span className="ml-auto text-[12px] text-[var(--text-3)]">{fmtDay(e.at)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {data.truncated && mode === "simple" && (
          <p className="mt-1.5 text-[12px] text-[var(--text-3)]">精选只展示最近 6 条，切到「详细版」看全部。</p>
        )}
      </section>

      {/* G3 学期归档：确认→锁定→版本化（快照不可变；空栏目照样可归档——留白是允许的） */}
      <section aria-label="学期归档" className="rounded-[12px] border border-[var(--border-2)] p-3.5">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text)]"><Lock size={15} className="text-[var(--accent)]" /> 学期归档</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-3)]">学期末把精选档案确认归档——锁定后这一册不再改动，可随时回看和打印。</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={term} onChange={(e) => setTerm(e.target.value)} maxLength={40} aria-label="学期名称"
            className="h-[40px] min-w-0 flex-1 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]/45" />
          <button type="button" onClick={lock} disabled={busy || !term.trim()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text)] transition-colors hover:border-[var(--c-edu)]/45 disabled:opacity-50">
            <Lock size={14} /> 确认并锁定
          </button>
        </div>
        {snaps.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {snaps.map((sn) => (
              <button key={sn.id} type="button" onClick={() => openSnap(sn.id)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/45 hover:text-[var(--text)]">
                <Lock size={12} /> {sn.term}
              </button>
            ))}
          </div>
        )}
        {note && <p role="status" aria-live="polite" className="mt-2 text-[12px] text-[var(--text-2)]">{note}</p>}
      </section>

      {/* AI 成长建议：只显示教师发布定稿（R5 署名双归因 + 常驻脚注） */}
      {advice.length > 0 && (
        <section aria-label="成长建议" className="rounded-[12px] border border-[var(--c-edu)]/25 bg-[var(--rg-selected-bg)] p-3.5">
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text)]"><Sprout size={15} className="text-[var(--accent)]" /> 成长建议</h3>
          {advice.map((a) => (
            <div key={a.id} className="mt-2">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text)]">{a.text}</p>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">AI 辅助生成 · {a.teacherName}老师已确认{a.publishedAt ? ` · ${fmtDay(a.publishedAt)}` : ""}</p>
            </div>
          ))}
          <p className="mt-2 border-t border-[var(--border-2)] pt-2 text-[12px] text-[var(--text-3)]">以上建议由 AI 生成，仅供参考，请结合老师意见使用。</p>
        </section>
      )}
    </div>
  );
}
