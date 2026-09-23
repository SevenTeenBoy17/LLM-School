"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Sprout } from "lucide-react";
import type { ManorAssignment } from "@/lib/manor/v7-learning-contracts";

type Tasks = { assignments: ManorAssignment[]; missions: Array<{ id: string; title: string; subject: string }> };
export function ManorAssignedTasks() {
  const [data, setData] = useState<Tasks | null>(null);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v2/manor/assignments", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(response.status === 401 ? "登录已失效，请重新登录。" : "庄园任务暂未同步。"); return response.json() as Promise<Tasks>; })
      .then((result) => { if (!controller.signal.aborted) { setData(result); setError(""); } })
      .catch(() => { if (!controller.signal.aborted) setError("庄园任务暂未同步，请检查登录状态或稍后重试。"); });
    return () => controller.abort();
  }, [requestKey]);
  return <section aria-label="老师分派的庄园任务" className="my-6 border-y border-[var(--border-2)] py-5">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Sprout size={20} />庄园学习项目</h2>
    {error ? <div role="alert" className="mt-3 flex items-center gap-3"><span>{error}</span><button className="inline-flex min-h-11 items-center gap-2" onClick={() => setRequestKey((value) => value + 1)}><RefreshCw size={17} />重试</button></div>
      : !data ? <p role="status" className="mt-3 text-sm text-[var(--text-2)]">正在读取老师分派的任务</p>
        : !data.assignments.length ? <p className="mt-3 text-sm text-[var(--text-2)]">老师暂未分派庄园项目。<Link href="/student/manor" className="ml-2 inline-flex min-h-11 items-center gap-1 text-[var(--accent)]">查看我的庄园<ArrowRight size={16} /></Link></p>
          : <ul className="mt-3 divide-y divide-[var(--border-2)]">{data.assignments.map((assignment) => <li key={assignment.id} className="py-3">
            <h3 className="font-medium">{assignment.title}</h3><p className="mt-1 break-all text-xs text-[var(--text-2)]">发布版本 {assignment.assignmentVersion} · 资源 {assignment.resourceVersion}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{assignment.missionIds.map((id) => { const mission = data.missions.find((item) => item.id === id); return <Link key={id} href={`/student/manor?missionId=${encodeURIComponent(id)}&assignmentId=${encodeURIComponent(assignment.id)}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--accent)]">{mission?.title ?? "继续学习"}<ArrowRight size={16} /></Link>; })}</div>
          </li>)}</ul>}
  </section>;
}
