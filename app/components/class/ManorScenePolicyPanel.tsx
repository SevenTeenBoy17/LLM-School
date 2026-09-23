"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Sprout } from "lucide-react";
type Policy = { ownerId: string; classId: string; unlockedCount: number; revision: number };
export function ManorScenePolicyPanel() {
  const [policy, setPolicy] = useState<Policy | null>(null), [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{ operationId: string; classId: string; expectedRevision: number; unlockedCount: number } | null>(null);
  const load = useCallback(async (preserveInput = false, signal?: AbortSignal) => {
    const response = await fetch("/api/v2/teacher/manor/scene-policy", { cache: "no-store", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok) throw new Error("班级开放区域暂时无法读取。");
    signal?.throwIfAborted();
    setPolicy(body.policy); if (!preserveInput) setCount(body.policy.unlockedCount);
    return body.policy as Policy;
  }, []);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(false, controller.signal).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); }); }); return () => controller.abort(); }, [load]);
  async function save() {
    if (!policy || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const current = await load(true);
      if (current.classId !== policy.classId || current.ownerId !== policy.ownerId) { setPending(null); throw new Error("当前账号或班级已变更，请重新确认。"); }
      const input = pending ?? { operationId: `scene-policy-${crypto.randomUUID()}`, classId: policy.classId, expectedRevision: policy.revision, unlockedCount: count };
      setCount(input.unlockedCount);
      setPending(input);
      const response = await fetch("/api/v2/teacher/manor/scene-policy", { method: "POST", headers: { "content-type": "application/json", "x-manor-owner": policy.ownerId }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (!response.ok) { if (response.status < 500 && ![408, 429].includes(response.status)) setPending(null); throw new Error("发布未确认。请刷新后核对；重试会保留原操作编号。"); }
      setPending(null); setPolicy(body.policy); setCount(body.policy.unlockedCount); setNotice(`已为本班开放 ${body.policy.unlockedCount} 块农田。`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "发布失败。"); }
    finally { setBusy(false); }
  }
  return <section className="my-5 border-y border-[var(--border)] py-4" aria-label="班级农田开放区域">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Sprout size={19} />班级开放区域</h2>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label>开放地块 <input className="ml-2 min-h-11 w-20 rounded border px-2" type="number" min={policy?.unlockedCount ?? 10} max={24} value={count} disabled={!policy || busy || Boolean(pending)} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <button className="inline-flex min-h-11 items-center gap-2 rounded border px-3" disabled={!policy || busy || (!pending && (count < (policy?.unlockedCount ?? 10) || count > 24 || !Number.isInteger(count)))} onClick={() => void save()}><Check size={18} />{pending ? "重试原发布" : "确认开放"}</button>
      <button title="刷新开放区域" aria-label="刷新开放区域" className="min-h-11 min-w-11 rounded border p-2" disabled={busy} onClick={() => void load(Boolean(pending)).then(() => setError("")).catch((failure) => setError(failure.message))}><RefreshCw size={18} /></button>
    </div>
    <p className="mt-2 text-sm text-[var(--text-3)]">已开放区域不回收，不与积分或连续登录挂钩。</p>
    {error && <p role="alert" className="mt-2 text-sm text-[var(--err-ink)]">{error}</p>}
    {notice && <p role="status" className="mt-2 text-sm text-[var(--ok-ink)]">{notice}</p>}
  </section>;
}
