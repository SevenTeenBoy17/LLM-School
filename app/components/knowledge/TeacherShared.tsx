"use client";

/**
 * TeacherShared —— 学生端「老师分享的资料」（产物工作区 V2 的学生侧呈现面）。
 *
 * 只对学生渲染：教研侧在 /research/artifacts 管理自己的产物，学生在知识库页
 * 看到本班老师**显式发布**的产物。数据边界全部在服务端：
 * /api/artifacts 对学生返回 visibility='class' 且 classId=会话班级 的行，
 * 本组件不传也不能传任何班级参数。
 *
 * 空态不渲染整个区块：学生知识库的主体是校内资料检索，
 * 老师没发布过东西时不该多出一个空盒子占位（诚实空态的「零态」形式）。
 */
import { useEffect, useState } from "react";
import { BookOpenCheck, ChevronDown } from "lucide-react";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import type { ArtifactItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function TeacherShared() {
  const role = useSessionRole();
  const [items, setItems] = useState<ArtifactItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "student") return;
    let alive = true;
    fetch("/api/artifacts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { artifacts: [] }))
      .then((j) => { if (alive && j.scope === "class") setItems(j.artifacts ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [role]);

  if (role !== "student" || items.length === 0) return null;

  return (
    <section aria-labelledby="teacher-shared-heading" className="mb-5 rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4 md:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--accent-tint)] text-[var(--c-edu)]">
          <BookOpenCheck size={18} />
        </span>
        <div>
          <h2 id="teacher-shared-heading" className="text-[15px] font-semibold text-[var(--text)]">老师分享的资料</h2>
          <p className="text-[12px] text-[var(--text-2)]">你的任课老师发布给本班的备课产物，点开即读。</p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((a) => (
          <li key={a.id} className="rounded-[12px] border border-[var(--border-2)]">
            <button
              type="button"
              onClick={() => setOpen((cur) => (cur === a.id ? null : a.id))}
              aria-expanded={open === a.id}
              className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--text)]" title={a.title}>{a.title}</span>
              <span className="shrink-0 text-[11px] text-[var(--text-3)]">{fmtTime(a.createdAt)}</span>
              <ChevronDown size={14} className={cn("shrink-0 text-[var(--text-3)] transition-transform", open === a.id && "rotate-180")} aria-hidden />
            </button>
            {open === a.id && (
              <div className="border-t border-[var(--border-2)] px-3 py-3">
                {/* 纯文本呈现（whitespace-pre-wrap）：产物是对话原文，不重排不改写——
                    与门户证据条同一条诚实原则。 */}
                <div className="max-h-[320px] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-2)]">
                  {a.content}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
