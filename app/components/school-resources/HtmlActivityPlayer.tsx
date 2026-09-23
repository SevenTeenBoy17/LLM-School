"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Play, RotateCcw, ShieldCheck, Square } from "lucide-react";
import { hasRuntimePolicy, readActivityHtml } from "@/lib/school-resources/htmlRuntime";
import { requireResourceCrypto, type SchoolResource } from "@/lib/school-resources/model";
import styles from "./resource-player.module.css";

type Status = "idle" | "checking" | "starting" | "loaded" | "error" | "stopped";
export function HtmlActivityPlayer({ resource }: { resource: SchoolResource }) {
  const [html, setHtml] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [session, setSession] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => { if (timeout.current) clearTimeout(timeout.current); timeout.current = null; };
  useEffect(() => () => { generation.current++; controller.current?.abort(); clearTimer(); }, []);
  useEffect(() => {
    function receive(event: MessageEvent) {
      const data = event.data;
      if (event.source !== frame.current?.contentWindow || !session || !data || data.type !== "eduai-runtime" || data.version !== 1 || data.nonce !== session) return;
      if (data.status === "loaded") { clearTimer(); setStatus(current => current === "error" ? current : "loaded"); }
      if (data.status === "script-error") { clearTimer(); setError("活动脚本出现错误，部分交互可能无法使用；请联系提供文件的教师。"); setStatus("error"); }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [session]);
  async function start() {
    if (busy.current) return;
    busy.current = true;
    const current = ++generation.current;
    const request = new AbortController(); controller.current = request;
    const requestTimeout = setTimeout(() => request.abort(new Error("运行环境检查超时，请重试。")), 8000);
    clearTimer(); setHtml(""); setSession(""); setError(""); setStatus("checking");
    try {
      const secureCrypto = requireResourceCrypto();
      const response = await fetch("/resource-runtime.html", { cache: "no-store", signal: request.signal });
      if (!response.ok || !hasRuntimePolicy(response.headers.get("content-security-policy"))) throw new Error("运行区安全配置缺失，已阻止启动。请联系学校管理员检查 CSP 响应头。");
      const blob = resource.blob ?? (resource.origin === "example" ? new Blob([resource.body ?? ""]) : null);
      if (!blob) throw new Error("本机原文件不可用，请重新添加。");
      const source = await readActivityHtml(blob);
      if (current !== generation.current) return;
      setHtml(source); setSession(secureCrypto.randomUUID()); setStatus("starting");
      timeout.current = setTimeout(() => { setStatus("error"); setError("活动未在 10 秒内报告加载状态。可停止后重试；这不代表内容通过了质量审核。"); }, 10000);
    } catch (issue) { if (current === generation.current) { setStatus("error"); setError(issue instanceof Error ? issue.message : "活动启动失败。"); } }
    finally { clearTimeout(requestTimeout); if (current === generation.current) busy.current = false; }
  }
  function stop() { generation.current++; controller.current?.abort(); busy.current = false; clearTimer(); setHtml(""); setSession(""); setStatus("stopped"); setError(""); setExpanded(false); }
  return <section className={`${styles.player} ${expanded ? styles.expanded : ""}`} data-testid="html-activity-player" aria-label="HTML 活动运行窗口">
    <div className={styles.toolbar}>
      <span><ShieldCheck size={16} />隔离运行</span>
      <div>
        <button title={html ? "重新开始活动（清空本次状态）" : "开始活动"} aria-label={html ? "重新开始活动" : "开始活动"} disabled={status === "checking"} onClick={() => void start()}>{html ? <RotateCcw size={17} /> : <Play size={17} />}{html ? "重新开始" : "开始活动"}</button>
        <button title="停止活动" aria-label="停止活动" disabled={!html && status !== "checking"} onClick={stop}><Square size={16} /></button>
        <button title={expanded ? "还原窗口" : "放大窗口"} aria-label={expanded ? "还原活动窗口" : "放大活动窗口"} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </div>
    </div>
    <div className={styles.runtimeStatus} role="status">{error || ({ idle: "尚未运行", checking: "正在检查运行环境…", starting: "正在加载活动…", loaded: "活动已加载 · 未自动判定学习成果", error: "启动失败", stopped: "活动已停止，本次运行状态已清除" }[status])}</div>
    {html && session ? <iframe key={session} ref={frame} src="/resource-runtime.html" title={`${resource.title} · 隔离运行区`} sandbox="allow-scripts" referrerPolicy="no-referrer"
      allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'" className={styles.runtime}
      onLoad={() => frame.current?.contentWindow?.postMessage({ type: "eduai-runtime-init", version: 1, nonce: session, html }, "*")} />
      : <div className={styles.placeholder}><Play size={30} /><strong>{resource.title}</strong><p>仅运行已知来源的单文件活动。联网素材、登录、摄像头和上传操作不会获得授权。</p></div>}
    <details className={styles.safety}><summary>文件兼容性与安全边界</summary><p>支持 UTF-8 单文件 HTML、内联样式和脚本、内嵌图片。外部 CDN、相对路径素材、弹窗、表单提交及平台数据访问受限制。活动里的自评和分数不等于教师评价，也不会自动计入学习档案。</p><p>隔离不等于内容审核，也不限制脚本运算量。不要运行不明来源文件；若浏览器失去响应，请关闭该标签页。教师发布前应检查内容、无障碍与运行表现。</p></details>
  </section>;
}
