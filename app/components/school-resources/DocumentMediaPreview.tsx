"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle, Square } from "lucide-react";
import type { SchoolResource } from "@/lib/school-resources/model";
import { DocumentPreviewError, loadDocumentPreview, PREVIEW_LIMITS, type DocumentPreview } from "@/lib/school-resources/documentPreview";
import styles from "./document-media-preview.module.css";

type ReadyPreview = { resource: SchoolResource; result?: DocumentPreview; url?: string; error?: string };

function LocalMedia({ kind, url, title }: { kind: "image" | "audio" | "video"; url: string; title: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const media = useRef<HTMLMediaElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finish = (ready: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    setState(ready ? "ready" : "error");
  };
  useEffect(() => {
    timer.current = setTimeout(() => setState("error"), PREVIEW_LIMITS.timeoutMs);
    const element = media.current;
    // Strict Mode replays setup after cleanup on the same DOM node.
    if (element && element.getAttribute("src") !== url) element.src = url;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (element) { element.pause(); element.removeAttribute("src"); element.load(); }
    };
  }, [url]);
  const metadata = () => {
    const element = media.current;
    if (element instanceof HTMLVideoElement && element.videoWidth * element.videoHeight > 24_000_000) finish(false);
    else finish(true);
  };
  return <div className={styles.media} data-media-state={state}>
    {state === "error" ? <p role="status" className={styles.notice}>媒体无法解码、分辨率过高或加载超时。当前浏览器可能不支持此编码，请下载原文件查看。</p> : <>
      {kind === "image" ? <Image unoptimized src={url} width={1200} height={900} className={styles.image} alt={title}
        onLoad={(event) => { const image = event.currentTarget; finish(image.naturalWidth > 0 && image.naturalHeight > 0 && image.naturalWidth * image.naturalHeight <= 24_000_000); }}
        onError={() => finish(false)} />
        : kind === "audio" ? <audio ref={element => { media.current = element; }} src={url} controls preload="metadata" aria-label={`${title} 音频`} onLoadedMetadata={metadata} onError={() => finish(false)} />
          : <video ref={element => { media.current = element; }} src={url} controls preload="metadata" playsInline aria-label={`${title} 视频`} onLoadedMetadata={metadata} onError={() => finish(false)} />}
      {state === "loading" && <p role="status" className={styles.notice}>正在读取本机媒体…</p>}
    </>}
  </div>;
}

function DocumentText({ result }: { result: Extract<DocumentPreview, { kind: "document" }> }) {
  const [index, setIndex] = useState(0);
  const page = result.pages[Math.min(index, result.pages.length - 1)];
  const label = result.format === "pptx" ? "幻灯片" : "页";
  return <div className={styles.document} data-preview-format={result.format}>
    <div className={styles.toolbar}>
      <p className={styles.notice}>{result.format === "pptx" ? "文字预览，版式/动画未呈现" : result.format === "pdf"
        ? "PDF 文字预览；版式、图片与扫描件 OCR 未呈现。" : "DOCX 文字预览；原文档版式、图片未呈现。"}</p>
      {result.format !== "docx" && <div className={styles.pagination} aria-label="文字预览分页">
        <button type="button" title={`上一${label}`} aria-label={`上一${label}`} disabled={index <= 0} onClick={() => setIndex(value => value - 1)}><ChevronLeft size={17} /></button>
        <span aria-live="polite">{page?.number ?? 0} / {result.totalPages}</span>
        <button type="button" title={`下一${label}`} aria-label={`下一${label}`} disabled={index >= result.pages.length - 1} onClick={() => setIndex(value => value + 1)}><ChevronRight size={17} /></button>
      </div>}
    </div>
    {page?.text.trim() ? <pre className={styles.text} data-testid="document-preview-text">{page.text}</pre>
      : <p className={styles.empty} role="status">本{result.format === "docx" ? "文档" : label}没有可提取的文字。图片、扫描件和图表内容请下载原文件查看。</p>}
    {result.truncated && <p className={styles.notice}>已达到预览上限（最多 {PREVIEW_LIMITS.pages} 页、{PREVIEW_LIMITS.textCharacters.toLocaleString("zh-CN")} 字符）；完整内容请下载查看。</p>}
  </div>;
}

/** Local-only preview. Download actions remain with the parent resource detail. */
export function DocumentMediaPreview({ resource }: { resource: SchoolResource }) {
  const [preview, setPreview] = useState<ReadyPreview | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    let url = "";
    cancel.current = () => {
      controller.abort();
      setPreview({ resource, error: "预览已停止，原文件仍可下载。" });
    };
    loadDocumentPreview(resource, { signal: controller.signal }).then(result => {
      if (!alive || controller.signal.aborted) return;
      if (result.kind === "image" || result.kind === "audio" || result.kind === "video") url = URL.createObjectURL(result.blob);
      setPreview({ resource, result, url });
    }).catch(error => {
      if (alive && !controller.signal.aborted) setPreview({ resource, error: error instanceof DocumentPreviewError ? error.message : "预览失败，原文件仍可下载。" });
    });
    return () => {
      alive = false; controller.abort(); cancel.current = null;
      if (url) URL.revokeObjectURL(url);
    };
  }, [resource]);

  // Identity comparison also hides stale content before the replacement effect runs.
  const current = preview?.resource === resource ? preview : null;
  const result = current?.result;
  return <section className={styles.preview} aria-label="文档与媒体预览" data-testid="document-media-preview" data-preview-kind={result?.kind ?? (current?.error ? "error" : "loading")}>
    {current?.error ? <p role="status" className={styles.error}><FileWarning size={20} aria-hidden />{current.error}</p>
      : !result ? <div className={styles.loading}><p role="status"><LoaderCircle size={18} aria-hidden />正在读取本机文件…</p>
        <button type="button" onClick={() => cancel.current?.()} title="停止预览" aria-label="停止预览"><Square size={16} /></button></div>
        : result.kind === "image" || result.kind === "audio" || result.kind === "video" ? <LocalMedia key={current.url} kind={result.kind} url={current.url!} title={resource.title} />
          : result.kind === "text" ? <><pre className={styles.text} data-testid="document-preview-text">{result.text}</pre>
            {result.truncated && <p className={styles.notice}>仅预览前 20 KB；完整内容可下载查看。</p>}</>
            : result.kind === "document" ? <DocumentText key={`${resource.id}:${resource.revision}:${resource.updatedAt}`} result={result} />
              : result.kind === "unsupported" ? <p role="status" className={styles.notice}>{result.message}</p> : null}
  </section>;
}
