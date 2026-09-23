"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardTodo } from "@/lib/data/dashboardSnapshot";

interface TodoListProps {
  todos: DashboardTodo[];
}

export function TodoList({ todos }: TodoListProps) {
  return (
    <div className="space-y-2">
      {todos.map((t) => {
        const isDone = t.status === "done";
        const disconnected = t.status === "not_connected";
        return (
          <Link
            key={t.id}
            href={t.href}
            data-status={t.status}
            className={cn(
              "flex min-h-[58px] items-start gap-3 rounded-[12px] border border-[var(--border-2)] p-2.5 transition hover:bg-[var(--rg-hover-bg)]",
              isDone && "opacity-70",
              disconnected && "cursor-default",
            )}
            aria-disabled={disconnected}
            onClick={(event) => {
              if (disconnected) event.preventDefault();
            }}
          >
            <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
              t.urgent && !isDone ? "bg-[var(--err-bg)] text-[var(--err-ink)]" : "bg-[var(--rg-selected-bg)] text-[var(--c-primary)]"
            }`}>
              {isDone ? <CheckCircle size={13} /> : t.urgent ? <AlertTriangle size={13} /> : <Clock size={13} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn("text-[13px] font-semibold text-[var(--text)]", isDone && "line-through text-[var(--text-3)]")}>{t.title}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--text-2)]">
                <span>{t.source}</span>
                <span>·</span>
                <span className={t.urgent && !isDone ? "text-[var(--c-alert)]" : ""}>{t.due}</span>
              </div>
            </div>
            {!disconnected && <ArrowRight size={14} className="mt-1 shrink-0 text-[var(--text-3)]" />}
          </Link>
        );
      })}
    </div>
  );
}
