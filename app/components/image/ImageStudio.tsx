"use client";

/**
 * ImageStudio —— 生图工作台共享组件（M1/B3 从学生页抽出）。
 * 学生端（/student/tools/image）与教师端（/hub/image）共用同一异步任务式 UX：
 * 提交 → 服务端安全门/配额 → 任务进度 → 轮询 → 画廊。安全与配额全在服务端。
 */
import { useEffect, useState } from "react";
import { Palette, Send, ImageOff, Download, Wand2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/common/EduArt";
import { GenerationProgress } from "@/components/common/GenerationProgress";

interface JobRow {
  id: string; prompt: string; size: string;
  status: "pending" | "done" | "failed"; error?: string; createdAt: number;
}

export function ImageStudio({
  subtitle,
  headerIcon,
  templates,
  quotaLimit,
  footnote,
}: {
  subtitle: string;
  /** 页头图标。学生端传 3D 卡通图标；教师端不传 = 保持控制台的线性徽标。
   *  共享组件不替两端做视觉主张——这正是 H14 把它留到本轮的原因。 */
  headerIcon?: React.ReactNode;
  templates: string[];
  quotaLimit: number;
  footnote: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [usedToday, setUsedToday] = useState(0);
  const [notice, setNotice] = useState<{ kind: "warn" | "crisis"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pollFailed, setPollFailed] = useState(false);
  // H8 · AI 一键润色：真实网关改写；prevPrompt 支持一步撤销（学生的原话不该被悄悄吃掉）
  const [polishing, setPolishing] = useState(false);
  const [prevPrompt, setPrevPrompt] = useState<string | null>(null);

  // 轮询任务列表（5s；interval 回调内 setState，合规）
  useEffect(() => {
    let disposed = false;
    let loading = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (loading) return;
      loading = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15000);
      try {
        const r = await fetch("/api/image/jobs", { cache: "no-store", signal: controller.signal });
        if (!r.ok) throw new Error(`jobs_${r.status}`);
        const j = await r.json();
        if (disposed) return;
        setJobs(j.jobs ?? []);
        setUsedToday(j.usedToday ?? 0);
        setPollFailed(false);
      } catch {
        if (!disposed) setPollFailed(true);
      } finally {
        clearTimeout(timeout);
        loading = false;
      }
    };
    const t0 = setTimeout(load, 0);
    const t = setInterval(load, 5000);
    return () => { disposed = true; clearTimeout(t0); clearInterval(t); controller?.abort(); };
  }, []);

  const polish = async () => {
    if (prompt.trim().length < 4 || polishing) return;
    setPolishing(true);
    try {
      const r = await fetch("/api/image/polish", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const d = await r.json();
      if (r.ok && d.polished) {
        setPrevPrompt(prompt);
        setPrompt(d.polished);
        setNotice(null);
      } else {
        setNotice({ kind: "warn", text: d.message || "润色服务暂时不可用，请稍后再试" });
      }
    } catch {
      setNotice({ kind: "warn", text: "网络异常，请重试" });
    } finally { setPolishing(false); }
  };
  const undoPolish = () => {
    if (prevPrompt !== null) { setPrompt(prevPrompt); setPrevPrompt(null); }
  };

  // H8 · 下载：走同源 blob（会话内鉴权由 /api/image/file 服务端把关）
  const download = async (id: string, promptText: string) => {
    if (downloadingId !== null) return;
    setDownloadingId(id);
    try {
      const r = await fetch(`/api/image/file/${id}`);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AI生图-${promptText.slice(0, 12).replace(/[\\/:*?"<>|\s]/g, "") || id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice({ kind: "warn", text: "下载失败，请重试" });
    } finally {
      setDownloadingId(null);
    }
  };

  const submit = async () => {
    const p = prompt.trim();
    if (p.length < 4 || submitting) return;
    setSubmitting(true); setNotice(null);
    try {
      const r = await fetch("/api/image/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, size: "1536x1024" }),
      });
      const j = await r.json();
      if (j.kind === "ok") {
        setPrompt("");
        setJobs((cur) => [{ id: j.jobId, prompt: p, size: "1536x1024", status: "pending", createdAt: Date.now() }, ...cur]);
        setUsedToday((n) => n + 1);
      } else if (j.kind === "crisis") {
        // 危机关怀响应：醒目卡片呈现（终审 P2：不得降格为小字警告）
        setNotice({ kind: "crisis", text: String(j.reply ?? "").replace(/\*\*/g, "") });
      } else {
        setNotice({ kind: "warn", text: j.reply ?? "提交失败，稍后再试" });
      }
    } catch { setNotice({ kind: "warn", text: "网络异常，稍后再试" }); }
    finally { setSubmitting(false); }
  };

  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[860px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {headerIcon ?? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><Palette size={20} /></span>}
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">AI 生图</h1>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">{subtitle}</p>
            </div>
          </div>
          <span className="rounded-full bg-[var(--rg-control-bg)] px-3 py-1 text-[12px] text-[var(--text-2)]">今日 {usedToday} / {quotaLimit} 张（公平使用）</span>
        </div>

        {/* 输入区 */}
        <Reveal delay={0.05} className="mt-5">
          <div className="surface-card p-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              maxLength={600}
              aria-label="描述你想生成的图片"
              placeholder="描述越具体，画得越好…"
              className="w-full resize-none rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 text-[13px] leading-relaxed outline-none focus:border-[var(--c-edu)]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {templates.map((t) => (
                <button key={t} type="button" onClick={() => setPrompt(t)} className="max-w-full truncate rounded-full bg-[var(--rg-selected-bg)] px-3 py-1.5 text-[12px] text-[var(--info-ink)] transition hover:-translate-y-px">
                  {t.slice(0, 18)}…
                </button>
              ))}
              <button type="button" onClick={polish} disabled={prompt.trim().length < 4 || polishing}
                title="AI 按五要素（主体/场景/构图/色彩光线/风格质量词）改写你的描述，原话可一键撤回"
                className="ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/45 hover:text-[var(--text)] disabled:opacity-50">
                <Wand2 size={14} /> AI 润色
              </button>
              {prevPrompt !== null && (
                <button type="button" onClick={undoPolish}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-2.5 text-[12px] text-[var(--text-3)] transition-colors hover:text-[var(--text)]">
                  <Undo2 size={13} /> 撤销润色
                </button>
              )}
              <Button variant="grad" size="sm" className="min-h-[40px] gap-1.5" disabled={prompt.trim().length < 4 || submitting} onClick={submit}>
                <Send size={14} /> 生成
              </Button>
            </div>
            {polishing && <GenerationProgress label="正在润色图片描述" className="mt-3" />}
            {submitting && <GenerationProgress label="正在提交生图任务" className="mt-3" />}
            {notice?.kind === "warn" && <p role="status" aria-live="polite" className="mt-2 text-[12px] text-[var(--warn-ink)]">{notice.text}</p>}
            {notice?.kind === "crisis" && (
              <div role="alert" className="mt-3 rounded-[12px] border border-[var(--ok)]/40 bg-[var(--ok-bg)] p-4">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ok-ink)]">{notice.text}</p>
                <p className="mt-2 text-[13px] font-semibold text-[var(--ok-ink)]">心理援助热线：<a href="tel:12356" data-no-press className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] bg-[var(--ok-bg)] px-3 underline underline-offset-2">12356</a>（24 小时）· 也可以点「安全求助」按钮找校内老师</p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-[var(--text-3)]">{footnote}</p>
          </div>
        </Reveal>

        {/* 画廊 */}
        {pollFailed && <p role="status" className="mt-4 text-[12px] text-[var(--warn-ink)]">任务状态暂时无法更新，显示的是上次状态；正在重试连接。</p>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {jobs.length === 0 && !pollFailed && (
            <div className="surface-card col-span-full p-8 text-center text-[13px] text-[var(--text-2)]">还没有作品——写下第一个描述，让 AI 帮你画出来。</div>
          )}
          {jobs.map((j) => (
            <div key={j.id} className="surface-card overflow-hidden">
              {j.status === "pending" && (
                <div className="grid aspect-[3/2] w-full place-items-center bg-[var(--bg-2)] p-4 text-[12px] text-[var(--text-3)]">
                  {pollFailed ? (
                    <p>上次状态：等待生成结果，当前状态待确认。</p>
                  ) : (
                    <GenerationProgress label="正在等待图片生成结果" startedAt={j.createdAt} className="w-full" />
                  )}
                </div>
              )}
              {j.status === "done" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/image/file/${j.id}`} alt={j.prompt.slice(0, 40)} className="reveal-in aspect-[3/2] w-full object-cover" />
              )}
              {j.status === "failed" && (
                <div className="grid aspect-[3/2] w-full place-items-center bg-[var(--bg-2)] text-[12px] text-[var(--text-3)]">
                  <span className="inline-flex items-center gap-2"><ImageOff size={14} /> 生成失败了，请重试（失败不占配额）</span>
                </div>
              )}
              <div className="flex items-center gap-2 p-3">
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-2)]" title={j.prompt}>{j.prompt}</span>
                <span className="shrink-0 rounded-full bg-[var(--rg-control-bg)] px-2 py-0.5 text-[11px] text-[var(--text-3)]">仅校内学习使用</span>
                {j.status === "done" && (
                  <button type="button" onClick={() => void download(j.id, j.prompt)} disabled={downloadingId !== null} aria-label={`下载「${j.prompt.slice(0, 16)}」`}
                    title="下载 PNG 到本地"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--rg-control-bg)] hover:text-[var(--text)] disabled:opacity-50">
                    <Download size={15} />
                  </button>
                )}
              </div>
              {j.status === "done" && downloadingId === j.id && (
                <div className="px-3 pb-3">
                  <GenerationProgress label="正在准备图片下载" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
