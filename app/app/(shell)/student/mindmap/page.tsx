"use client";

/**
 * /student/mindmap —— AI 思维导图（W-B2，调研启示③）。
 * 双入口：主题 / 已上传文档（复用 W-B1 /api/upload 地基）。
 * 渲染：markmap（Markdown → D3 交互 SVG，零自研布局）。
 * 产物常驻「AI 生成」标识（规格红线 R3）；导出 Markdown 头部同样写入标识。
 * 入口在 AI 工具聚合页（学生端顶层保持 4 入口，不加导航项）。
 */
import { useEffect, useRef, useState } from "react";
import { Network, Loader2, Download, FileText, Wand2 } from "lucide-react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { Reveal } from "@/components/common/EduArt";
import { PageIcon } from "@/components/common/PlayIcon";
import { GenerationProgress } from "@/components/common/GenerationProgress";

const transformer = new Transformer();

export default function MindmapPage() {
  const [topic, setTopic] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadId, setUploadId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [md, setMd] = useState("");
  const [clamped, setClamped] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!md || !svgRef.current) return;
    const { root } = transformer.transform(md);
    if (!mmRef.current) mmRef.current = Markmap.create(svgRef.current, { autoFit: true });
    mmRef.current.setData(root);
    void mmRef.current.fit();
  }, [md]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.status === "parsed") { setUploadId(j.id); setUploadName(`${j.name}（${j.chars} 字）`); }
      else setError(j.message || "文档解析失败");
    } catch { setError("网络异常，请重试"); } finally { setUploading(false); }
  };

  const generate = async () => {
    if (!topic.trim() && !uploadId) { setError("先输入主题，或上传一份文档"); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/mindmap", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(uploadId ? { uploadId } : { topic: topic.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.message || "暂时无法生成导图，请稍后再试"); return; }
      setMd(j.md); setClamped(Boolean(j.clamped));
    } catch { setError("网络异常，请重试"); } finally { setLoading(false); }
  };

  const downloadMd = () => {
    const content = `<!-- 本导图由 AI 生成，仅供学习参考 -->\n${md}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    a.download = "思维导图.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPng = () => {
    const svg = svgRef.current;
    if (!svg || exporting) return;
    setExporting(true);
    setError("");
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const r = svg.getBoundingClientRect();
    img.onerror = () => { setExporting(false); setError("导图图片导出失败，请重试"); };
    img.onload = () => {
      try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(r.width * 2));
      canvas.height = Math.max(1, Math.round(r.height * 2));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // R3：导出图内合成「AI 生成」标识
      ctx.fillStyle = "rgba(90,96,120,0.85)";
      ctx.font = "20px sans-serif";
      ctx.fillText("AI 生成 · 仅供学习参考", 16, canvas.height - 16);
      canvas.toBlob((blob) => {
        setExporting(false);
        if (!blob) { setError("导图图片导出失败，请重试"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "思维导图.png";
        a.click();
        URL.revokeObjectURL(a.href);
      });
      } catch { setExporting(false); setError("导图图片导出失败，请重试"); }
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  };

  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[880px]">
        <Reveal>
          <div className="flex items-center gap-3">
            <PageIcon name="mindmap" fallback={Network} />
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">思维导图</h1>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">输入主题或上传文档，AI 帮你整理成一张可展开的导图。</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input
              value={topic}
              onChange={(e) => { setTopic(e.target.value); if (e.target.value.trim()) { setUploadId(""); setUploadName(""); } }}
              placeholder="输入主题，如：一元二次方程"
              aria-label="导图主题"
              className="h-[44px] min-w-0 flex-1 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]/45"
            />
            <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" hidden onChange={pickFile} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/40 hover:text-[var(--text)] disabled:opacity-50">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} {uploadName || "从文档生成"}
            </button>
            <button type="button" onClick={generate} disabled={loading || uploading}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-px disabled:opacity-50"
              style={{ backgroundImage: "var(--grad-primary)" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} 生成导图
            </button>
          </div>
          <GenerationProgress active={uploading} label="正在上传并解析导图文档" />
          <GenerationProgress active={loading} label="正在生成思维导图" detail="正在等待主题大纲与层级结构返回" />
          <GenerationProgress active={exporting} label="正在导出思维导图图片" />
          {error && <p role="alert" className="mt-2 text-[13px] text-[var(--c-alert)]">{error}</p>}

          {/* 空态：视觉门 P2（首屏 95% 空白）的解法——用可点的示例主题和三步说明填充首屏，
              而不是装饰性插画；chips 直接回填输入框，把「不知道输什么」变成一次点击。 */}
          {!md && (
            <section aria-label="使用引导" className="surface-card mt-4 p-4 md:p-5">
              <h2 className="text-[14px] font-semibold text-[var(--text)]">不知道从哪开始？试试这些主题</h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["分数的加减法", "光合作用", "一元二次方程", "岳阳楼记", "牛顿三大定律", "中国四大发明"].map((t) => (
                  <button key={t} type="button" onClick={() => { setTopic(t); setUploadId(""); setUploadName(""); setError(""); }}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/45 hover:text-[var(--text)]">
                    {t}
                  </button>
                ))}
              </div>
              <ol className="mt-4 grid gap-3 text-[12px] leading-relaxed text-[var(--text-2)] sm:grid-cols-3">
                <li className="rounded-[12px] border border-[var(--border-2)] p-3">
                  <span className="font-semibold text-[var(--text)]">① 给一个起点</span>
                  <br />输入任意主题，或上传课文 / 笔记文档（docx · pdf · txt）。
                </li>
                <li className="rounded-[12px] border border-[var(--border-2)] p-3">
                  <span className="font-semibold text-[var(--text)]">② AI 整理成大纲</span>
                  <br />自动梳理层级结构，最多 4 层、50 个节点，保持一眼能读完。
                </li>
                <li className="rounded-[12px] border border-[var(--border-2)] p-3">
                  <span className="font-semibold text-[var(--text)]">③ 展开与带走</span>
                  <br />点节点展开收起，随时导出 PNG 或 Markdown 存进笔记。
                </li>
              </ol>
              <p className="mt-3 text-[12px] text-[var(--text-3)]">导图由 AI 生成、仅供学习参考——重要结论记得回到课本核对。</p>
            </section>
          )}

          {md && (
            <section aria-label="思维导图结果" className="surface-card mt-4 p-3 md:p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--border-2)] px-2 py-0.5 text-[11px] text-[var(--text-2)]">AI 生成 · 仅供学习参考</span>
                {clamped && <span className="text-[11px] text-[var(--text-3)]">内容较多，已按 4 层 / 50 节点修剪</span>}
                <div className="ml-auto flex gap-1.5">
                  <button type="button" onClick={downloadMd} className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] border border-[var(--border-2)] px-2.5 text-[12px] text-[var(--text-2)] hover:text-[var(--text)]"><Download size={13} /> Markdown</button>
                  <button type="button" onClick={downloadPng} disabled={exporting} className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] border border-[var(--border-2)] px-2.5 text-[12px] text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-50"><Download size={13} /> PNG</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <svg ref={svgRef} className="h-[460px] w-full" aria-label="思维导图画布" />
              </div>
            </section>
          )}
        </Reveal>
      </div>
    </div>
  );
}
