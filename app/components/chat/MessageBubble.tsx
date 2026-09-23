"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Copy, RefreshCw, ThumbsUp, ThumbsDown, Star, Download, MoreHorizontal, ShieldCheck, HeartHandshake, GraduationCap, Archive } from "lucide-react";
import Link from "next/link";
import type { ChatMessage } from "@/lib/types";
import type { Sentiment } from "@/lib/client/chatApi";
import { exportMessage, type ExportFormat } from "@/lib/client/exportChat";
import { MODELS, MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { cn } from "@/lib/utils";

// These are request placeholders from the chat page, not received model text.
const WAITING_CONTENT = new Set([
  "正在生成回答…",
  "正在重新生成…",
  "外部模型响应较慢，正在继续等待；如网关不可用将自动切换校内兜底…",
]);

interface Props {
  msg: ChatMessage;
  showExport?: boolean; // 学生端隐藏「导出」教师特权（评审 P1·角色驱动）
  isStudent?: boolean;  // V1a：学生端降级提示用人话，不用「网关降级」这类术语
  favored?: boolean;
  sentiment?: Sentiment | null;
  onFavorite?: (on: boolean) => void;
  onFeedback?: (s: Sentiment | null) => void;
  onRegenerate?: () => void;
}

export function MessageBubble({ msg, showExport = true, isStudent = false, favored = false, sentiment = null, onFavorite, onFeedback, onRegenerate }: Props) {
  const isUser = msg.role === "user";
  const model = msg.modelId ? MODELS.find((m) => m.id === msg.modelId) || MODELS[0] : MODELS[0];
  const isSafety = msg.source === "safety" || msg.source === "care";
  const isPolicy = isSafety || msg.source === "integrity-scaffold";
  const PolicyIcon = msg.source === "safety" ? ShieldCheck : msg.source === "care" ? HeartHandshake : GraduationCap;
  const policyGradient =
    // V2：三条策略头像渐变改走令牌。语义分档保留（安全=信息蓝绿 / 关怀=警示暖 / 诚信=处理紫），
    // 但取值不再自造——策略类头像是「功能角色」着色的正例，正该由语义令牌供给。
    msg.source === "safety" ? "linear-gradient(135deg,var(--info),var(--ok))" :
    msg.source === "care" ? "linear-gradient(135deg,var(--err),var(--warn))" :
    "linear-gradient(135deg,var(--proc),var(--info))";
  const sourceLabel =
    msg.source === "remote" ? "真实模型" :
    msg.source === "local-fallback" ? "网关降级" :
    msg.source === "local" ? "本地兜底" :
    msg.source === "safety" ? "校内安全策略" :
    msg.source === "care" ? "安全关怀策略" :
    msg.source === "integrity-scaffold" ? "学术诚信引导" :
    "";
  const headerLabel = isPolicy ? sourceLabel : model.name;
  // V1a：降级不再是一行与模型名同号同色的 11.5px 灰字。保住字符串 ≠ 保住诚实性——
  // 学生根本无法把「网关降级」这个术语映射到「这答案可能不准」。改为正文下方一条整句提示。
  const isDegraded = msg.source === "local" || msg.source === "local-fallback";
  const waitingForReply = !msg.content.trim() || WAITING_CONTENT.has(msg.content.trim());
  // Regeneration retains the previous source until done; it must not hide an active reply.
  const showReplyProgress = !isUser && msg.streaming;
  const [actionNotice, setActionNotice] = useState("");
  // 「更多」菜单改为受控（对抗审查 P2）：原生 <details> 点菜单项后不关、点页面别处不关、
  // 多条消息可同时展开，且展开层 absolute 会盖住后续消息。这里补三件事：
  // 受控 open + 点击外部关闭 + Esc 关闭；选中任一项后由 closeMenu() 收起。
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !panelRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // 菜单面板 fixed 定位（对抗测量实抓的真缺陷）：面板原先 absolute 在消息滚动容器内，
  // 而移动端消息区可视高度不足以容纳整张菜单——最后一条消息（⋯ 最常用的位置）点开后
  // 四个菜单项全部被容器底边裁掉，命中测试落在 composer 上，等于菜单整体不可用。
  // z 档位解决不了 overflow 裁切，必须让面板脱离滚动容器的裁切链：
  // · fixed + 两步测距：先归零量出 fixed 包含块原点（page-enter 常驻 transform，
  //   包含块不是视口），再用视口坐标减原点得样式值——不点名祖先，结构变了也不失效；
  // · 下方空间不足且上方装得下时向上翻转（标准下拉行为）；
  // · 容器滚动/视口变化即收起：fixed 面板不随内容滚动，不收起会和锚点脱节。
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const summary = menuRef.current?.querySelector("summary");
    if (!panel || !summary || !menuOpen) { setMenuPos(null); return; }
    // fixed 的包含块原点经 offsetParent 读取（Chromium：最近的 transform 祖先；无则 null=视口）。
    // 不用「先归零再量」的两步法——那需要直接改 ref DOM 的 style，react-hooks/immutability 不放行。
    const op = panel.offsetParent as HTMLElement | null;
    const or2 = op ? op.getBoundingClientRect() : { left: 0, top: 0 };
    const originLeft = or2.left + (op?.clientLeft ?? 0);
    const originTop = or2.top + (op?.clientTop ?? 0);
    const sr = summary.getBoundingClientRect();
    const ph = panel.offsetHeight;
    const openUp = window.innerHeight - sr.bottom < ph + 8 && sr.top > ph + 8;
    const vx = Math.max(8, Math.min(sr.left, window.innerWidth - panel.offsetWidth - 8));
    const vy = openUp ? sr.top - ph - 4 : sr.bottom + 4;
    setMenuPos({ left: vx - originLeft, top: vy - originTop });
    const onAway = (e: Event) => {
      if (e.target instanceof Node && panel.contains(e.target)) return; // 菜单自身滚动不算
      setMenuOpen(false);
    };
    window.addEventListener("scroll", onAway, { capture: true, passive: true });
    window.addEventListener("resize", onAway);
    return () => {
      window.removeEventListener("scroll", onAway, true);
      window.removeEventListener("resize", onAway);
    };
  }, [menuOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setActionNotice("回答已复制。");
    } catch {
      setActionNotice("复制失败，请手动选择文本。");
    }
  };

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const doExport = async (fmt: ExportFormat) => {
    if (exporting) return;
    setExporting(fmt);
    setActionNotice(`正在生成 ${fmt.toUpperCase()} 文件…`);
    try {
      // Yield before synchronous formats build their download, without a minimum display delay.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await exportMessage(msg.content, fmt);
      setActionNotice(`已导出为 ${fmt.toUpperCase()} 文件。`);
    } catch {
      setActionNotice("导出失败，请重试。");
    } finally {
      setExporting(null);
    }
  };

  // scroll-mt-[64px]：程序化/键盘滚动落到动作按钮时，落点自动让开顶部吸顶行
  // （与门户锚点 scroll-margin-top: 88px 同一处方）。注：此前视觉门那条
  // P1「重新生成←最近会话」后经实证是门自身的误报（收起的 details 菜单项在
  // Chromium 里仍有几何盒子，被门当可见元素扫描），已在门侧按语义排除；
  // 本条 scroll-margin 与菜单 z 档（--z-app-popover）各自独立成立，均保留。
  const btn = "edu-3d-control scroll-mt-[64px] inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1 rounded-[12px] px-3 py-2 hover:text-[var(--text)]";
  const menuItem = "flex min-h-[40px] w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[var(--rg-hover-bg)]";
  // 「⋯」只在真有二级项时渲染——安全/关怀类回复本就抑制了收藏与反馈（既有约定），
  // 此时不该留一个点开是空的入口。
  const hasSecondary =
    Boolean(onRegenerate && !isPolicy) ||
    Boolean(onFavorite && !isSafety) ||
    Boolean(onFeedback && !isSafety) ||
    Boolean(showExport && !isPolicy);

  return (
    <div
      data-chat-role={msg.role}
      data-message-id={msg.id}
      data-chat-streaming={msg.streaming ? "true" : "false"}
      className={cn("edu-chat-message-row flex w-full items-start gap-3", isUser && "flex-row-reverse")}
    >
      <div
        className={cn(
          "edu-chat-message-avatar edu-chat-avatar grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[12px] font-semibold text-white"
        )}
        style={{ backgroundImage: isUser ? "linear-gradient(135deg,var(--warn),var(--err))" : isPolicy ? policyGradient : MODEL_GRADIENT_CSS(model) }}
      >
        {isUser ? "我" : isPolicy ? <PolicyIcon size={18} /> : <ModelGlyph id={model.id} size={18} />}
      </div>
        <div className={cn("edu-chat-message-body min-w-0 flex-1", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "edu-chat-message-card rounded-[20px] px-4 py-3 text-[14px] leading-[1.75]",
            isUser
              ? "edu-chat-message-user"
              : "edu-chat-message-assistant text-[var(--text)]"
          )}
        >
          {/* V1a 元数据瘦身 5 → 2：只留「模型名 + 状态位」。
              · 耗时：对学生无决策价值，删。
              · 引用计数：正文下方已有引用 chip 逐份列出，头部重复，删。
              · 状态位仅在 source !== 'remote' 时出现（正常时不占位，正好服务瘦身），
                且降级的**实质提示**已升级为正文下方的整句 note，此处只作角色标签。 */}
          {!isUser && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-2)]">
              <span className="font-semibold">{headerLabel}</span>
              {!isPolicy && isDegraded && <><span aria-hidden>·</span><span>校内兜底</span></>}
            </div>
          )}

          {isUser ? (
            <div className="whitespace-pre-wrap text-[14px]">{msg.content}</div>
          ) : showReplyProgress && waitingForReply ? null : (
            <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-[16px] prose-h2:text-[14px] prose-h3:text-[14px] prose-h4:text-[14px] prose-strong:text-[var(--text)] prose-code:rounded prose-code:bg-[var(--code-inline-bg)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[13px] prose-code:before:hidden prose-code:after:hidden prose-pre:bg-[var(--code-bg)] prose-pre:text-white prose-pre:rounded-[12px] prose-ul:my-2 prose-li:my-0.5 prose-p:my-1.5 prose-table:text-[13px] prose-th:py-1.5 prose-td:py-1.5 prose-blockquote:font-normal">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}

          {showReplyProgress && (
            <GenerationProgress
              label={waitingForReply ? "正在等待回复" : msg.source === "remote" ? "正在接收回答" : "正在显示回复"}
              detail={waitingForReply
                ? (msg.content.startsWith("外部模型响应较慢") ? msg.content : "等待回答内容返回")
                : msg.source === "remote" ? "已收到部分回答，正在等待后续内容" : "正在处理并显示回复内容"}
              className="mt-2 min-w-0 w-full !py-1"
            />
          )}

          {/* 降级整句提示（V1a）：术语「网关降级/本地兜底」只留给教师端；学生端读到的必须是人话。
              用 warn 语义色 + role="note"，与正文形成明确层级差，而不是压在最低视觉层级。 */}
          {isDegraded && !msg.streaming && (
            <div
              role="note"
              data-degraded="true"
              className="mt-3 rounded-[12px] border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2 text-[12px] leading-relaxed text-[var(--warn-ink)]"
            >
              {isStudent
                ? "这条回答来自校内兜底模型，可能不如平时准确，重要结论请再问老师。"
                : `本条未经外部模型生成（${sourceLabel}），内容可能不完整，请人工复核后再用于教学。`}
            </div>
          )}

          {/* V3 归档回执：自动归档不该是静默的（反模式：无回执的数据写入）。
              chip 只在 done 事件带回真实 artifactId 时渲染——不由前端按长度推断，
              推断会与服务端阈值漂移（铁律②：不渲染没有服务端真值背书的状态）。 */}
          {msg.artifactId && (
            <div className="mt-3">
              <Link
                href="/research/artifacts"
                className="edu-glass-inset inline-flex min-h-[30px] items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              >
                <Archive size={11} aria-hidden /> 已存入教学产物 · 打开
              </Link>
            </div>
          )}

          {msg.references && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {msg.references.map((r, i) => (
                <span key={i} className="edu-glass-inset inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-[var(--text-2)]">
                  <FileText size={11} /> {r.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* V1a 动作区 5 → 2（chat 最大噪声源：6 轮问答曾是 30 个常驻按钮）。
            常驻只留「复制」与二级入口「⋯」；重新生成 / 收藏 / 👍 / 👎 / 导出全部收进 ⋯。
            为何连「重新生成」也收进去：R4③ 要求学生核心动作首屏 ≤1 击可达，而「换个说法」
            已由 composer 的追问 chip 承担，故此处收纳不构成可达性损失。
            ⋯ 用 <details>/<summary>，原生键盘可达（Enter/Space 展开），并带 aria-label。 */}
        {!isUser && !msg.streaming && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-2)]">
            <button type="button" onClick={copy} aria-label="复制回答" title="复制回答" className={btn}>
              <Copy size={12} /> 复制
            </button>
            {hasSecondary && (
              <details
                ref={menuRef}
                open={menuOpen}
                onToggle={(e) => setMenuOpen((e.currentTarget as HTMLDetailsElement).open)}
                className="relative inline-block"
              >
                <summary className={cn(btn, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")} aria-label="更多操作">
                  <MoreHorizontal size={13} /> 更多
                </summary>
                <div ref={panelRef} role="menu" style={menuPos ? { left: menuPos.left, top: menuPos.top } : { visibility: "hidden" }} className="edu-glass-panel-strong fixed m-0 z-[var(--z-app-popover)] max-h-[min(420px,60vh)] min-w-[168px] overflow-y-auto rounded-[12px] py-1">
                  {onRegenerate && !isPolicy && (
                    <button type="button" role="menuitem" onClick={() => { closeMenu(); onRegenerate(); }} className={menuItem}>
                      <RefreshCw size={12} /> 重新生成
                    </button>
                  )}
                  {onFavorite && !isSafety && (
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={favored}
                      onClick={() => { closeMenu(); onFavorite(!favored); }}
                      className={menuItem}
                    >
                      <Star size={12} className={favored ? "fill-current" : ""} /> {favored ? "取消收藏" : "收藏"}
                    </button>
                  )}
                  {onFeedback && !isSafety && (
                    <>
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={sentiment === "up"}
                        onClick={() => { closeMenu(); onFeedback(sentiment === "up" ? null : "up"); }}
                        className={menuItem}
                      >
                        <ThumbsUp size={12} className={sentiment === "up" ? "fill-current" : ""} /> 回答有帮助
                      </button>
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={sentiment === "down"}
                        onClick={() => { closeMenu(); onFeedback(sentiment === "down" ? null : "down"); }}
                        className={menuItem}
                      >
                        <ThumbsDown size={12} className={sentiment === "down" ? "fill-current" : ""} /> 回答待改进
                      </button>
                    </>
                  )}
                  {showExport && !isPolicy && (
                    <>
                      <div className="my-1 border-t border-[var(--border-2)]" />
                      {([["md", "导出 Markdown (.md)"], ["txt", "导出纯文本 (.txt)"], ["html", "导出网页 (.html)"], ["docx", "导出 Word (.docx)"], ["pptx", "导出 PPT 大纲 (.pptx)"]] as [ExportFormat, string][]).map(([f, label]) => (
                        <button key={f} type="button" role="menuitem" disabled={!!exporting} onClick={() => { closeMenu(); void doExport(f); }} className={cn(menuItem, "disabled:cursor-not-allowed disabled:opacity-50")}>
                          <Download size={12} /> {label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </details>
            )}
            {actionNotice && !exporting && <span role="status" aria-live="polite" className="min-w-0 break-words px-1 text-[var(--text-3)]">{actionNotice}</span>}
          </div>
        )}
        {exporting && (
          <GenerationProgress
            label={`正在生成 ${exporting.toUpperCase()} 文件`}
            detail="正在本地准备下载文件"
            className="mt-2 min-w-0 w-full !py-1"
          />
        )}
      </div>
    </div>
  );
}
