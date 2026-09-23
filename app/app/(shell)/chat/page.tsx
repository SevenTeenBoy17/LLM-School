"use client";

import { Suspense, useState, useRef, useEffect, useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { RightRail, RailSection } from "@/components/shell/RightRail";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatTopbar } from "@/components/chat/ChatTopbar";
import { StudentDock } from "@/components/chat/StudentDock";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer } from "@/components/chat/Composer";
import { MODELS, MODEL_GRADIENT_CSS, isModelId } from "@/lib/data/models";
import { useModelStore } from "@/lib/store/useModelStore";
import { useUserStore } from "@/lib/store/useUserStore";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { useSafetyStore } from "@/lib/store/useSafetyStore";
import { classifyIntent } from "@/lib/safety/classifyIntent";
import { CRISIS_REPLY_OFFLINE } from "@/lib/safety/hotlines";
import { tutorScaffold } from "@/lib/voice";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { Sparkles, Bot, X, Plus, MessageSquare, PanelLeftClose, PanelLeftOpen, Pin, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import {
  apiListSessions, apiCreateSession, apiGetSession, apiDeleteSession, apiPatchSession,
  apiSetFavorite, apiSetFeedback, type SessionSummary, type Sentiment,
} from "@/lib/client/chatApi";
import { apiGetPrompt, apiGetAgent, type ClientAgent } from "@/lib/client/libraryApi";

// Date.now() 属「不纯」——抽到模块级封装，避免在组件体内直接调用触发 react-hooks/purity；
// 顺带用自增序号保证同一毫秒内多次生成的临时 id 也唯一。
let __seq = 0;
function freshId(suffix: string): string { __seq += 1; return `m${Date.now().toString(36)}${__seq}${suffix}`; }
function nowTs(): number { return Date.now(); }
function sourceFromKind(kind: string, source?: ChatMessage["source"]): ChatMessage["source"] | undefined {
  if (source) return source;
  if (kind === "crisis") return "safety";
  if (kind === "care") return "care";
  if (kind === "scaffold") return "integrity-scaffold";
  return undefined;
}
function durationForSource(source: ChatMessage["source"] | undefined, ms: number): number | undefined {
  return source === "remote" || source === "local" || source === "local-fallback" ? ms : undefined;
}
const API_HISTORY_LIMIT = 10;
const API_HISTORY_CONTENT_LIMIT = 2000;
const API_HISTORY_TOTAL_LIMIT = 4000;
function buildApiHistory(items: ChatMessage[]) {
  const candidates = items
    .filter((m) => !m.streaming && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-API_HISTORY_LIMIT);
  const selected: Array<{ role: "user" | "assistant"; content: string }> = [];
  let remaining = API_HISTORY_TOTAL_LIMIT;
  for (let i = candidates.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const item = candidates[i];
    const limit = Math.min(API_HISTORY_CONTENT_LIMIT, remaining);
    const content = item.content.slice(0, limit);
    if (!content) continue;
    selected.push({ role: item.role as "user" | "assistant", content });
    remaining -= content.length;
  }
  return selected.reverse();
}
function agentContractErrorText(error: string): string | null {
  if (error === "agent_not_found") return "该智能体已停用或你暂无权限使用，已停止本次发送。";
  if (error === "agent_session_mismatch") return "当前会话绑定的智能体与请求不一致，已停止本次发送。";
  if (error === "invalid_agent_contract") return "智能体身份校验失败，请从智能体卡片重新进入对话。";
  return null;
}

const CHAT_SIDEBAR_PREFERENCE_EVENT = "eduai:chat-sidebar-preference";
const chatSidebarPreferenceMemory = new Map<string, boolean>();

function subscribeChatSidebarPreference(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHAT_SIDEBAR_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHAT_SIDEBAR_PREFERENCE_EVENT, onChange);
  };
}

function readChatSidebarPreference(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "closed") return false;
    if (stored === "open") return true;
  } catch {
    // 受限浏览器中退回到当前页面的内存状态。
  }
  return chatSidebarPreferenceMemory.get(key) ?? true;
}

function writeChatSidebarPreference(key: string, open: boolean) {
  chatSidebarPreferenceMemory.set(key, open);
  try {
    window.localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    // 本地存储不可用时仍保留当前页面内的显隐能力。
  }
  window.dispatchEvent(new Event(CHAT_SIDEBAR_PREFERENCE_EVENT));
}

function ChatInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useSessionRole(); // 服务端会话角色优先（学生监督横幅/引导必须对学生可见，T5 P1）
  const sidebarPreferenceKey = `eduai.chat.sidebar.v1.${role}`;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feedback, setFeedback] = useState<Record<string, Sentiment>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [sessionNotice, setSessionNotice] = useState("");
  const [announce, setAnnounce] = useState(""); // 屏幕阅读器播报（评审 a11y P0-2）
  const [composerSeed, setComposerSeed] = useState(""); // /chat?prompt= 注入的正文
  const [activeAgent, setActiveAgent] = useState<ClientAgent | null>(null); // /chat?agent= 载入的智能体
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const readSidebarPreference = useCallback(() => readChatSidebarPreference(sidebarPreferenceKey), [sidebarPreferenceKey]);
  const sidebarOpen = useSyncExternalStore(subscribeChatSidebarPreference, readSidebarPreference, () => true);
  const setSidebarOpen = useCallback((open: boolean) => writeChatSidebarPreference(sidebarPreferenceKey, open), [sidebarPreferenceKey]);

  const current = useModelStore((s) => s.current);
  const setCurrent = useModelStore((s) => s.setCurrent);
  const deepThink = useModelStore((s) => s.deepThinkOn);
  const knowledge = useModelStore((s) => s.knowledgeOn); // 「知识库」开关：随请求发给服务端做 KB grounding
  const stage = useUserStore((s) => s.stage);
  const model = MODELS.find((m) => m.id === current) || MODELS[0];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 流式定时器 ref + 卸载清理（修复：离开页面/连发导致的泄漏与交错，code-review P0-1）
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoLoadRef = useRef(false);
  // 会话载入序号：防止「快速切 A→B」时 A 的慢响应覆盖 B 的消息/收藏/反馈（乱序竞态）。
  const loadTokenRef = useRef(0);
  // 进行中的流式请求控制器：连发/切会话/新建/删除/卸载时 abort，释放旧 HTTP 连接与服务端生成（对抗审查 P2 泄漏修复）。
  const abortRef = useRef<AbortController | null>(null);
  const abortInFlight = () => { try { abortRef.current?.abort(); } catch { /* noop */ } abortRef.current = null; };
  const restoreSessionAgent = useCallback(async (agentId: string | undefined, token: number, isAlive: () => boolean = () => true) => {
    if (!agentId) {
      if (isAlive() && token === loadTokenRef.current) setActiveAgent(null);
      return;
    }
    const agent = await apiGetAgent(agentId);
    if (!isAlive() || token !== loadTokenRef.current) return;
    if (agent) {
      setActiveAgent(agent);
      if (agent.recommendedModel && agent.recommendedModel !== "gpt-image") setCurrent(agent.recommendedModel);
      return;
    }
    const notice = "该会话关联的智能体已停用或不可见，已切换为普通对话。";
    setActiveAgent(null);
    setSessionNotice(notice);
    setAnnounce(notice);
  }, [setCurrent]);

  const toggleSidebar = useCallback(() => {
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const next = !sidebarOpen;
    setSidebarOpen(next);
    setAnnounce(next ? "会话侧栏已显示" : "会话侧栏已隐藏");
  }, [setSidebarOpen, sidebarOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.code !== "Backslash") return;
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      event.preventDefault();
      toggleSidebar();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [toggleSidebar]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (slowNoticeTimerRef.current) clearTimeout(slowNoticeTimerRef.current);
    abortInFlight(); // 卸载时中止进行中的流，避免连接与服务端生成泄漏、及卸载后 setState
  }, []);

  const clearSlowNotice = () => {
    if (slowNoticeTimerRef.current) {
      clearTimeout(slowNoticeTimerRef.current);
      slowNoticeTimerRef.current = null;
    }
  };

  const scheduleSlowNotice = (targetId: string) => {
    clearSlowNotice();
    slowNoticeTimerRef.current = setTimeout(() => {
      const notice = "外部模型响应较慢，正在继续等待；如网关不可用将自动切换校内兜底…";
      setAnnounce(notice);
      setMessages((cur) => cur.map((m) => (m.id === targetId && m.streaming ? { ...m, content: notice } : m)));
    }, 10_000);
  };

  const refreshSessions = useCallback(async () => {
    setSessions(await apiListSessions());
  }, []);

  // 首次进入：拉取真实会话列表，选中最近一条并载入历史。
  useEffect(() => {
    const directSession = searchParams.get("session");
    const startsFreshTask = Boolean(
      searchParams.get("prompt") ||
      searchParams.get("agent") ||
      searchParams.get("seed") ||
      searchParams.get("model")
    );
    let alive = true;
    (async () => {
      const list = await apiListSessions();
      if (!alive) return;
      setSessions(list);
      if (list.length > 0 && !directSession && !startsFreshTask && !skipAutoLoadRef.current) {
        const token = ++loadTokenRef.current;
        setActiveId(list[0].id);
        const loaded = await apiGetSession(list[0].id);
        if (alive && loaded && token === loadTokenRef.current) {
          setMessages(loaded.messages);
          setFeedback(loaded.feedback);
          setFavorites(new Set(loaded.favorites));
          void restoreSessionAgent(loaded.session.agentId, token, () => alive);
        }
      }
      if (alive) setLoadingSessions(false);
    })();
    return () => { alive = false; };
  }, [restoreSessionAgent, searchParams]);

  // 处理 /chat?prompt= / ?agent= / ?session= 注入：预填提示词 / 载入智能体身份 / 直达某会话（全局搜索用）。
  useEffect(() => {
    const promptId = searchParams.get("prompt");
    const agentId = searchParams.get("agent");
    const sessionParam = searchParams.get("session");
    const seed = searchParams.get("seed");
    const modelParam = searchParams.get("model");
    const requestedModel = isModelId(modelParam) ? modelParam : undefined;
    if (!promptId && !agentId && !sessionParam && !seed && !requestedModel) return;
    let alive = true;
    (async () => {
      if (!sessionParam && (promptId || agentId || seed || requestedModel)) {
        skipAutoLoadRef.current = true;
        setActiveId(null);
        setMessages([]);
        setFeedback({});
        setFavorites(new Set());
        setSessionNotice("");
        if (!agentId) setActiveAgent(null);
      }
      if (requestedModel) {
        setCurrent(requestedModel);
        setAnnounce(`已切换模型：${MODELS.find((m) => m.id === requestedModel)?.name ?? requestedModel}`);
      }
      if (seed) setComposerSeed(seed); // 原始文本预填（个人中心常用提示词 chip）
      if (sessionParam) {
        skipAutoLoadRef.current = true;
        const token = ++loadTokenRef.current;
        setActiveId(sessionParam);
        setSessionNotice("");
        setMessages([]);
        const loaded = await apiGetSession(sessionParam);
        if (alive && token === loadTokenRef.current) {
          if (loaded) {
            setMessages(loaded.messages);
            setFeedback(loaded.feedback);
            setFavorites(new Set(loaded.favorites));
            void restoreSessionAgent(loaded.session.agentId, token, () => alive);
          } else {
            const notice = "该会话不存在，或你没有权限访问。已为你开启新的对话。";
            skipAutoLoadRef.current = true;
            setActiveId(null);
            setMessages([]);
            setFeedback({});
            setFavorites(new Set());
            setActiveAgent(null);
            setSessionNotice(notice);
            setAnnounce(notice);
            router.replace("/chat");
            window.setTimeout(() => window.history.replaceState(null, "", "/chat"), 0);
          }
        }
      }
      if (promptId) {
        const p = await apiGetPrompt(promptId, true); // 通过受保护的 POST 记录一次调用
        if (alive && p) {
          const vars: Record<string, string> = {};
          for (const v of p.variables ?? []) vars[v.key] = v.defaultValue;
          const body = (p.body ?? p.description).replace(/\{([^}]+)\}/g, (m, k) => (vars[k]?.trim() ? vars[k] : m));
          setComposerSeed(body);
          if (p.recommendedModel && p.recommendedModel !== "gpt-image") setCurrent(p.recommendedModel);
          setAnnounce(`已载入提示词：${p.title}`);
        }
      }
      if (agentId) {
        const token = ++loadTokenRef.current;
        skipAutoLoadRef.current = true;
        setActiveId(null);
        setMessages([]);
        setFeedback({});
        setFavorites(new Set());
        setSessionNotice("");
        const a = await apiGetAgent(agentId, true);
        if (!alive || token !== loadTokenRef.current) return;
        if (a) {
          setActiveAgent(a);
          if (a.recommendedModel && a.recommendedModel !== "gpt-image") setCurrent(a.recommendedModel);
          setAnnounce(`正在使用智能体：${a.name}`);
        } else {
          const notice = "该智能体已停用或不可见，已切换为普通对话。";
          setActiveAgent(null);
          setSessionNotice(notice);
          setAnnounce(notice);
          router.replace("/chat");
          window.setTimeout(() => window.history.replaceState(null, "", "/chat"), 0);
        }
      }
    })();
    return () => { alive = false; };
  }, [restoreSessionAgent, router, searchParams, setCurrent]);

  // 消息更新后滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const selectSession = async (id: string) => {
    if (id === activeId) return; // 重选当前会话是 no-op：先返回，保住本会话正在进行的流（含危机 JSON 窗口），绝不 abort 自身
    abortInFlight(); // 仅在真正切到别的会话时才中止上一条流（收敛轮 P2：abort 曾误置于此守卫之前）
    if (timerRef.current) clearInterval(timerRef.current);
    const token = ++loadTokenRef.current;
    skipAutoLoadRef.current = false;
    setSessionNotice("");
    setActiveId(id);
    setMessages([]);
    const loaded = await apiGetSession(id);
    if (token !== loadTokenRef.current) return; // 已被更晚的选择取代，丢弃这次乱序返回
    if (loaded) {
      setMessages(loaded.messages);
      setFeedback(loaded.feedback);
      setFavorites(new Set(loaded.favorites));
      void restoreSessionAgent(loaded.session.agentId, token);
    } else {
      setFeedback({});
      setFavorites(new Set());
      setActiveAgent(null);
    }
  };

  const handleNew = async () => {
    abortInFlight(); // 新建对话前中止进行中的流
    if (timerRef.current) clearInterval(timerRef.current);
    setMobileHistoryOpen(false);
    skipAutoLoadRef.current = false;
    setSessionNotice("");
    const s = await apiCreateSession(current, undefined, activeAgent?.id);
    if (!s) { setAnnounce("新建对话失败，请稍后再试。"); return; }
    setSessions((cur) => [s, ...cur]);
    setActiveId(s.id);
    setMessages([]);
    setFeedback({});
    setFavorites(new Set());
    setAnnounce("已新建对话。");
  };

  const handleDelete = async (id: string) => {
    const ok = await apiDeleteSession(id);
    if (!ok) return;
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    if (activeId === id) {
      if (remaining.length) await selectSession(remaining[0].id);
      else { setActiveId(null); setMessages([]); setFeedback({}); setFavorites(new Set()); }
    }
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await apiPatchSession(id, { pinned });
    await refreshSessions();
  };

  const handleRename = async (id: string, title: string) => {
    const s = await apiPatchSession(id, { title });
    if (!s) return false;
    setSessions((cur) => cur.map((item) => item.id === id ? s : item));
    return true;
  };

  // 逐字流式渲染（UI 体验），由「服务端权威」回复驱动
  const streamReply = (reply: string, targetId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 6;
      setMessages((cur) =>
        cur.map((m) =>
          m.id === targetId ? { ...m, content: reply.slice(0, i), streaming: i < reply.length } : m
        )
      );
      if (i >= reply.length && timerRef.current) {
        clearInterval(timerRef.current);
        setAnnounce(reply); // 完成时整段播报，避免逐字刷屏
      }
    }, 40);
  };

  // 消费服务端 SSE：逐片把真实模型分片实时追加进目标气泡；done 事件带 kind/source/references/ids。
  // 相邻分片间超时在服务端处理，故长回复（教研材料包等 >60s）不再被硬超时误杀。
  const consumeChatStream = async (
    res: Response,
    targetId: string,
    opts: { userPlaceholderId?: string; requestStartedAt: number; onProgress?: () => void }
  ): Promise<void> => {
    if (timerRef.current) clearInterval(timerRef.current); // 关掉模拟打字定时器，改由真实分片驱动
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    let started = false;
    const flush = (block: string): void => {
      let ev = "";
      let dataLine = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) ev = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
      }
      if (!dataLine) return;
      let j: {
        text?: string; kind?: string; source?: ChatMessage["source"]; durationMs?: number;
        help?: boolean; references?: ChatMessage["references"]; messageId?: string; userMessageId?: string; artifactId?: string;
      };
      try { j = JSON.parse(dataLine); } catch { return; }
      if (ev === "delta") {
        if (!started) { started = true; clearSlowNotice(); opts.onProgress?.(); }
        acc += j.text ?? "";
        setMessages((cur) => cur.map((m) => (m.id === targetId ? { ...m, content: acc, streaming: true } : m)));
      } else if (ev === "done") {
        if (j.help) useSafetyStore.getState().openHelp();
        const nextSource = sourceFromKind(j.kind ?? "", j.source);
        const nextDuration = durationForSource(nextSource, j.durationMs ?? (nowTs() - opts.requestStartedAt));
        setMessages((cur) => cur.map((m) => {
          if (m.id === opts.userPlaceholderId && j.userMessageId) return { ...m, id: j.userMessageId };
          if (m.id === targetId) return {
            ...m,
            id: j.messageId ?? m.id,
            content: acc,
            streaming: false,
            source: nextSource,
            durationMs: nextDuration,
            ...(j.artifactId ? { artifactId: j.artifactId } : {}),
            references: j.references,
          };
          return m;
        }));
        setAnnounce(acc);
      }
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n\n")) >= 0) { flush(buf.slice(0, nl)); buf = buf.slice(nl + 2); }
      }
      if (buf.trim()) flush(buf);
    } finally {
      // 释放 reader（正常结束或被 abort 中断都要释放），关闭底层连接，防泄漏。
      try { await reader.cancel(); } catch { /* 已关闭/已释放则忽略 */ }
    }
  };

  const handleSend = async (msg: string, uploads: { id: string; name: string }[] = []) => {
    if (!msg.trim() && !uploads.length) return;
    skipAutoLoadRef.current = false;
    setSessionNotice("");
    if (timerRef.current) clearInterval(timerRef.current); // 取消上一条流，避免交错
    setAnnounce("正在生成回答…");

    // 确保存在归属会话（无则先建，标题取消息摘要）
    let sessionId = activeId;
    if (!sessionId) {
      const s = await apiCreateSession(current, msg.slice(0, 24), activeAgent?.id);
      if (s) { sessionId = s.id; setSessions((cur) => [s, ...cur]); setActiveId(s.id); }
    }

    const uid = freshId("u");
    const aid = freshId("a");
    const userMsg: ChatMessage = {
      id: uid,
      role: "user",
      content: uploads.length ? `${msg}${msg ? "\n" : ""}📎 ${uploads.map((u) => u.name).join("、")}` : msg,
      timestamp: nowTs(),
    };
    const placeholder: ChatMessage = {
      id: aid,
      role: "assistant",
      modelId: model.id,
      timestamp: nowTs(),
      streaming: true,
      content: "正在生成回答…",
    };
    // 提交前的对话历史（不含本条/占位/未完成流），用于多轮上下文
    const history = buildApiHistory(messages);
    setMessages((cur) => [...cur, userMsg, placeholder]);

    // 安全/角色判定与回复生成全部由服务端权威完成（危机硬拦截、防代写学伴、诚信留痕、模型网关），
    // 学生改前端代码也无法绕过。前端仅在网络不可达时做最小兜底，保证危机识别不缺位（纵深防御）。
    const requestStartedAt = nowTs();
    scheduleSlowNotice(aid);
    abortInFlight(); // 中止任何上一条仍在流的请求
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let sawDelta = false; // 是否已收到至少一个真实分片（决定 abort 时移除占位气泡还是保留半截）
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, modelId: current, deepThink, knowledge, sessionId, agentId: activeAgent?.id, history, stream: true, uploadIds: uploads.length ? uploads.map((u) => u.id) : undefined }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let error = "";
        try { error = String(((await res.json()) as { error?: string }).error ?? ""); } catch { /* ignore */ }
        const contractText = agentContractErrorText(error);
        if (contractText) {
          clearSlowNotice();
          setMessages((cur) => cur.map((m) => (m.id === aid ? { ...m, content: contractText, streaming: false, source: undefined, durationMs: undefined } : m)));
          setAnnounce(contractText);
          return;
        }
        throw new Error(`chat_${res.status}`);
      }
      // 常规路径 → SSE 流式；安全/诚信硬拦截分支仍返回 JSON（下方按原逻辑处理）。
      if ((res.headers.get("content-type") || "").includes("text/event-stream")) {
        await consumeChatStream(res, aid, { userPlaceholderId: uid, requestStartedAt, onProgress: () => { sawDelta = true; } });
        void refreshSessions();
        return;
      }
      const data = (await res.json()) as {
        kind: string;
        reply: string;
        source?: ChatMessage["source"];
        durationMs?: number;
        help?: boolean;
        messageId?: string;
        userMessageId?: string;
        references?: ChatMessage["references"];
      };
      if (data.help) useSafetyStore.getState().openHelp(); // 危机：程序化打开「安全求助」窗口
      clearSlowNotice();
      const nextSource = sourceFromKind(data.kind, data.source);
      const nextDuration = durationForSource(nextSource, data.durationMs ?? (nowTs() - requestStartedAt));
      // 用真实 DB 消息 id 替换占位 id（供收藏/反馈落库到正确目标）
      if (data.userMessageId || data.messageId) {
        setMessages((cur) => cur.map((m) => {
          if (m.id === uid && data.userMessageId) return { ...m, id: data.userMessageId };
          if (m.id === aid) return {
            ...m,
            id: data.messageId ?? m.id,
            durationMs: nextDuration,
            source: nextSource,
            references: data.references,
          };
          return m;
        }));
      } else {
        setMessages((cur) => cur.map((m) => (m.id === aid ? {
          ...m,
          durationMs: nextDuration,
          source: nextSource,
          references: data.references,
        } : m)));
      }
      streamReply(data.reply, data.messageId ?? aid);
      void refreshSessions(); // bump 排序 + 标题 + preview
    } catch {
      // 被 abort（连发/切会话/新建/卸载）→ 不写"网络不稳"兜底。未收到任何真实分片→移除占位气泡（不留"正在生成…/响应较慢…"）；
      // 已流出部分内容→去掉转圈保留半截真实文本。（终收敛轮：改用 sawDelta 标志，不再依赖占位字符串，避免慢提示改写后误判。）
      if (ctrl.signal.aborted) {
        clearSlowNotice();
        setMessages((cur) => sawDelta
          ? cur.map((m) => (m.id === aid ? { ...m, streaming: false } : m))
          : cur.filter((m) => m.id !== aid));
        return;
      }
      clearSlowNotice();
      // 网络兜底：本地快筛仍优先识别危机，绝不让危机消息无人响应。
      // 与服务端一致：判定要覆盖「本条 + 历史 user 内容」，防跨轮危机在降级路径被漏判。
      const probe = [msg, ...history.filter((m) => m.role === "user").map((m) => m.content)].join("\n");
      const intent = classifyIntent(probe);
      let reply: string;
      if (intent === "crisis") {
        useSafetyStore.getState().openHelp();
        reply = CRISIS_REPLY_OFFLINE;
        setMessages((cur) => cur.map((m) => (m.id === aid ? { ...m, source: "safety", durationMs: undefined } : m)));
      } else if (role === "student" && intent === "integrity") {
        reply = tutorScaffold(stage, msg); // 与服务端一致：按学科分化引导（写作/解题）
        setMessages((cur) => cur.map((m) => (m.id === aid ? { ...m, source: "integrity-scaffold", durationMs: undefined } : m)));
      } else {
        reply = "网络好像不太稳定，刚才的回答没能送达 😣 请稍后再发一次。";
        setMessages((cur) => cur.map((m) => (m.id === aid ? { ...m, source: "local-fallback", durationMs: undefined } : m)));
      }
      streamReply(reply, aid);
    }
  };

  // 重新生成：以该回答之前最近一条用户消息重打模型，就地替换（不重复落库，避免历史里出现重复轮次）。
  const handleRegenerate = async (assistantId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 1) return;
    let userText = "";
    for (let i = idx - 1; i >= 0; i--) { if (messages[i].role === "user") { userText = messages[i].content; break; } }
    if (!userText) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setAnnounce("正在重新生成…");
    // 快照原答案：若重打在首个分片前被 abort，还原它（否则原本完好的答案会被"正在重新生成…"占位覆盖且丢失）。
    const originalMsg = messages.find((m) => m.id === assistantId);
    setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, streaming: true, content: "正在重新生成…" } : m)));
    const history = buildApiHistory(messages.slice(0, idx));
    const requestStartedAt = nowTs();
    scheduleSlowNotice(assistantId);
    abortInFlight();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let sawDelta = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: userText, modelId: current, deepThink, knowledge, agentId: activeAgent?.id, history, stream: true }), // 无 sessionId → 不重复落库
        signal: ctrl.signal,
      });
      if (!res.ok) {
        let error = "";
        try { error = String(((await res.json()) as { error?: string }).error ?? ""); } catch { /* ignore */ }
        const contractText = agentContractErrorText(error);
        if (contractText) {
          clearSlowNotice();
          setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, content: contractText, streaming: false, source: undefined, durationMs: undefined } : m)));
          setAnnounce(contractText);
          return;
        }
        throw new Error(`chat_${res.status}`);
      }
      // 常规路径 → SSE 流式（就地替换该回答）；安全分支仍 JSON（下方原逻辑）。references 以本次返回为准，清掉陈旧引用。
      if ((res.headers.get("content-type") || "").includes("text/event-stream")) {
        await consumeChatStream(res, assistantId, { requestStartedAt, onProgress: () => { sawDelta = true; } });
        return;
      }
      const data = (await res.json()) as { kind: string; reply: string; source?: ChatMessage["source"]; durationMs?: number; help?: boolean; references?: ChatMessage["references"] };
      if (data.help) useSafetyStore.getState().openHelp();
      clearSlowNotice();
      const nextSource = sourceFromKind(data.kind, data.source);
      const nextDuration = durationForSource(nextSource, data.durationMs ?? (nowTs() - requestStartedAt));
      // 重打成功：references 以本次返回为准（0 命中/未 grounding 则为 undefined，清掉上一版引用，杜绝陈旧/假引用）。
      setMessages((cur) => cur.map((m) => (m.id === assistantId ? {
        ...m,
        durationMs: nextDuration,
        source: nextSource,
        references: data.references,
      } : m)));
      streamReply(data.reply, assistantId);
    } catch {
      // 被 abort → 不写兜底。未收到任何真实分片→还原重打前的原答案（不留占位/慢提示）；已有部分→去转圈保留。
      // （终收敛轮：改用 sawDelta，不再依赖占位字符串——scheduleSlowNotice 10s 后会改写 content，字符串判等会漏。）
      if (ctrl.signal.aborted) {
        clearSlowNotice();
        setMessages((cur) => cur.map((m) => {
          if (m.id !== assistantId) return m;
          if (!sawDelta && originalMsg) return { ...originalMsg, streaming: false };
          // keep-partial：半截新文本来自远端(source 保留)，但**必须清掉上一版答案遗留的 references/durationMs**——
          // 否则截断的新内容顶着旧「引用 N 份」与旧耗时，属铁律③引用错贴（与本函数危机/降级分支一致，终收敛轮 P2）。
          return { ...m, streaming: false, references: undefined, durationMs: undefined };
        }));
        return;
      }
      clearSlowNotice();
      // 与主发送路径一致的危机兜底：重打失败时也要识别危机（覆盖 userText + 历史），绝不让危机无人响应。
      const probe = [userText, ...history.filter((m) => m.role === "user").map((m) => m.content)].join("\n");
      if (classifyIntent(probe) === "crisis") {
        useSafetyStore.getState().openHelp();
        // 危机兜底文案未用任何 KB → 清掉上一版引用，避免"引用 N 份"贴在与之无关的回复上（铁律③）。
        setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, source: "safety", durationMs: undefined, references: undefined } : m)));
        streamReply(CRISIS_REPLY_OFFLINE, assistantId);
      } else {
        setMessages((cur) => cur.map((m) => (m.id === assistantId ? { ...m, source: "local-fallback", durationMs: undefined, references: undefined } : m)));
        streamReply("网络好像不太稳定，重新生成没能完成 😣 请稍后再试。", assistantId);
      }
    }
  };

  const handleFavorite = async (m: ChatMessage, on: boolean) => {
    setFavorites((cur) => { const n = new Set(cur); if (on) n.add(m.id); else n.delete(m.id); return n; });
    const ok = await apiSetFavorite("message", m.id, on, m.content.slice(0, 120));
    if (!ok) { // 回滚
      setFavorites((cur) => { const n = new Set(cur); if (on) n.delete(m.id); else n.add(m.id); return n; });
      setAnnounce("收藏操作失败，请稍后再试。");
    }
  };

  const handleFeedback = async (messageId: string, s: Sentiment | null) => {
    const prev = feedback[messageId] ?? null;
    setFeedback((cur) => { const n = { ...cur }; if (s) n[messageId] = s; else delete n[messageId]; return n; });
    const ok = await apiSetFeedback(messageId, s);
    if (!ok) { // 回滚
      setFeedback((cur) => { const n = { ...cur }; if (prev) n[messageId] = prev; else delete n[messageId]; return n; });
    }
  };

  return (
    // 布局修复（对抗审查 P1）：此前根节点只有 flex-1，而 ShellFrame 用的是 min-h-screen（下限而非上限），
    // 于是 `flex-1 overflow-y-auto` 的消息区从未真正接管滚动——整页被内容撑高（实测 1440×900 下
    // docHeight=2340），Composer 连同两条 data-safety-critical 能力边界被推到 top≈2294，**掉出首屏**，
    // 「常驻可见」在有历史消息的真实账号上根本不成立；同时 scrollRef.scrollTop=scrollHeight 也变成 no-op。
    // 这里给 chat 一个确定高度（路由级，不动全局滚动模型，避免影响 dashboard/admin 等长表页），
    // 消息区因此成为真正的滚动容器，Composer 固定在视口底部。断言见 render.mjs R5。
    <div className="chat-experience flex h-[calc(100dvh-4rem)] min-h-0 min-w-0 flex-1">
      <h1 className="sr-only">AI 对话，当前模型 {model.name}</h1>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
      <ChatSidebar
        open={sidebarOpen}
        sessions={sessions}
        activeId={activeId}
        loading={loadingSessions}
        onSelect={selectSession}
        onNew={handleNew}
        onDelete={handleDelete}
        onTogglePin={handleTogglePin}
        onRename={handleRename}
      />
      <div data-testid="chat-primary-pane" className="chat-primary-pane relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* H5（Claude/ChatGPT 范式）：学生端对话面不设独立工具条——模型/引导/更多全部
            下沉进输入岛底行（StudentDock，向上弹出）；教师端保留完整顶栏（导出/助手切换等）。 */}
        {role !== "student" && (
          <ChatTopbar
            messages={messages}
            title={sessions.find((s) => s.id === activeId)?.title}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
        )}
        {role === "student" && (
          <button
            type="button"
            data-testid="chat-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "隐藏会话侧栏" : "显示会话侧栏"}
            aria-expanded={sidebarOpen}
            aria-controls="chat-conversation-sidebar"
            aria-keyshortcuts={"Control+\\ Meta+\\"}
            title={sidebarOpen ? "隐藏会话侧栏" : "显示会话侧栏"}
            className="edu-3d-control absolute left-3 top-3 z-40 hidden h-12 w-12 place-items-center rounded-[12px] bg-white/90 text-[var(--text-2)] md:grid"
          >
            {sidebarOpen ? <PanelLeftClose size={18} aria-hidden /> : <PanelLeftOpen size={18} aria-hidden />}
          </button>
        )}
        <div className="edu-glass-panel-strong relative border-b px-4 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleNew()}
              className="edu-3d-control edu-3d-primary inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-semibold"
            >
              <Plus size={14} /> 发起新对话
            </button>
            <button
              type="button"
              onClick={() => setMobileHistoryOpen((v) => !v)}
              aria-expanded={mobileHistoryOpen}
              className="edu-3d-control inline-flex h-12 flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3 text-[13px] font-semibold text-[var(--text-2)]"
            >
              <MessageSquare size={14} /> 最近会话
            </button>
          </div>
          {mobileHistoryOpen && (
            <div className="edu-glass-panel-strong absolute left-4 right-4 top-[58px] z-30 max-h-[320px] overflow-y-auto rounded-[12px] p-2">
              {loadingSessions ? (
                <div className="px-3 py-6 text-center text-[12px] text-[var(--text-3)]">正在载入会话…</div>
              ) : sessions.length === 0 ? (
                <div className="px-3 py-6 text-center text-[12px] text-[var(--text-3)]">暂无会话</div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <div key={s.id} data-active={activeId === s.id ? "true" : "false"} className="edu-session-row flex items-start gap-2 rounded-[12px] px-2 py-2">
                      <button
                        type="button"
                        onClick={() => { void selectSession(s.id); setMobileHistoryOpen(false); }}
                        className="min-w-0 flex-1 text-left"
                        aria-current={activeId === s.id ? "true" : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          {s.pinned && <Pin size={11} className="shrink-0 text-[var(--c-edu)]" />}
                          <span className="truncate text-[13px] font-semibold">{s.title || "新对话"}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-2)]">{s.preview || "暂无消息"}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTogglePin(s.id, !s.pinned)}
                        aria-label={s.pinned ? `取消置顶 ${s.title}` : `置顶 ${s.title}`}
                        className="edu-3d-control grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[var(--text-3)]"
                      >
                        <Pin size={13} className={s.pinned ? "fill-current text-[var(--c-edu)]" : ""} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(s.id)}
                        aria-label={`删除会话 ${s.title}`}
                        className="edu-3d-control grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[var(--err-ink)]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {activeAgent && (
          <div className="edu-chat-agent-banner edu-glass-panel flex items-center gap-2.5 border-x-0 border-t-0 px-5 py-2.5">
            <div className="edu-chat-avatar grid h-8 w-8 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundImage: activeAgent.gradient }}>
              <Bot size={14} />
            </div>
            <div className="min-w-0 flex-1 text-[13px]">
              <span className="font-semibold">正在使用「{activeAgent.name}」智能体</span>
              <span className="ml-2 text-[var(--text-2)]">{activeAgent.category} · {activeAgent.recommendedModel}{activeAgent.knowledgeBase ? ` · ${activeAgent.knowledgeBase}` : ""}</span>
            </div>
            <button type="button" onClick={() => setActiveAgent(null)} aria-label="退出智能体身份" title="退出智能体" className="edu-3d-control grid h-10 w-10 place-items-center rounded-[12px] text-[var(--text-2)]">
              <X size={13} />
            </button>
          </div>
        )}
        <div ref={scrollRef} data-testid="chat-scroll-region" className="edu-chat-scroll flex-1 overflow-y-auto px-3 py-5 sm:px-5 sm:py-6">
          <div data-testid="chat-thread" className="edu-chat-thread mx-auto flex flex-col gap-6">
            {messages.length === 0 && !loadingSessions ? (
              /* H1 星火式空画布（少即是多）：一句问候 + 一排模式 chips，其余全部留白。
                 chips 只填充输入框不代发（学生补上自己的内容再发——保持「先想后问」）。
                 字阶顶格 16px（/chat 棘轮基线 6 档不为改版扩档，层级靠留白与动效表达）。 */
              <div className="edu-chat-empty stagger mx-auto mt-[5vh] grid w-full overflow-hidden rounded-[20px] text-left">
                {sessionNotice && (
                  <div role="status" className="col-span-full m-3 mb-0 rounded-[12px] border border-[var(--warn)] bg-[var(--warn-bg)] px-4 py-3 text-left text-[13px] leading-relaxed text-[var(--warn-ink)]">
                    {sessionNotice}
                  </div>
                )}
                <div className="edu-learning-art-bg relative overflow-hidden" style={{ "--i": 0 } as React.CSSProperties}>
                  <Image
                    src="/art/edu-glass/prism-learning-workbench-v1.webp"
                    alt="打开的书与玻璃棱镜组成的学习台"
                    fill
                    priority
                    sizes="(max-width: 640px) 100vw, 220px"
                    className="object-cover object-center"
                  />
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-[var(--text-2)] shadow-sm">插图由 AI 生成</span>
                </div>
                <div className="flex min-w-0 flex-col justify-center px-5 py-6 sm:px-7">
                  <div className="edu-chat-avatar grid h-11 w-11 place-items-center rounded-[12px] text-white" style={{ "--i": 1, backgroundImage: MODEL_GRADIENT_CSS(model) } as React.CSSProperties}>
                    <Sparkles size={20} />
                  </div>
                  <h2 className="mt-4 text-[16px] font-semibold text-[var(--text)]" style={{ "--i": 2 } as React.CSSProperties}>
                    {role === "student" ? "先想一想，再和我一起拆解" : `开始与 ${model.name} 对话`}
                  </h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]" style={{ "--i": 3 } as React.CSSProperties}>
                    {role === "student" ? "把卡住的地方告诉我。我会给你线索、检查推理，也会提醒你核对老师与教材。" : "备课、出题、答疑、润色，都从一个清楚的目标开始。"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2" style={{ "--i": 4 } as React.CSSProperties}>
                  {(role === "student"
                    ? [
                        { label: "帮我理清思路", seed: "这道题我卡住了，帮我理清思路（不要直接给答案，一步步带我想）：\n\n" },
                        { label: "用自己的话总结", seed: "帮我用自己的话总结这段内容（先给三句话概要再列要点）：\n\n" },
                        { label: "出题考考我", seed: "出一道同类型的练习题考考我（我先做，你再点评）：\n\n" },
                        { label: "讲解一个概念", seed: "请给我讲解这个概念（贴合我的学段，用生活里的例子）：\n\n" },
                      ]
                    : [
                        { label: "生成板书设计", seed: "请为这节课生成板书设计（按知识点结构组织）：\n\n" },
                        { label: "出一组练习题", seed: "请围绕以下知识点出一组分层练习题（基础/提高/挑战各 2 道，附答案）：\n\n" },
                        { label: "输出预习单", seed: "请为这节课输出一份学生预习单（含问题清单与阅读指引）：\n\n" },
                        { label: "润色文段", seed: "请帮我润色下面这段文字（保持原意，指出修改理由）：\n\n" },
                      ]
                  ).map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setComposerSeed(c.seed)}
                      className="edu-3d-control inline-flex min-h-[42px] items-center rounded-full px-4 text-[13px] font-semibold text-[var(--text-2)]"
                    >
                      {c.label}
                    </button>
                  ))}
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-3)]" style={{ "--i": 5 } as React.CSSProperties}>选择一个起点后补充你的具体问题，确认无误再发送。</p>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  showExport={role !== "student"}
                  isStudent={role === "student"}
                  favored={favorites.has(m.id)}
                  sentiment={feedback[m.id] ?? null}
                  onFavorite={m.role === "assistant" ? (on) => handleFavorite(m, on) : undefined}
                  onFeedback={m.role === "assistant" ? (s) => handleFeedback(m.id, s) : undefined}
                  onRegenerate={m.role === "assistant" ? () => handleRegenerate(m.id) : undefined}
                />
              ))
            )}
          </div>
        </div>
        {/* H3（用户拍板）：披露横幅整块撤下——两句白名单命题并入 Composer 灰色脚注
            （同一行 11px 极小字，星火式），措辞与 data-safety-critical 标记原文不变，
            G2/R1 白名单门照常核对原文+几何。折叠细则删除：三条内容已分别由脚注
            （不上网/安全策略）与安全求助浮标承载，不再重复。 */}
        <Composer onSend={handleSend} initialText={composerSeed} studentNotice={role === "student"} controls={role === "student" ? <StudentDock messages={messages} /> : undefined} />
      </div>

      {/* H1：右栏收归教师专属——学生端的建议词已上移为空态模式 chips，模型信息顶栏已有（少即是多） */}
      {role !== "student" && (
      <RightRail
        collapsible
        preferenceKey={`eduai.chat.right-rail.v1.${role}`}
        panelId="chat-context-rail"
        label="模型与建议面板"
        compactContent={(
          <>
            <span
              className="grid h-10 w-10 place-items-center rounded-[12px] text-white shadow-[0_5px_14px_rgba(55,78,111,0.16)]"
              style={{ backgroundImage: MODEL_GRADIENT_CSS(model) }}
              title={`当前模型 ${model.name}`}
            >
              <ModelGlyph id={model.id} size={19} />
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--rg-control-bg)] text-[var(--c-edu)]" title="推荐提示词">
              <Sparkles size={18} />
            </span>
          </>
        )}
      >
        <RailSection title="当前模型">
          <div className="rounded-[20px] border border-[var(--border-2)] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(model) }}>
                <ModelGlyph id={model.id} size={20} />
              </div>
              <div>
                <div className="text-[14px] font-semibold">{model.name}</div>
                <div className="text-[11px] text-[var(--text-3)]">对话模型</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
              <span className="text-[var(--text-2)]">上下文窗口</span>
              <span className="text-num font-semibold text-right">{model.contextWindow}</span>
            </div>
            {model.tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {model.tags.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--rg-control-bg)] px-2 py-0.5 text-[11px] text-[var(--text-2)]">{t}</span>
                ))}
              </div>
            )}
          </div>
        </RailSection>

        <RailSection title="推荐提示词">
          {/* H1：本栏已收归教师专属（学生端建议词上移为空态模式 chips），学生分支随之退役 */}
          {[
            { t: "生成本节课的板书设计",     d: "按知识点结构组织" },
            { t: "为这节课配 5 张教学插图",  d: "生成可复制图像提示词" },
            { t: "输出一份学生预习单",       d: "含问题清单与资料链接" },
          ].map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => void handleSend(p.t)}
              className="w-full rounded-[12px] border border-[var(--border-2)] p-2.5 bg-[var(--card)] text-left hover:border-[var(--c-edu)]/40 transition-colors"
            >
              <div className="text-[13px] font-semibold">{p.t}</div>
              <div className="mt-0.5 text-[11px] text-[var(--text-2)]">{p.d}</div>
            </button>
          ))}
        </RailSection>

        {/* U-2（P1，铁律②不编造数据）：原「安全状态」面板硬编码「敏感信息 未检出 / 引用合规 已通过」，
            与本次会话、本条回答、任何后端返回零关联且恒显绿色——学生把含个人信息的作文粘进来仍会看到
            「未检出」，等于平台替后端做了一个从未发生过的安全判定。已整块删除。
            红线（方案 §7.7）：UI 只允许陈述「已发生的动作与来源事实」（模型来源 / 是否走兜底 / 引用几份校内资料），
            不得对内容做任何合规或安全性判定；即便未来 done 事件有新字段也不得推断。
            若要恢复此类反馈，前置条件为后端新增独立 safetyVerdict 字段且其语义经过一次误报/漏报实测。 */}
      </RightRail>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}
