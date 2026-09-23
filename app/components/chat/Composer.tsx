"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Plus, FileText, X, Eye, BookMarked } from "lucide-react";
import { useModelStore } from "@/lib/store/useModelStore";
import { GenerationProgress } from "@/components/common/GenerationProgress";

/**
 * W-B1 · Composer 附件上传（规格书 §3/§4，调研启示①）。
 *
 * 附件卡四态状态机：uploading(%) → ready(已读取 N 字) / failed(枚举原因)。
 * 解析在服务端同一请求内完成；上传完成后等待响应，不推算解析进度。
 * 「预览」打开抽取文本弹层——学生看得到 AI 将读到什么（数据诚实性）。
 * 建议提问 chip 来自服务端静态任务池（星火祈使句语法），不调模型。
 */

interface Props {
  onSend?: (msg: string, uploads: { id: string; name: string }[]) => void;
  initialText?: string; // 由 /chat?prompt= 注入的提示词正文（预填输入框）
  studentNotice?: boolean; // H3：学生端把 AI 身份/隐私两句白名单披露并入脚注（措辞与标记原文不变）
  controls?: React.ReactNode; // H5：下沉进输入岛底行的控件坞（学生端模型/引导/更多）
}

interface Att {
  localId: string;
  name: string;
  status: "uploading" | "parsing" | "ready" | "failed";
  uploadedBytes?: number;
  totalBytes?: number;
  startedAt: number;
  serverId?: string;
  chars?: number;
  error?: string;
  suggestions?: string[];
  helpNote?: string;
}

const MAX_FILES = 3;

