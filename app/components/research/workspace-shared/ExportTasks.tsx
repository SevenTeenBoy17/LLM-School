"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, LoaderCircle, Pause, RefreshCw, TriangleAlert } from "lucide-react";
import JSZip from "jszip";
import { WorkButton, WorkDialog } from "./index";
import styles from "./export.module.css";

export interface ExportFile { id: string; name: string; content: string }
type TaskFile = ExportFile & { state: "queued" | "running" | "complete" | "failed"; url?: string; error?: string };
const safeName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 160) || "教学材料.md";
function download(url: string, name: string) { const anchor = document.createElement("a"); anchor.href = url; anchor.download = safeName(name); document.body.append(anchor); anchor.click(); anchor.remove(); }

export function ExportTasks({ open, onOpenChange, files, title = "教学材料导出" }: { open: boolean; onOpenChange: (open: boolean) => void; files: ExportFile[]; title?: string }) {
  const [tasks, setTasks] = useState<TaskFile[]>([]);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [packing, setPacking] = useState(false);
  const [error, setError] = useState("");
  const items = useRef<TaskFile[]>([]);
  const mounted = useRef(true);
  const stoppedRef = useRef(false);
  const working = useRef(false);
  const version = useRef(0);
  const lastSignature = useRef("");
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);
  const signature = JSON.stringify(files);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    const resources = urls.current;
    const generation = version;
    return () => { mounted.current = false; generation.current++; stoppedRef.current = true; working.current = false; lastSignature.current = ""; for (const url of resources) URL.revokeObjectURL(url); resources.clear(); };
  }, []);
  async function run(snapshot: TaskFile[]) {
    if (working.current) return;
    working.current = true;
    stoppedRef.current = false;
    setStopped(false); setRunning(true); setError("");
    const runId = ++version.current;
    items.current = snapshot;
    const publish = () => { if (mounted.current && version.current === runId) setTasks([...items.current]); };
    for (let i = 0; i < snapshot.length; i++) {
      if (stoppedRef.current || !mounted.current || version.current !== runId) break;
      if (items.current[i].state === "complete") continue;
      items.current[i] = { ...items.current[i], state: "running", error: undefined }; publish();
      // Yield a paint between actual local file operations, not invented server progress.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!mounted.current || version.current !== runId) return;
      if (stoppedRef.current) { items.current[i] = { ...items.current[i], state: "queued" }; break; }
      try {
        const file = items.current[i];
        const blob = new Blob(["\uFEFF", file.content], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        urls.current.add(url);
        items.current[i] = { ...file, state: "complete", url };
      } catch (e) { items.current[i] = { ...items.current[i], state: "failed", error: e instanceof Error ? e.message : "无法创建文件" }; }
      publish();
    }
    if (mounted.current && version.current === runId) { publish(); setRunning(false); working.current = false; }
  }
  useEffect(() => {
    if (!open || working.current || lastSignature.current === signature) return;
    lastSignature.current = signature;
    setPacking(false);
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current.clear();
    const snapshot: TaskFile[] = filesRef.current.map((file, index) => ({ ...file, name: `${String(index + 1).padStart(2, "0")}-${safeName(file.name)}`, state: "queued" }));
    void run(snapshot);
  }, [open, signature, running]);
  const completed = tasks.filter(task => task.state === "complete").length;
  const hasFailures = tasks.some(task => task.state === "failed");
  async function pack() {
    if (packing || completed !== tasks.length || !tasks.length) return;
    const batch = version.current;
    setPacking(true); setError("");
    try {
      const zip = new JSZip();
      for (const file of tasks) zip.file(file.name, `\uFEFF${file.content}`);
      const blob = await zip.generateAsync({ type: "blob" });
      if (!mounted.current || version.current !== batch) return;
      const url = URL.createObjectURL(blob); urls.current.add(url); download(url, `${title}.zip`);
    } catch { if (mounted.current && version.current === batch) setError("打包未成功，已完成的单个文件仍可下载。请重试。"); }
    finally { if (mounted.current && version.current === batch) setPacking(false); }
  }
  return <>
    {!open && tasks.length > 0 && <button type="button" className={styles.dock} onClick={() => onOpenChange(true)}><Download size={16} />{running ? "正在导出" : stopped ? "导出已暂停" : "导出任务"} · {completed}/{tasks.length}</button>}
    <WorkDialog open={open} onOpenChange={onOpenChange} title={title} description="浏览器本地导出 · Markdown 文件 · 仅自己" className={styles.dialog}>
      <div className={styles.summary}><strong>{running ? "正在整理文件" : stopped ? "已停止后续任务" : hasFailures ? "部分文件未完成" : "文件已准备好"}</strong><span aria-live="polite">已完成 {completed} / {tasks.length} 份</span></div>
      <div className={styles.progress} role="progressbar" aria-label="导出文件进度" aria-valuemin={0} aria-valuemax={tasks.length || 1} aria-valuenow={completed} aria-valuetext={`已完成 ${completed} / ${tasks.length} 份`}><div style={{ transform: `scaleX(${tasks.length ? completed / tasks.length : 0})` }} /></div>
      <ul className={styles.files}>{tasks.map(file => <li key={file.id}><FileText size={20} /><div><strong>{file.name}</strong><span>{file.state === "complete" ? "文件已创建" : file.state === "running" ? "正在创建本地文件" : file.state === "failed" ? `未完成：${file.error}` : stopped ? "等待继续" : "排队中"}</span></div>
        {file.state === "complete" ? <><CheckCircle2 size={17} className={styles.ok} /><WorkButton aria-label={`下载 ${file.name}`} title={`下载 ${file.name}`} onClick={() => download(file.url!, file.name)}><Download size={16} /></WorkButton></> : file.state === "failed" ? <TriangleAlert size={18} /> : file.state === "running" ? <LoaderCircle size={18} /> : <span className={styles.dot} />}
      </li>)}</ul>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {packing && <p role="status">正在打包文件…</p>}
      <p className={styles.hint}>进度来自已创建的本地文件。收起不会停止任务；关闭页面后需重新导出。</p>
      <footer className={styles.actions}>
        {running ? <WorkButton onClick={() => { stoppedRef.current = true; setStopped(true); }}><Pause size={15} />停止后续</WorkButton> : (stopped || hasFailures) && <WorkButton onClick={() => void run([...items.current])}><RefreshCw size={15} />继续未完成项</WorkButton>}
        <WorkButton onClick={() => onOpenChange(false)}>收起</WorkButton><WorkButton primary disabled={packing || !tasks.length || completed !== tasks.length} onClick={() => void pack()}><Download size={16} />{packing ? "打包中" : "下载全部"}</WorkButton>
      </footer>
    </WorkDialog>
  </>;
}
