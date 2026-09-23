"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  Check,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  Presentation,
  Save,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeacherFeatureIcon } from "@/components/common/TeacherNavIcon";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { CoursewareVisualWorkspace } from "@/components/courseware/CoursewareVisualWorkspace";
import { type CoursewareBrief, type CoursewareSlide } from "@/lib/courseware/core";
import {
  CoursewareApiError,
  apiDownloadCourseware,
  apiGetCourseware,
  apiListCourseware,
  apiPlanCourseware,
  apiSaveCourseware,
  apiUploadCoursewareSource,
  type ClientCoursewareDeck,
  type UploadedCoursewareSource,
} from "@/lib/client/coursewareApi";

const SERIF = { fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' };
const INPUT = "min-h-[44px] w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent-focus)] focus:ring-2 focus:ring-[var(--accent-focus)]/20";

const SOURCE_LABEL: Record<ClientCoursewareDeck["generationSource"], string> = {
  remote: "在线模型结构化规划",
  local: "本地助手",
  "local-fallback": "本地结构模板 · 需教师复核",
};

const EMPTY_BRIEF = {
  subject: "信息科技",
  grade: "八年级",
  topic: "",
  slideCount: 8,
  objectives: "",
  style: "clear" as const,
  sourceSummary: "",
};

function timeLabel(value: number): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function messageOf(error: unknown): string {
  if (error instanceof CoursewareApiError) return error.message;
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function CoursewareStudio() {
  const router = useRouter();
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [uploads, setUploads] = useState<UploadedCoursewareSource[]>([]);
  const [items, setItems] = useState<ClientCoursewareDeck[]>([]);
  const [deck, setDeck] = useState<ClientCoursewareDeck | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [busy, setBusy] = useState<"loading" | "uploading" | "planning" | "saving" | "downloading" | "rendering" | null>("loading");
  const [dirty, setDirty] = useState(false);
  const [conflictDeck, setConflictDeck] = useState<ClientCoursewareDeck | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const planAttemptRef = useRef<{ fingerprint: string; operationId: string } | null>(null);
  const saveAttemptRef = useRef<{ fingerprint: string; operationId: string } | null>(null);

  useEffect(() => {
    let active = true;

    const loadInitialItems = async () => {
      try {
        const nextItems = await apiListCourseware();
        if (active) setItems(nextItems);
      } catch (reason) {
        if (active) setError(messageOf(reason));
      } finally {
        if (active) setBusy(null);
      }
    };

    void loadInitialItems();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;

    const guardedUrl = window.location.href;
    const guardedState = window.history.state;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLinkNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const destination = `${next.pathname}${next.search}${next.hash}`;
      if (destination === current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPendingHref(destination);
      setNotice(null);
      setError("当前课件还有未保存修改，请先保存或明确放弃后再离开。");
    };
    const guardHistoryNavigation = (event: PopStateEvent) => {
      const destination = window.location.href;
      if (destination === guardedUrl) return;
      event.stopImmediatePropagation();
      window.history.pushState(guardedState, "", guardedUrl);
      const next = new URL(destination);
      setPendingHref(`${next.pathname}${next.search}${next.hash}`);
      setNotice(null);
      setError("当前课件还有未保存修改，请先保存或明确放弃后再离开。");
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", guardLinkNavigation, true);
    window.addEventListener("popstate", guardHistoryNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", guardLinkNavigation, true);
      window.removeEventListener("popstate", guardHistoryNavigation, true);
    };
  }, [dirty]);

  const selectedSlide = Math.max(0, Math.min(activeSlide, (deck?.plan.slides.length ?? 1) - 1));
  const currentSlide = deck?.plan.slides[selectedSlide] ?? null;
  const handleVisualBusy = useCallback((value: boolean) => {
    setBusy((current) => value ? "rendering" : current === "rendering" ? null : current);
  }, []);
  const canPlan = brief.topic.trim().length >= 2 && brief.grade.trim().length >= 2 && brief.subject.trim().length >= 1 && !busy;
  const editorLocked = Boolean(busy) || Boolean(conflictDeck);

  const selectDeck = async (id: string) => {
    if (busy) return;
    if (dirty) {
      setNotice(null);
      setError("当前课件还有未保存修改，请先保存后再切换。");
      return;
    }
    setBusy("loading");
    setError(null);
    setNotice(null);
    try {
      const next = await apiGetCourseware(id);
      setDeck(next);
      setActiveSlide(0);
      setDirty(false);
      setConflictDeck(null);
      setPendingHref(null);
      saveAttemptRef.current = null;
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(null); }
  };

  const generate = async () => {
    if (!canPlan) return;
    if (dirty) {
      setNotice(null);
      setError("当前课件还有未保存修改，请先保存后再生成新方案。");
      return;
    }
    setBusy("planning");
    setError(null);
    setNotice(null);
    const objectives = brief.objectives.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
    const request = {
      subject: brief.subject.trim(),
      grade: brief.grade.trim(),
      topic: brief.topic.trim(),
      slideCount: brief.slideCount,
      objectives,
      style: brief.style,
      sourceSummary: brief.sourceSummary.trim(),
      uploadIds: uploads.map((item) => item.id),
    };
    const fingerprint = JSON.stringify(request);
    if (planAttemptRef.current?.fingerprint !== fingerprint) {
      planAttemptRef.current = { fingerprint, operationId: crypto.randomUUID() };
    }
    const input: CoursewareBrief = { operationId: planAttemptRef.current.operationId, ...request };
    try {
      const result = await apiPlanCourseware(input);
      const next = result.authoritativeEntity;
      setDeck(next);
      setItems((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);
      setActiveSlide(0);
      setDirty(false);
      setConflictDeck(null);
      setPendingHref(null);
      planAttemptRef.current = null;
      saveAttemptRef.current = null;
      setNotice(`逐页方案已返回：${SOURCE_LABEL[next.generationSource]}。请逐页审阅后再下载。`);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(null); }
  };

  const uploadSource = async (file: File | undefined) => {
    if (!file || uploads.length >= 3) return;
    setBusy("uploading");
    setError(null);
    try {
      const uploaded = await apiUploadCoursewareSource(file);
      setUploads((prev) => [...prev.filter((item) => item.id !== uploaded.id), uploaded].slice(0, 3));
      setNotice(`已读取《${uploaded.name}》的文字内容（${uploaded.chars} 字）。`);
    } catch (reason) { setError(messageOf(reason)); }
    finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateSlide = (patch: Partial<CoursewareSlide>) => {
    if (!deck || editorLocked) return;
    setDeck({
      ...deck,
      plan: {
        ...deck.plan,
        slides: deck.plan.slides.map((slide, index) => index === selectedSlide ? { ...slide, ...patch } : slide),
      },
    });
    setDirty(true);
    setNotice(null);
  };

  const updateBullet = (index: number, value: string) => {
    if (!currentSlide) return;
    updateSlide({ bullets: currentSlide.bullets.map((bullet, position) => position === index ? value : bullet) });
  };

  const persist = async (): Promise<ClientCoursewareDeck | null> => {
    if (!deck || conflictDeck) return null;
    const fingerprint = JSON.stringify({ id: deck.id, stateVersion: deck.stateVersion, plan: deck.plan });
    if (saveAttemptRef.current?.fingerprint !== fingerprint) {
      saveAttemptRef.current = { fingerprint, operationId: crypto.randomUUID() };
    }
    setBusy("saving");
    setError(null);
    try {
      const result = await apiSaveCourseware(deck, saveAttemptRef.current.operationId);
      const saved = result.authoritativeEntity;
      setDeck(saved);
      setItems((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setDirty(false);
      setConflictDeck(null);
      saveAttemptRef.current = null;
      setNotice(`已保存服务端版本 v${saved.stateVersion}。`);
      return saved;
    } catch (reason) {
      if (reason instanceof CoursewareApiError && reason.code === "VERSION_CONFLICT" && reason.body.authoritativeEntity) {
        const current = reason.body.authoritativeEntity;
        saveAttemptRef.current = null;
        setItems((prev) => [current, ...prev.filter((item) => item.id !== current.id)]);
        setConflictDeck(current);
        setError(`检测到服务端版本 v${current.stateVersion}。本地草稿仍保留，请选择处理方式。`);
      } else setError(messageOf(reason));
      return null;
    } finally { setBusy(null); }
  };

  const download = async (mode: "editable" | "visual" = "editable") => {
    if (!deck || conflictDeck) return;
    let target = deck;
    if (dirty) {
      const saved = await persist();
      if (!saved) return;
      target = saved;
    }
    setBusy("downloading");
    setError(null);
    try {
      const file = await apiDownloadCourseware(target.id, mode);
      triggerDownload(file.blob, file.fileName);
      setNotice(`${mode === "visual" ? "图像成品版" : "可编辑结构稿"} PPTX 已开始下载，共 ${target.plan.slides.length} 页。`);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(null); }
  };

  const keepLocalAfterConflict = () => {
    if (!deck || !conflictDeck) return;
    setDeck({ ...deck, stateVersion: conflictDeck.stateVersion, updatedAt: conflictDeck.updatedAt });
    setConflictDeck(null);
    setError(null);
    setNotice(`已保留本地草稿并基于服务端 v${conflictDeck.stateVersion} 继续，请复核后再次保存。`);
    setDirty(true);
  };

  const loadServerAfterConflict = () => {
    if (!conflictDeck) return;
    setDeck(conflictDeck);
    setActiveSlide((index) => Math.min(index, conflictDeck.plan.slides.length - 1));
    setConflictDeck(null);
    setPendingHref(null);
    setDirty(false);
    saveAttemptRef.current = null;
    setError(null);
    setNotice(`已载入服务端版本 v${conflictDeck.stateVersion}，本地草稿已明确放弃。`);
  };

  const saveAndContinueNavigation = async () => {
    if (!pendingHref) return;
    const destination = pendingHref;
    const saved = dirty ? await persist() : deck;
    if (!saved) return;
    setPendingHref(null);
    router.push(destination);
  };

  const discardAndContinueNavigation = () => {
    if (!pendingHref) return;
    const destination = pendingHref;
    setDirty(false);
    setConflictDeck(null);
    setPendingHref(null);
    router.push(destination);
  };

  const historyLabel = useMemo(() => items.length ? `最近 ${items.length} 份` : "尚无课件", [items.length]);
  const waitLabel = busy === "planning" ? "正在生成逐页教学方案" : busy === "uploading" ? "正在上传并解析参考资料"
    : busy === "saving" ? "正在保存课件方案" : busy === "downloading" ? "正在打包课件 PPTX" : "正在读取课件";

  return (
    <div className="teacher-workspace flex-1 min-w-0 max-w-full overflow-x-hidden p-5 md:p-7">
      <div className="teacher-page-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeacherFeatureIcon name="research-courseware" size={50} fallback={Presentation} />
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]" style={SERIF}>AI 课件工坊</h1>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">教学分镜 · 逐页成品 · 教师审阅</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="min-h-[40px] gap-1.5" asChild>
          <Link href="/research/artifacts"><Archive size={14} /> 教学产物</Link>
        </Button>
      </div>

      <div className="teacher-split-workspace mt-5 grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4">
          <section className="teacher-panel surface-card overflow-hidden" aria-labelledby="courseware-brief-title">
            <header className="border-b border-[var(--border-2)] px-5 py-4">
              <h2 id="courseware-brief-title" className="text-[14px] font-semibold text-[var(--text)]">1. 教学简报</h2>
              <p className="mt-1 text-[12px] text-[var(--text-2)]">只填影响结果的条件，内容会由教师最终把关。</p>
            </header>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">学科</span>
                  <input value={brief.subject} onChange={(event) => setBrief((value) => ({ ...value, subject: event.target.value }))} className={INPUT} maxLength={24} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">年级</span>
                  <input value={brief.grade} onChange={(event) => setBrief((value) => ({ ...value, grade: event.target.value }))} className={INPUT} maxLength={24} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">课件主题 <span className="text-[var(--err-ink)]">*</span></span>
                <input value={brief.topic} onChange={(event) => setBrief((value) => ({ ...value, topic: event.target.value }))} className={INPUT} placeholder="例：校园节水数据分析" maxLength={80} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">学习目标（每行一条，最多 4 条）</span>
                <textarea value={brief.objectives} onChange={(event) => setBrief((value) => ({ ...value, objectives: event.target.value }))} className={`${INPUT} min-h-[92px] resize-y py-2.5`} placeholder="例：读懂一周用水量变化" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">页数</span>
                  <input type="number" min={4} max={12} value={brief.slideCount} onChange={(event) => setBrief((value) => ({ ...value, slideCount: Math.min(12, Math.max(4, Number(event.target.value) || 4)) }))} className={INPUT} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">呈现风格</span>
                  <select value={brief.style} onChange={(event) => setBrief((value) => ({ ...value, style: event.target.value as typeof value.style }))} className={INPUT}>
                    <option value="clear">清晰课堂</option>
                    <option value="warm">温暖启发</option>
                    <option value="academic">学术简洁</option>
                    <option value="project">项目学习</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">补充要求</span>
                <textarea value={brief.sourceSummary} onChange={(event) => setBrief((value) => ({ ...value, sourceSummary: event.target.value }))} className={`${INPUT} min-h-[80px] resize-y py-2.5`} placeholder="例：需要保留课堂数据讨论和分层任务" maxLength={6000} />
              </label>

              <div className="rounded-[12px] border border-dashed border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--text)]">校内参考资料</span>
                  <Button type="button" variant="ghost" size="sm" className="min-h-[36px] gap-1.5" disabled={Boolean(busy) || uploads.length >= 3} onClick={() => fileRef.current?.click()}>
                    {busy === "uploading" ? <LoaderCircle className="animate-spin" /> : <Upload />} 上传
                  </Button>
                  <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" className="sr-only" onChange={(event) => void uploadSource(event.target.files?.[0])} />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-3)]">支持 docx / pdf / txt，最多 3 份；服务端只读取当前账号已解析的文字。</p>
                {uploads.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {uploads.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-[12px] text-[var(--text-2)]">
                        <FileText size={13} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{item.name} · {item.chars} 字</span>
                        <button type="button" aria-label={`移除 ${item.name}`} className="grid h-8 w-8 place-items-center rounded-[10px] text-[var(--text-3)] hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)]" onClick={() => setUploads((prev) => prev.filter((upload) => upload.id !== item.id))}><Trash2 size={13} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button type="button" variant="grad" className="min-h-[44px] w-full gap-1.5" disabled={!canPlan} onClick={() => void generate()}>
                {busy === "planning" ? <LoaderCircle className="animate-spin" /> : <WandSparkles />} {busy === "planning" ? "正在等待逐页方案…" : "生成逐页方案"}
              </Button>
              {!canPlan && !busy && <p className="text-center text-[11px] text-[var(--text-3)]">填写至少 2 个字的课件主题后可以生成</p>}
            </div>
          </section>

          <section className="teacher-panel surface-card overflow-hidden" aria-labelledby="courseware-history-title">
            <header className="flex items-center justify-between border-b border-[var(--border-2)] px-4 py-3">
              <h2 id="courseware-history-title" className="text-[13px] font-semibold text-[var(--text)]">最近课件</h2>
              <span className="text-[11px] text-[var(--text-3)]">{historyLabel}</span>
            </header>
            {busy === "loading" && items.length === 0 ? (
              <div className="p-4 text-[12px] text-[var(--text-3)]">正在读取…</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-[12px] leading-relaxed text-[var(--text-2)]">完成第一份逐页方案后会出现在这里。</div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto p-2">
                {items.map((item) => (
                  <button key={item.id} type="button" disabled={Boolean(busy)} onClick={() => void selectDeck(item.id)} className={`w-full rounded-[10px] p-2.5 text-left transition disabled:cursor-wait disabled:opacity-60 ${deck?.id === item.id ? "bg-[var(--rg-selected-bg)]" : "hover:bg-[var(--rg-hover-bg)]"}`}>
                    <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{item.title}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--text-3)]"><span>{item.plan.slides.length} 页 · v{item.stateVersion}</span><span>{timeLabel(item.updatedAt)}</span></span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main className="min-w-0">
          <div className="mb-3 min-h-[24px] space-y-2" aria-live="polite">
            {error && <p role="alert" className="flex items-start gap-2 text-[12px] text-[var(--err-ink)]"><AlertCircle size={14} className="mt-0.5 shrink-0" />{error}</p>}
            {!error && notice && <p role="status" className="flex items-start gap-2 text-[12px] text-[var(--ok-ink)]"><Check size={14} className="mt-0.5 shrink-0" />{notice}</p>}
            {conflictDeck && (
              <div role="group" aria-label="版本冲突处理" className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--warn)] bg-[var(--warn-bg)] p-3">
                <span className="mr-auto text-[12px] text-[var(--text-2)]">先保留本地草稿继续，或明确改用服务端版本。</span>
                <Button type="button" variant="outline" size="sm" className="min-h-[44px]" onClick={keepLocalAfterConflict}>保留本地草稿</Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" onClick={loadServerAfterConflict}>载入服务端 v{conflictDeck.stateVersion}</Button>
              </div>
            )}
            {pendingHref && !conflictDeck && (
              <div role="group" aria-label="未保存导航处理" className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--warn)] bg-[var(--warn-bg)] p-3">
                <span className="mr-auto text-[12px] text-[var(--text-2)]">离开前如何处理当前草稿？</span>
                <Button type="button" variant="grad" size="sm" className="min-h-[44px]" disabled={Boolean(busy)} onClick={() => void saveAndContinueNavigation()}>保存并离开</Button>
                <Button type="button" variant="outline" size="sm" className="min-h-[44px]" disabled={Boolean(busy)} onClick={discardAndContinueNavigation}>放弃并离开</Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-[44px]" disabled={Boolean(busy)} onClick={() => { setPendingHref(null); setError(null); }}>继续编辑</Button>
              </div>
            )}
          </div>
          <GenerationProgress active={Boolean(busy) && busy !== "rendering"} key={busy || "idle"} label={waitLabel}
            detail={busy === "planning" ? "正在等待教学分镜与内容要点返回" : busy === "downloading" ? "文件准备完成后将自动开始下载" : undefined} />
          {!deck ? (
            <section className="teacher-empty-stage surface-card grid min-h-[520px] place-items-center p-8 text-center">
              <div className="max-w-[420px]">
                <TeacherFeatureIcon name="research-courseware" size={56} fallback={Presentation} className="mx-auto" />
                <h2 className="mt-4 text-[16px] font-semibold text-[var(--text)]">从教学简报开始</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]">生成后会看到每页的教学意图、内容要点、版式建议和讲解提示。这里不是一键交付，教师审阅是完成课件的必要一步。</p>
              </div>
            </section>
          ) : (
            <section className="teacher-panel surface-card min-w-0 overflow-hidden" aria-labelledby="courseware-editor-title">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-2)] px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="courseware-editor-title" className="truncate text-[16px] font-semibold text-[var(--text)]">{deck.title}</h2>
                    <span className="rounded-full bg-[var(--rg-selected-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">{SOURCE_LABEL[deck.generationSource]}</span>
                    <span className="text-[10px] text-[var(--text-3)]">服务端 v{deck.stateVersion}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--text-2)]">{deck.grade} · {deck.subject} · {deck.plan.slides.length} 页{deck.sourceFiles.length ? ` · 已引用 ${deck.sourceFiles.length} 份资料` : " · 未附资料"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="min-h-[40px] gap-1.5" disabled={!dirty || Boolean(busy) || Boolean(conflictDeck)} onClick={() => void persist()}>
                    {busy === "saving" ? <LoaderCircle className="animate-spin" /> : <Save />} 保存修改
                  </Button>
                  <Button type="button" variant="grad" size="sm" className="min-h-[40px] gap-1.5" disabled={Boolean(busy) || Boolean(conflictDeck)} onClick={() => void download()}>
                    {busy === "downloading" ? <LoaderCircle className="animate-spin" /> : <Download />} {dirty ? "保存并下载结构稿" : "下载可编辑结构稿"}
                  </Button>
                </div>
              </header>

              <CoursewareVisualWorkspace key={deck.id} deck={deck} activeSlide={selectedSlide} dirty={dirty} locked={Boolean(busy) || Boolean(conflictDeck)}
                onSelect={setActiveSlide} onBusy={handleVisualBusy} onDownload={() => void download("visual")} />

              <div className="min-w-0">

                {currentSlide && (
                  <div className="min-w-0 space-y-4 p-5">
                    <h3 className="text-[14px] font-semibold">第 {currentSlide.index} 页 · 内容与分镜</h3>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">页面标题</span>
                        <input value={currentSlide.title} onChange={(event) => updateSlide({ title: event.target.value })} className={INPUT} maxLength={80} disabled={editorLocked} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">版式</span>
                        <select value={currentSlide.layout} onChange={(event) => updateSlide({ layout: event.target.value as CoursewareSlide["layout"] })} className={INPUT} disabled={editorLocked}>
                          <option value="cover">封面主视觉</option>
                          <option value="split">左右图文</option>
                          <option value="cards">目标 / 知识卡</option>
                          <option value="map-focus">地图聚焦</option>
                          <option value="comparison">三栏对比</option>
                          <option value="process">推理流程</option>
                          <option value="timeline">时间线</option>
                          <option value="experiment">实验探究</option>
                          <option value="formula">公式模型</option>
                          <option value="data-story">数据叙事</option>
                          <option value="practice">分层练习</option>
                          <option value="summary">总结回收</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">章节标签</span>
                        <input value={currentSlide.eyebrow} onChange={(event) => updateSlide({ eyebrow: event.target.value })} className={INPUT} maxLength={48} disabled={editorLocked} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">本页结论</span>
                        <input value={currentSlide.takeaway} onChange={(event) => updateSlide({ takeaway: event.target.value })} className={INPUT} maxLength={140} disabled={editorLocked} />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">本页教学意图</span>
                      <textarea value={currentSlide.subtitle || currentSlide.purpose} onChange={(event) => updateSlide({ subtitle: event.target.value, purpose: event.target.value })} className={`${INPUT} min-h-[72px] resize-y py-2.5`} maxLength={140} disabled={editorLocked} />
                    </label>

                    <fieldset>
                      <legend className="text-[12px] font-semibold text-[var(--text)]">页面要点（1-5 条）</legend>
                      <div className="mt-2 space-y-2">
                        {currentSlide.bullets.map((bullet, index) => (
                          <div key={`${currentSlide.id}-bullet-${index}`} className="flex items-center gap-2">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[var(--rg-control-bg)] text-[10px] font-semibold text-[var(--text-3)]">{index + 1}</span>
                          <input value={bullet} onChange={(event) => updateBullet(index, event.target.value)} className={INPUT} maxLength={160} disabled={editorLocked} />
                          <button type="button" aria-label={`删除第 ${index + 1} 条要点`} disabled={editorLocked || currentSlide.bullets.length <= 1} onClick={() => updateSlide({ bullets: currentSlide.bullets.filter((_, position) => position !== index) })} className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[var(--text-3)] hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)] disabled:opacity-30"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    <Button type="button" variant="ghost" size="sm" className="mt-2 min-h-[36px] gap-1.5" disabled={editorLocked || currentSlide.bullets.length >= 5} onClick={() => updateSlide({ bullets: [...currentSlide.bullets, "请补充本页要点"] })}><Plus size={13} /> 增加要点</Button>
                    </fieldset>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">视觉标签（每行一项）</span>
                        <textarea key={`${currentSlide.id}-${deck.stateVersion}`} defaultValue={currentSlide.visual.labels.join("\n")} onBlur={(event) => { const labels = event.target.value.split(/\r?\n/).map((value) => value.trim().slice(0, 56)).filter(Boolean).slice(0, 6); if (JSON.stringify(labels) !== JSON.stringify(currentSlide.visual.labels)) updateSlide({ visual: { ...currentSlide.visual, labels } }); }} className={`${INPUT} min-h-[92px] resize-y py-2.5`} maxLength={340} disabled={editorLocked} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">教师讲解提示</span>
                        <textarea value={currentSlide.teacherNote} onChange={(event) => updateSlide({ teacherNote: event.target.value })} className={`${INPUT} min-h-[92px] resize-y py-2.5`} maxLength={400} disabled={editorLocked} />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[var(--text)]">视觉与内容依据</span>
                      <textarea value={currentSlide.visualHint} onChange={(event) => updateSlide({ visualHint: event.target.value })} className={`${INPUT} min-h-[68px] resize-y py-2.5`} maxLength={200} disabled={editorLocked} />
                    </label>

                    <div className="rounded-[12px] bg-[var(--rg-control-bg)] p-3">
                      <div className="text-[11px] font-semibold text-[var(--text-2)]">内容依据</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-3)]">{currentSlide.sourceRefs.length ? currentSlide.sourceRefs.join(" · ") : "未标注来源；发布前请回到教材或原始资料核对。"}</p>
                    </div>

                    {deck.plan.reviewNotes.length > 0 && (
                      <div className="border-t border-[var(--border-2)] pt-4">
                        <h3 className="text-[12px] font-semibold text-[var(--text)]">整套课件复核提示</h3>
                        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-[var(--text-2)]">
                          {deck.plan.reviewNotes.map((note) => <li key={note}>· {note}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
