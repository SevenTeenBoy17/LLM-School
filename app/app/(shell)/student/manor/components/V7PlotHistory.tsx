"use client";
import { useState } from "react";
import { BookOpen, History, RefreshCw } from "lucide-react";
import type { ManorPlantingCycle } from "@/lib/manor/v7-learning-contracts";
import { MANOR_CROPS } from "@/lib/gamify";
const actionNames: Record<string, string> = { plant: "播种", plant_and_nurture: "播种并照料", nurture: "照料", harvest: "收获", clear: "清理" };
export function V7PlotHistory({ plotId }: { plotId: number }) {
  const [cycles, setCycles] = useState<ManorPlantingCycle[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  async function load(more = false) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/v2/manor/plots/${plotId}/history${more && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store", signal: AbortSignal.timeout(15000) }); const body = await response.json(); if (!response.ok) throw new Error("成长来源暂时无法读取，请重试。"); setCycles((current) => more ? [...(current ?? []), ...body.cycles] : body.cycles); setCursor(body.nextCursor); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "读取失败。"); }
    finally { setBusy(false); }
  }
  return <section style={{ marginTop: 20, borderTop: "1px solid #cad6b7", paddingTop: 16 }} aria-label="完整成长来源">
    <button onClick={() => void load()} disabled={busy}>{cycles ? <RefreshCw size={18} /> : <History size={18} />}{busy ? "读取成长记录" : cycles ? "刷新成长记录" : "查看完整成长记录"}</button>
    {error && <p role="alert">{error}</p>}
    {cycles?.length === 0 && <p>尚未记录种植周期；历史数据不会被补造为学习证据。</p>}
    {cycles?.map((cycle) => <details key={cycle.id} style={{ borderBottom: "1px solid #dae0ce", padding: "12px 0" }} open={cycles.length === 1}><summary>{MANOR_CROPS.find((item) => item.id === cycle.cropId)?.name ?? cycle.cropId} · {({ active: "生长中", harvested: "已收获", cleared: "已清理" })[cycle.status]} · {new Date(cycle.startedAt).toLocaleDateString("zh-CN")}</summary>
      {!cycle.historyComplete && <p>此周期承接旧记录，早期来源未完整关联，以下仅展示可核对部分。</p>}
      <ol>{cycle.actions.map((action) => <li key={action.id}><strong>{actionNames[action.action] ?? action.action}</strong> · 阶段 {action.fromStage} → {action.toStage}<p>{new Date(action.createdAt).toLocaleString("zh-CN")} · 消耗 {action.allocations.reduce((sum, item) => sum + item.amount, 0)} 点</p>{action.allocations.map((allocation) => <p key={allocation.id}><a href={`/student/manor?missionId=${encodeURIComponent(allocation.missionId)}&evidenceId=${encodeURIComponent(allocation.evidenceId)}`}><BookOpen size={16} />学习来源 · {allocation.amount} 点</a><small style={{ display: "block", overflowWrap: "anywhere" }}>授权 {allocation.grantId} · 资源 {allocation.resourceVersion ?? "旧记录未标注"}</small></p>)}</li>)}</ol>
    </details>)}
    {cursor && <button onClick={() => void load(true)} disabled={busy}>加载更早的种植周期</button>}
  </section>;
}
