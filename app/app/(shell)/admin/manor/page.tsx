"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { AdminTabs } from "@/components/admin/AdminTabs";

type ChainSummary = {
  correlationId: string;
  studentId: string;
  studentName: string;
  classId: string;
  eventCount: number;
  lastAt: number;
  latestEvent: string;
};
type AuditChain = {
  correlationId: string;
  subject: { id: string; name: string; classId: string };
  events: Array<{
    eventId: string;
    sequence: number;
    eventType: string;
    entityType: string;
    entityId: string;
    createdAt: number;
    payload: unknown;
  }>;
  integrity: { complete: boolean; checks: Array<{ id: string; label: string; passed: boolean }> };
  operations: Array<unknown>;
  evidence: Array<unknown>;
  grants: Array<unknown>;
  consumptions: Array<unknown>;
  decisions: Array<unknown>;
  artifacts: Array<unknown>;
};

export default function ManorAuditPage() {
  const [items, setItems] = useState<ChainSummary[]>([]);
  const [query, setQuery] = useState("");
  const [chain, setChain] = useState<AuditChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadRecent = useCallback(async () => {
    try {
      const response = await fetch("/api/v2/admin/manor/audit", {
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "审计索引读取失败。");
      setItems(body.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "审计索引读取失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadRecent();
    });
    return () => {
      active = false;
    };
  }, [loadRecent]);

  const openChain = async (correlationId: string) => {
    if (!correlationId.trim() || detailLoading) return;
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v2/admin/manor/audit/${encodeURIComponent(correlationId.trim())}`,
        { cache: "no-store" },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "因果链读取失败。");
      setChain(body);
      setQuery(body.correlationId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "因果链读取失败。");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <main className="space-y-5 p-4 md:p-6" data-testid="admin-manor-audit">
      <AdminTabs />
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="text-[11px] font-semibold text-[var(--accent)]">
            不可变领域事件
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--text-1)]">
            庄园因果审计
          </h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            按关联编号重建证据、授权、消费与审核决定。
          </p>
        </div>
        <div className="flex w-full max-w-xl gap-2">
          <label className="sr-only" htmlFor="correlation-search">
            关联编号
          </label>
          <input
            id="correlation-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-[44px] min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
            placeholder="corr_..."
          />
          <button
            type="button"
            onClick={() => void openChain(query)}
            disabled={detailLoading || !query.trim()}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Search size={17} />
            查询
          </button>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 border-l-4 border-[var(--err-ink)] bg-[var(--err-bg)] p-3 text-sm text-[var(--err-ink)]"
        >
          <CircleAlert size={18} />
          {error}
        </div>
      )}
      <div className="grid min-h-[540px] border border-[var(--border)] bg-[var(--surface)] xl:grid-cols-[420px_1fr]">
        <section
          className="border-b border-[var(--border)] xl:border-b-0 xl:border-r"
          aria-label="最近因果链"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <b className="text-sm text-[var(--text-1)]">最近事件链</b>
            <span className="text-[11px] text-[var(--text-3)]">
              {items.length} 条
            </span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-[var(--text-3)]">
              <LoaderCircle className="animate-spin" size={18} />
              读取审计索引
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-3)]">
              还没有庄园领域事件
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.correlationId}
                type="button"
                onClick={() => void openChain(item.correlationId)}
                className="grid min-h-[86px] w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left hover:bg-[var(--rg-control-bg)]"
              >
                <span className="min-w-0">
                  <b className="block text-sm text-[var(--text-1)]">
                    {item.studentName || item.studentId}
                  </b>
                  <small className="mt-1 block truncate text-xs text-[var(--text-3)]">
                    {item.latestEvent} · {item.correlationId}
                  </small>
                </span>
                <span className="rounded-full bg-[var(--info-bg)] px-2 py-1 text-xs text-[var(--info-ink)]">
                  {item.eventCount} 事件
                </span>
              </button>
            ))
          )}
        </section>
        <section className="p-5" aria-label="因果链详情">
          {detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
              <LoaderCircle className="animate-spin" size={18} />
              等待全部事件返回
            </div>
          ) : !chain ? (
            <div className="grid h-full place-items-center text-center text-sm text-[var(--text-3)]">
              <span>
                <Activity className="mx-auto mb-3" size={28} />
                选择一条事件链查看完整因果关系
              </span>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-xs text-[var(--text-3)]">
                    {chain.correlationId}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--text-1)]">
                    {chain.subject.name} · {chain.subject.classId}
                  </h2>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${chain.integrity.complete ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--err-bg)] text-[var(--err-ink)]"}`}>
                  {chain.integrity.complete ? <ShieldCheck size={15} /> : <CircleAlert size={15} />}
                  {chain.integrity.complete ? "校验通过" : "链路不完整"}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="因果链完整性校验">
                {chain.integrity.checks.map((check) => (
                  <div key={check.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${check.passed ? "border-[var(--border)] text-[var(--text-2)]" : "border-[var(--err-ink)] text-[var(--err-ink)]"}`}>
                    {check.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                    {check.label}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--text-3)]">
                {chain.events.length} 事件 · {chain.operations.length} 幂等操作 · {chain.grants.length} 授权 · {chain.consumptions.length} 消费 · {chain.artifacts.length} 作品 · {chain.decisions.length} 审核决定
              </p>
              <ol className="mt-5 space-y-0">
                {chain.events.map((event, index) => (
                  <li
                    key={event.eventId}
                    className="grid grid-cols-[30px_1fr] gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--info-bg)] text-[var(--info-ink)]">
                        {index === chain.events.length - 1 ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {index < chain.events.length - 1 && (
                        <span className="min-h-[48px] w-px flex-1 bg-[var(--border)]" />
                      )}
                    </div>
                    <div className="pb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-sm text-[var(--text-1)]">
                          {event.eventType}
                        </b>
                        <span className="text-xs text-[var(--text-3)]">
                          序号 {event.sequence}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-3)]">
                        <Clock3 className="mr-1 inline" size={13} />
                        {new Date(event.createdAt).toLocaleString("zh-CN", {
                          hour12: false,
                        })}{" "}
                        · {event.entityType}/{event.entityId}
                      </p>
                      <pre className="mt-2 max-w-full overflow-auto rounded-md bg-[var(--rg-control-bg)] p-3 text-xs leading-5 text-[var(--text-2)]">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
