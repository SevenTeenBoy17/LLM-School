"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ManorAssignmentsPanel } from "@/components/class/ManorAssignmentsPanel";
import { ManorScenePolicyPanel } from "@/components/class/ManorScenePolicyPanel";
import {
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Undo2,
} from "lucide-react";

type EvidenceItem = {
  id: string;
  studentId: string;
  studentName: string;
  missionId: string;
  status: string;
  rewardClass: string;
  revision: number;
  createdAt: number;
  submission: { content?: string; choice?: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "待审核",
  revise: "需订正",
  accepted_mastery: "已确认掌握",
  accepted_correction: "已完成订正",
};
const FILTERS = ["pending_review", "revise", "accepted_mastery"] as const;

function decisionStorageKey(payload: unknown) {
  const input = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `eduai.manor.pending.teacher-decision.${(hash >>> 0).toString(36)}`;
}

function pendingDecisionId(key: string) {
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored) return stored;
  } catch { /* session storage can be disabled */ }
  const value = `teacher-decision-${crypto.randomUUID()}`;
  try { window.sessionStorage.setItem(key, value); } catch { /* retry remains available in this render */ }
  return value;
}

function clearPendingDecision(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* no-op */ }
}

export default function ManorEvidencePage() {
  const [filter, setFilter] = useState("pending_review");
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const activeFilter = useRef(filter);
  const inMemoryDecisionIds = useRef(new Map<string, string>());

  const load = useCallback(async (status: string, signal?: AbortSignal) => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    try {
      const response = await fetch(
        `/api/v2/teacher/manor/evidence?status=${status}`,
        { cache: "no-store", signal },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "证据队列读取失败。");
      if (sequence !== requestSequence.current) return;
      setItems(body.items ?? []);
      setSelectedId((current) =>
        body.items?.some((item: EvidenceItem) => item.id === current)
          ? current
          : (body.items?.[0]?.id ?? ""),
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (sequence !== requestSequence.current) return;
      setError(caught instanceof Error ? caught.message : "证据队列读取失败。");
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeFilter.current = filter;
    const controller = new AbortController();
    queueMicrotask(() => {
      void load(filter, controller.signal);
    });
    return () => {
      controller.abort();
    };
  }, [filter, load]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const decide = async (status: "accepted_mastery" | "revise") => {
    if (!selected || reason.trim().length < 4 || saving) return;
    const payload = {
      expectedRevision: selected.revision,
      status,
      reason: reason.trim(),
    };
    const storageKey = decisionStorageKey({ evidenceId: selected.id, ...payload });
    const operationId = inMemoryDecisionIds.current.get(storageKey) ?? pendingDecisionId(storageKey);
    inMemoryDecisionIds.current.set(storageKey, operationId);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/v2/teacher/manor/evidence/${selected.id}/decisions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operationId,
            ...payload,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500 && response.status !== 408 && response.status !== 429) {
          inMemoryDecisionIds.current.delete(storageKey);
          clearPendingDecision(storageKey);
        }
        throw new Error(body.error?.message ?? "审核决定没有保存成功。");
      }
      inMemoryDecisionIds.current.delete(storageKey);
      clearPendingDecision(storageKey);
      setNotice(`审核已保存，关联编号 ${body.correlationId}`);
      setReason("");
      await load(activeFilter.current);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "审核决定没有保存成功。",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      className="mx-auto w-full max-w-[1440px] px-4 py-5 lg:px-7"
      data-testid="teacher-manor-evidence"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--accent)]">
            学习证据与成长授权
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text-1)]">
            庄园证据审核
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            开放表达由教师判断；系统不会用模型自动替代审核。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            void load(activeFilter.current);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-medium text-[var(--text-2)]"
          aria-label="刷新证据队列"
        >
          <RefreshCw size={17} />
          刷新
        </button>
      </header>

      <ManorAssignmentsPanel />
      <ManorScenePolicyPanel />
      <div className="mt-4 flex gap-2" role="tablist" aria-label="证据状态">
        {FILTERS.map((status, index) => (
          <button
            key={status}
            id={`evidence-tab-${status}`}
            type="button"
            role="tab"
            aria-selected={filter === status}
            aria-controls="evidence-queue-panel"
            tabIndex={filter === status ? 0 : -1}
            onClick={() => {
              activeFilter.current = status;
              setLoading(true);
              setError("");
              setFilter(status);
            }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? FILTERS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + FILTERS.length) % FILTERS.length;
              const next = FILTERS[nextIndex];
              activeFilter.current = next;
              setLoading(true);
              setError("");
              setFilter(next);
              window.requestAnimationFrame(() => document.getElementById(`evidence-tab-${next}`)?.focus());
            }}
              className="min-h-[44px] rounded-md border px-3 text-sm font-medium data-[selected=true]:border-[var(--accent)] data-[selected=true]:text-[var(--accent)]"
            data-selected={filter === status}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="mt-4 flex items-center gap-2 border-l-4 border-[var(--err-ink)] bg-[var(--err-bg)] p-3 text-sm text-[var(--err-ink)]"
          role="alert"
        >
          <CircleAlert size={18} />
          {error}
        </div>
      )}
      {notice && (
        <div
          className="mt-4 flex items-center gap-2 border-l-4 border-[var(--ok-ink)] bg-[var(--ok-bg)] p-3 text-sm text-[var(--ok-ink)]"
          role="status"
        >
          <Check size={18} />
          {notice}
        </div>
      )}

      <div className="mt-4 grid min-h-[520px] border border-[var(--border)] bg-[var(--surface)] lg:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
        <section
          id="evidence-queue-panel"
          role="tabpanel"
          aria-labelledby={`evidence-tab-${filter}`}
          className="border-b border-[var(--border)] lg:border-b-0 lg:border-r"
          aria-label="证据队列"
        >
          <div className="grid grid-cols-[1fr_auto] border-b border-[var(--border)] px-4 py-3 text-[11px] font-semibold text-[var(--text-3)]">
            <span>学生与提交内容</span>
            <span>状态</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-[var(--text-3)]">
              <LoaderCircle className="animate-spin" size={18} />
              等待服务器返回证据
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-3)]">
              当前筛选下没有证据
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id);
                  setReason("");
                }}
                data-active={selectedId === item.id}
                className="grid min-h-[82px] w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left hover:bg-[var(--rg-control-bg)] data-[active=true]:bg-[var(--info-bg)]"
              >
                <span className="min-w-0">
                  <b className="block text-sm text-[var(--text-1)]">
                    {item.studentName}
                  </b>
                  <small className="mt-1 block truncate text-xs text-[var(--text-3)]">
                    {item.submission?.content ??
                      item.submission?.choice ??
                      item.missionId}
                  </small>
                </span>
                <span className="rounded-full bg-[var(--warn-bg)] px-2 py-1 text-xs text-[var(--warn-ink)]">
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </button>
            ))
          )}
        </section>

        <section className="p-5" aria-label="证据审核详情">
          {!selected ? (
            <div className="grid h-full place-items-center text-sm text-[var(--text-3)]">
              从左侧选择一份证据
            </div>
          ) : (
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
                <Clock3 size={16} />
                {new Date(selected.createdAt).toLocaleString("zh-CN", {
                  hour12: false,
                })}
                <span>版本 {selected.revision}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-[var(--text-1)]">
                {selected.studentName} · {selected.missionId}
              </h2>
              <div className="mt-4 border-l-4 border-[var(--accent)] bg-[var(--rg-control-bg)] p-4 text-sm leading-7 text-[var(--text-1)]">
                {selected.submission?.content ??
                  selected.submission?.choice ??
                  "没有可展示的提交正文"}
              </div>
              <label
                className="mt-5 block text-sm font-semibold text-[var(--text-2)]"
                htmlFor="review-reason"
              >
                审核依据
              </label>
              <textarea
                id="review-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                className="mt-2 min-h-32 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-1)] outline-none focus:border-[var(--accent)]"
                placeholder="说明证据与目标的对应关系，或给出可执行的订正建议"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={reason.trim().length < 4 || saving}
                  onClick={() => void decide("accepted_mastery")}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <ShieldCheck size={18} />
                  确认掌握
                </button>
                <button
                  type="button"
                  disabled={reason.trim().length < 4 || saving}
                  onClick={() => void decide("revise")}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text-2)] disabled:opacity-50"
                >
                  <Undo2 size={18} />
                  退回订正
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
