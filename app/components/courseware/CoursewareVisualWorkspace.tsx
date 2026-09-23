"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon, LoaderCircle, Maximize2, RefreshCw, Square, WandSparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { apiCoursewareVisuals, apiGenerateCoursewareVisual, type ClientCoursewareDeck } from "@/lib/client/coursewareApi";
import type { SlideVisualStatus } from "@/lib/courseware/visual";
import styles from "./courseware-visual.module.css";

const LABEL = { missing: "未生成", generating: "生成中", ready: "已生成", failed: "生成失败", stale: "内容已更新" };
type Props = { deck: ClientCoursewareDeck; activeSlide: number; dirty: boolean; locked: boolean;
  onSelect: (index: number) => void; onBusy: (busy: boolean) => void; onDownload: () => void };

export function CoursewareVisualWorkspace({ deck, activeSlide, dirty, locked, onSelect, onBusy, onDownload }: Props) {
  const [items, setItems] = useState<SlideVisualStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [stopRequested, setStopRequested] = useState(false);
  const [pollError, setPollError] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const stop = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current = true; onBusy(false); }; }, [onBusy]);
  useEffect(() => {
    let active = true;
    void apiCoursewareVisuals(deck.id).then((next) => { if (active) { setItems(next); setError(""); } })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [deck.id, deck.stateVersion]);
  const pending = items.some((item) => item.state === "generating");
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const timer = window.setInterval(() => { void apiCoursewareVisuals(deck.id).then((next) => {
      if (active) { setItems(next); setPollError(false); }
    }).catch(() => { if (active) setPollError(true); }); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [pending, deck.id]);
  const current = deck.plan.slides[activeSlide];
  const visual = items.find((item) => item.slideId === current?.id);
  const canPreview = visual?.state === "ready" && Boolean(visual.imageUrl) && !dirty && failedImageUrl !== visual.imageUrl;
  const ready = items.filter((item) => item.state === "ready").length;
  const completed = batchIds.length ? items.filter((item) => batchIds.includes(item.slideId) && item.state === "ready").length : ready;
  const generatingSlide = deck.plan.slides.find((slide) => items.some((item) => item.slideId === slide.id && item.state === "generating"));
  const canGenerate = !dirty && !locked && !running && !pending;

  async function generate(all: boolean) {
    if (!canGenerate || !current) return;
    stop.current = false;
    setStopRequested(false); setPollError(false);
    setRunning(true); onBusy(true); setError("");
    const targets = all ? deck.plan.slides.filter((slide) => items.find((item) => item.slideId === slide.id)?.state !== "ready") : [current];
    setBatchIds(targets.map((slide) => slide.id));
    let failed = 0;
    try {
      for (const slide of targets) {
        if (stop.current) break;
        setProgress(`正在制作第 ${slide.index} 页 · ${slide.title}`);
        setItems((prev) => [...prev.filter((item) => item.slideId !== slide.id), { slideId: slide.id, state: "generating" }]);
        try {
          const next = await apiGenerateCoursewareVisual(deck.id, slide.id, deck.stateVersion);
          if (mounted.current) setItems(next);
        } catch (reason) {
          failed += 1;
          if (mounted.current) {
            setError(reason instanceof Error ? reason.message : "生成失败，请重试。");
            try { setItems(await apiCoursewareVisuals(deck.id)); } catch { /* retain the last known state */ }
          }
          // Stop on service failure instead of charging for a cascade of identical failures.
          break;
        }
      }
      if (mounted.current) setProgress(stop.current ? "已停止后续页面，当前结果已保留。" : failed ? "未完成页面可单独重试。" : "本次成品图已生成，请逐页复核文字与学科图示。");
    } finally { if (mounted.current) { setRunning(false); onBusy(false); } }
  }

  if (!current) return <div className={styles.empty} role="status">当前课件没有可预览的页面。</div>;

  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <div className={styles.heading}><ImageIcon size={18} /><strong>成品预览</strong><span>{dirty ? "方案有未保存修改" : `${ready} / ${deck.plan.slides.length} 页已生成`}</span></div>
      <div className={styles.actions}>
        {running ? <button type="button" disabled={stopRequested} onClick={() => { stop.current = true; setStopRequested(true); setProgress("当前页完成后停止，结果会保留。"); }}><Square size={14} />{stopRequested ? "正在停止后续" : "停止后续"}</button>
          : <button type="button" disabled={!canGenerate || ready === deck.plan.slides.length} onClick={() => void generate(true)}><WandSparkles size={16} />{ready ? "继续生成未完成页" : "生成整套成品图"}</button>}
        <button type="button" disabled={dirty || locked || ready !== deck.plan.slides.length} onClick={onDownload}><Download size={16} />下载图像版 PPTX</button>
      </div>
    </div>
    {(running || pending) && <div className={styles.generationStatus}>
      <GenerationProgress label={stopRequested ? "等待当前页完成后停止" : "正在制作课件成品"}
        completed={completed} total={batchIds.length || deck.plan.slides.length} unit="页"
        detail={pollError ? "进度暂时无法刷新，显示上次已确认结果；正在重试连接。" : stopRequested ? "已停止排入新页面，当前页仍在生成，已有结果会保留。" : generatingSlide ? `正在制作第 ${generatingSlide.index} 页 · ${generatingSlide.title}` : progress || "正在读取后台生成状态"} />
    </div>}
    <div className={styles.stage}>
      <nav className={styles.filmstrip} aria-label="课件页面">
        {deck.plan.slides.map((slide, index) => {
          const item = items.find((value) => value.slideId === slide.id);
          return <button key={slide.id} type="button" aria-current={activeSlide === index ? "page" : undefined} onClick={() => onSelect(index)}>
            <div className={styles.thumbnail}>{item?.state === "ready" && item.imageUrl
              ? <Image src={item.imageUrl} alt="" width={1920} height={1080} unoptimized loading="lazy" /> : <ImageIcon size={22} />}</div>
            <span className={styles.slideTitle}>{String(index + 1).padStart(2, "0")} · {slide.title}</span>
            <small>{LABEL[item?.state || "missing"]}</small>
          </button>;
        })}
      </nav>
      <div className={styles.preview}>
        <div className={styles.canvas}>
          {canPreview && visual?.imageUrl
            ? <Image src={visual.imageUrl} alt={`第${current.index}页成品：${current.title}`} width={1920} height={1080} unoptimized onError={() => setFailedImageUrl(visual.imageUrl || null)} />
            : <div className={styles.empty}>
              {visual?.state === "generating" ? <LoaderCircle size={28} className="animate-spin" /> : <ImageIcon size={32} />}
              <strong>{dirty ? "修改后请先保存方案" : failedImageUrl && failedImageUrl === visual?.imageUrl ? "成品图加载失败" : LABEL[visual?.state || "missing"]}</strong>
              <p>{current.title}</p>
              {visual?.error && <p>{visual.error}</p>}
              {failedImageUrl === visual?.imageUrl && <button type="button" onClick={() => setFailedImageUrl(null)}>重新加载</button>}
            </div>}
        </div>
        <div className={styles.caption}>
          <span>第 {current.index} 页 · {current.title}</span>
          <button ref={previewTrigger} type="button" aria-label="放大成品预览" title="放大成品预览" disabled={!canPreview} onClick={() => setEnlarged(true)}><Maximize2 size={16} /></button>
          <button type="button" disabled={!canGenerate || visual?.state === "ready"} onClick={() => void generate(false)}><RefreshCw size={14} />{visual?.state === "failed" ? "重试本页" : "生成本页"}</button>
        </div>
        <p className={styles.boundary}>图像成品版：保留完整画面，页内文字不可单独编辑。生成文字、地图与学科事实需教师复核。</p>
        <div aria-live="polite" className={styles.progress}>{progress || (pending ? "后台仍在生成，完成后自动刷新。" : "")}</div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
    </div>
    <Dialog open={enlarged && !dirty} onOpenChange={setEnlarged}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={(event) => { if (previewTrigger.current && !previewTrigger.current.disabled) { event.preventDefault(); previewTrigger.current.focus(); } }} className="w-[96vw] max-w-[1600px] max-h-[94dvh] overflow-auto rounded-[8px] p-4">
        <DialogTitle className="pr-9 text-[15px] tracking-normal">第 {current.index} 页 · {current.title}</DialogTitle>
        {canPreview && visual?.imageUrl ? <Image src={visual.imageUrl} width={1920} height={1080} unoptimized alt={`第${current.index}页放大成品`} onError={() => setFailedImageUrl(visual.imageUrl || null)} className="w-full h-auto max-h-[76dvh] object-contain" /> : <p>本页没有可用成品，请关闭预览后检查页面状态。</p>}
        <div className="flex items-center justify-center gap-5">
          <button type="button" className="grid h-11 w-11 place-items-center rounded-md border disabled:opacity-40" aria-label="上一页" title="上一页" disabled={activeSlide === 0} onClick={() => onSelect(activeSlide - 1)}><ChevronLeft size={20} /></button>
          <span className="text-sm">{current.index} / {deck.plan.slides.length}</span>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-md border disabled:opacity-40" aria-label="下一页" title="下一页" disabled={activeSlide === deck.plan.slides.length - 1} onClick={() => onSelect(activeSlide + 1)}><ChevronRight size={20} /></button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