export function Composer({ onSend, initialText, studentNotice, controls }: Props) {
  const current = useModelStore((s) => s.current);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 把输入区实际高度写进 --composer-h，供安全求助浮标自动避让（见 SafetyHelp 的几何说明）。
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--composer-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--composer-h");
    };
  }, []);
  const [value, setValue] = useState("");
  const [toolNotice, setToolNotice] = useState("");
  const [seedApplied, setSeedApplied] = useState<string | undefined>(undefined);
  const [atts, setAtts] = useState<Att[]>([]);
  const [preview, setPreview] = useState<{ name: string; text: string; chars: number } | null>(null);

  if (initialText && initialText !== seedApplied) {
    setSeedApplied(initialText);
    if (value === "") setValue(initialText);
  }
  useEffect(() => {
    if (!initialText) return;
    const el = taRef.current;
    if (el) {
      el.focus();
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 220) + "px";
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [initialText]);

  // H4（Claude 网页版对位）：占位语只留一句话，快捷键说明降级为 title/aria-keyshortcuts——
  // 「少即是多」的第一刀是让占位语回到占位语该有的长度。
  const placeholder =
    current === "gpt-image"
      ? "描述你想要的教学图像，我先给你一套可复制的提示词方案"
      : "有什么想问的？";

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    setValue(el.value);
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  };

  const patchAtt = (localId: string, patch: Partial<Att>) =>
    setAtts((cur) => cur.map((a) => (a.localId === localId ? { ...a, ...patch } : a)));

  // XHR 而非 fetch：要真实上传进度百分比（四态卡的第一态）
  const uploadOne = (file: File) => {
    const localId = `att_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    setAtts((cur) => [...cur, { localId, name: file.name, status: "uploading", startedAt: Date.now() }]);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        patchAtt(localId, { uploadedBytes: e.loaded, totalBytes: e.total });
      }
    };
    xhr.upload.onload = () => patchAtt(localId, { status: "parsing" });
    xhr.onerror = () => patchAtt(localId, { status: "failed", error: "网络异常，请重试" });
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText) as {
          id?: string; name?: string; status?: string; chars?: number;
          suggestions?: string[]; helpNote?: string; message?: string; error?: string;
        };
        if (xhr.status === 200 && res.status === "parsed" && res.id) {
          patchAtt(localId, {
            status: "ready", serverId: res.id, chars: res.chars,
            suggestions: res.suggestions, helpNote: res.helpNote,
          });
        } else {
          patchAtt(localId, { status: "failed", error: res.message || "上传失败，请重试" });
        }
      } catch {
        patchAtt(localId, { status: "failed", error: "上传失败，请重试" });
      }
    };
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 允许再次选择同名文件
    const room = MAX_FILES - atts.filter((a) => a.status !== "failed").length;
    if (files.length > room) setToolNotice(`每条消息最多附 ${MAX_FILES} 个文档`);
    files.slice(0, Math.max(0, room)).forEach(uploadOne);
  };

  const openPreview = async (a: Att) => {
    if (!a.serverId) return;
    try {
      const res = await fetch(`/api/upload?id=${encodeURIComponent(a.serverId)}`);
      if (!res.ok) return;
      const j = (await res.json()) as { name: string; chars: number; text: string };
      setPreview({ name: j.name, text: j.text, chars: j.chars });
    } catch { /* 预览失败静默——不影响发送 */ }
  };

  const busy = atts.some((a) => a.status === "uploading" || a.status === "parsing");
  const readyAtts = atts.filter((a) => a.status === "ready" && a.serverId);
  const suggestions = value.trim() === "" && readyAtts.length > 0 ? readyAtts[0].suggestions ?? [] : [];
  const helpNote = readyAtts.find((a) => a.helpNote)?.helpNote;

  const handleSend = () => {
    if (!value.trim() && readyAtts.length === 0) return;
    if (busy) return; // 有附件仍在上传/解析：不发半截
    onSend?.(value.trim(), readyAtts.map((a) => ({ id: a.serverId!, name: a.name })));
    setValue("");
    setAtts([]);
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div ref={rootRef} data-testid="chat-composer-shell" className="edu-composer-shell relative px-4 pb-4 pt-3">
      <div data-testid="chat-composer" className="edu-composer mx-auto rounded-[20px] transition-[border-color,box-shadow] duration-200">
        {atts.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {atts.map((a) => (
              <div
                key={a.localId}
                className={`edu-glass-inset flex min-h-[40px] min-w-0 max-w-full flex-wrap items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-[12px] ${
                  a.status === "failed"
                    ? "!border-[var(--c-alert)]/40 !bg-[var(--c-alert)]/5 text-[var(--c-alert)]"
                    : "text-[var(--text-2)]"
                }`}
              >
                <FileText size={14} className="shrink-0" />
                <span className="min-w-0 max-w-[180px] flex-1 truncate font-semibold text-[var(--text)]">{a.name}</span>
                <span aria-live="polite" className="min-w-0 break-words">
                  {a.status === "ready" && `已读取 ${a.chars} 字`}
                  {a.status === "failed" && (a.error || "失败")}
                </span>
                {a.status === "ready" && (
                  <button
                    type="button"
                    onClick={() => openPreview(a)}
                    className="inline-flex min-h-[32px] items-center gap-0.5 rounded px-1 text-[var(--c-primary)] hover:underline"
                    aria-label={`预览 ${a.name} 的抽取文本`}
                  >
                    <Eye size={13} /> 预览
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAtts((cur) => cur.filter((x) => x.localId !== a.localId))}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded hover:bg-[var(--rg-control-bg)]"
                  aria-label={`移除 ${a.name}`}
                >
                  <X size={13} />
                </button>
                {(a.status === "uploading" || a.status === "parsing") && (
                  <GenerationProgress
                    label={a.status === "uploading" ? "正在上传附件" : "等待附件解析结果"}
                    detail={a.status === "uploading" ? "正在发送附件内容" : "上传已完成，等待服务器处理结果"}
                    completed={a.status === "uploading" ? a.uploadedBytes : undefined}
                    total={a.status === "uploading" ? a.totalBytes : undefined}
                    unit="字节"
                    startedAt={a.startedAt}
                    className="min-w-0 w-full basis-full !py-1"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {helpNote && (
          <p data-safety-critical="upload-care" className="px-4 pt-2 text-[12px] text-[var(--text-2)]">{helpNote}</p>
        )}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setValue(s)}
                className="edu-3d-control inline-flex min-h-[34px] items-center rounded-full px-2.5 text-[12px] text-[var(--text-2)] hover:text-[var(--text)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={taRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKey}
          aria-label="输入消息"
          aria-keyshortcuts="Enter"
          title="Enter 发送，Shift+Enter 换行"
          placeholder={placeholder}
          rows={1}
          className="focus-quiet block w-full resize-none rounded-t-[20px] bg-transparent px-5 pt-4 pb-2 text-[14px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-3)]"
        />
        <div className="edu-composer-toolbar flex flex-wrap items-center gap-1.5 px-3 pb-2.5">
          <input ref={fileRef} type="file" accept=".docx,.pdf,.txt" multiple hidden onChange={handlePick} />
          {/* Claude 式「+」：附件收成一枚圆钮（aria/title 保留完整说明，触达 40px 绝对像素） */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="上传文档（docx / pdf / txt）"
            title="上传文档（docx / pdf / txt，单个 ≤20MB）"
            className="edu-3d-control grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-2)] hover:text-[var(--text)]"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={() => setToolNotice("提示词库已接入提示词中心，可先到 /prompts 选择模板。")}
            aria-label="打开提示词库说明"
            className="edu-3d-control inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-[13px] text-[var(--text-3)] hover:text-[var(--text)]"
          >
            <BookMarked size={14} /> <span className="edu-composer-tool-label">提示词库</span>
          </button>
          <div className="edu-composer-controls ml-auto flex items-center gap-1 pr-0.5">
            {controls}
            <button
              type="button"
              onClick={handleSend}
              disabled={(!value.trim() && readyAtts.length === 0) || busy}
              className="edu-3d-control edu-3d-primary grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="发送"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {toolNotice && (
        <div role="status" aria-live="polite" className="edu-composer-notice mx-auto mt-2 text-center text-[11px] text-[var(--text-2)]">
          {toolNotice}
        </div>
      )}

      {/* 能力边界行（W-B1 更新）：上传能力落地，原「本对话暂不支持上传附件」若保留即反向说谎——
          换成新边界句并保持 data-safety-critical 白名单口径（门禁 phrase 已同步）。 */}
      <div className="edu-composer-safety mx-auto mt-2 text-center text-[11px] leading-relaxed text-[var(--text-3)]">
        {studentNotice && (
          <>
            <span data-safety-critical="ai-identity">我是 AI，我会出错——作业与考试相关内容请以老师和教材为准</span>
            <span aria-hidden> · </span>
            <span data-safety-critical="privacy">对话仅存储在校内平台，不对同学公开、不用于排名</span>
            <span aria-hidden> · </span>
          </>
        )}
        <span data-safety-critical="no-web-search">AI 不会上网搜，只用校内资料，最新发生的事可能不知道</span>
        <span aria-hidden> · </span>
        <span data-safety-critical="upload-scope">附件支持 docx / pdf / txt，单个 ≤20MB，内容随消息一起进入校内安全检查</span>
        <span aria-hidden> · </span>
        <span>每条消息都会经过校内安全策略检查 · 请勿输入涉密信息</span>
      </div>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.name} 抽取文本预览`}
          className="onboarding-experience fixed inset-0 z-50 grid place-items-center bg-[rgba(18,31,52,0.48)] p-4 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="edu-glass-panel-strong max-h-[70vh] w-full max-w-[640px] overflow-auto rounded-[20px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--text)]">{preview.name} · AI 将读到的内容（共 {preview.chars} 字{preview.chars > 4000 ? "，此处展示前 4000 字" : ""}）</h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="edu-3d-control grid h-[40px] w-[40px] place-items-center rounded-[12px]"
                aria-label="关闭预览"
              >
                <X size={16} />
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-2)]">{preview.text}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
