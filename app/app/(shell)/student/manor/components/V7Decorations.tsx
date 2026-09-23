"use client";

import { useState } from "react";
import { Check, Coins, Move, PackageOpen, RefreshCw, Search, Undo2 } from "lucide-react";
import { MANOR_LAYOUT_SLOTS, type ManorSceneSnapshot, type ManorLayoutSlot } from "@/lib/manor/v7-scene-contracts";
import { commandManorScene, hasPendingManorScene, readManorScene } from "@/lib/client/manorSceneApi";
import styles from "./v7-decorations.module.css";

const SPRITE_RECTS: Record<string, readonly [number, number, number, number]> = {
  flower: [20, 60, 385, 310], bush: [455, 50, 350, 330], path: [850, 100, 390, 270],
  tree: [65, 395, 320, 398], bench: [455, 455, 350, 335], pond: [850, 495, 390, 295],
  house: [20, 812, 424, 415], tower: [455, 792, 325, 440], library: [810, 819, 436, 414],
};
export function DecorationSprite({ partId }: { partId: string }) {
  const rect = SPRITE_RECTS[partId];
  if (!rect) return <span aria-hidden="true" className={styles.sprite}><PackageOpen /></span>;
  const [x, y, width, height] = rect;
  // Actual painted gutters differ by row; keep the outer tile stable while cropping.
  return <span aria-hidden="true" className={styles.sprite}><span style={{ width: `${width / Math.max(width, height) * 100}%`, height: `${height / Math.max(width, height) * 100}%`, backgroundSize: `${1254 / width * 100}% ${1254 / height * 100}%`, backgroundPosition: `${x / (1254 - width) * 100}% ${y / (1254 - height) * 100}%` }} /></span>;
}
export function SceneDecorations({ scene, onOpen }: { scene?: ManorSceneSnapshot; onOpen: () => void }) {
  return <div className={styles.placed} aria-label="已布置的装饰">{scene?.inventory.filter((item) => item.slotId).map((item) => {
    const slot = MANOR_LAYOUT_SLOTS.find((slot) => slot.id === item.slotId);
    return slot && <button key={item.id} aria-label={`${item.name}，${slot.label}，调整布置`} title={`${item.name} · ${slot.label}`} onClick={onOpen} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}><DecorationSprite partId={item.partId} /></button>;
  })}</div>;
}
export function PublicDecorationView({ items }: { items: Array<{ partId: string; slotId: string }> }) {
  return <div className={styles.preview} aria-label="公开装饰布局">{items.map((item) => {
    const at = MANOR_LAYOUT_SLOTS.find((position) => position.id === item.slotId);
    return at && <span key={item.slotId} style={{ left: `${at.x}%`, top: `${at.y}%` }}><DecorationSprite partId={item.partId} /></span>;
  })}</div>;
}
export function DecorationWarehouse({ userId, scene, onChange, quiet }: { userId: string; scene: ManorSceneSnapshot; onChange: (scene: ManorSceneSnapshot) => void; quiet: boolean }) {
  const [tab, setTab] = useState<"owned" | "catalog">("owned");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [slotId, setSlotId] = useState<ManorLayoutSlot | null>(null);
  const [purchaseId, setPurchaseId] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const selected = scene.inventory.find((item) => item.id === selectedId);
  const groups = scene.catalog.map((part) => ({ ...part, items: scene.inventory.filter((item) => item.partId === part.id) })).filter((part) => part.items.length && part.name.includes(search));
  const perform = async (action: Parameters<typeof commandManorScene>[1]) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await commandManorScene(userId, action);
      onChange(result.scene); setNotice("已保存到庄园。"); setSelectedId(""); setPurchaseId("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "暂时无法保存。"); }
    finally { setBusy(false); }
  };
  return <section className={styles.warehouse} aria-label="装扮仓库">
    <div className={styles.toolbar}><div className={styles.tabs}><button aria-pressed={tab === "owned"} onClick={() => setTab("owned")}><PackageOpen size={18} />我的收藏</button><button aria-pressed={tab === "catalog"} onClick={() => setTab("catalog")}><Coins size={18} />装扮集市</button></div><span>积分 {scene.balance}</span></div>
    <label className={styles.search}><Search size={18} /><input aria-label="搜索装扮" placeholder="搜索名称" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    {hasPendingManorScene(userId) && <button disabled={busy} onClick={() => void perform(undefined)}><RefreshCw size={18} />恢复待确认操作</button>}
    <button className={styles.refresh} title="刷新装扮库存" aria-label="刷新装扮库存" disabled={busy} onClick={async () => { setBusy(true); try { onChange(await readManorScene(userId)); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "刷新失败。"); } finally { setBusy(false); } }}><RefreshCw size={18} /></button>
    {tab === "owned" && <>
      {!groups.length && <p>{search ? "没有符合搜索条件的收藏。" : "还没有装饰收藏。"}</p>}
      <div className={styles.grid}>{groups.map((group) => <article key={group.id}><DecorationSprite partId={group.id} /><h3>{group.name}</h3><p>共 {group.items.length} 件 · 已布置 {group.items.filter((item) => item.slotId).length} 件</p><div>{group.items.map((item, index) => <button key={item.id} disabled={busy || quiet} onClick={() => { setSelectedId(item.id); setSlotId(item.slotId); setError(""); }}><Move size={16} />{item.slotId ? "调整" : "布置"}{group.items.length > 1 ? `第 ${index + 1} 件` : ""}</button>)}</div></article>)}</div>
    </>}
    {tab === "catalog" && <>
      <p>只使用已获得的积分，学习任务、作品和复习免费。</p>
      <div className={styles.grid}>{scene.catalog.filter((item) => item.name.includes(search)).map((item) => <article key={item.id}><DecorationSprite partId={item.id} /><h3>{item.name}</h3><p><Coins size={16} />{item.price} 积分</p><button disabled={quiet || busy || !item.eligible || scene.balance < item.price} onClick={() => setPurchaseId(item.id)}>{!item.eligible ? `需 ${item.badgeGate} 枚徽章` : scene.balance < item.price ? "积分不足" : "兑换"}</button></article>)}</div>
      {!scene.catalog.some((item) => item.name.includes(search)) && <p>没有符合搜索条件的装饰。</p>}
      {purchaseId && <div className={styles.confirm}><p>兑换「{scene.catalog.find((item) => item.id === purchaseId)?.name}」，扣除 {scene.catalog.find((item) => item.id === purchaseId)?.price} 积分后收入仓库？</p><button disabled={busy || quiet} onClick={() => void perform({ action: "purchase", partId: purchaseId })}><Check size={18} />确认兑换</button><button disabled={busy} onClick={() => setPurchaseId("")}>取消</button></div>}
    </>}
    {selected && <section className={styles.editor} aria-label="装饰布置预览">
      <h3>{selected.name} · 布置预览</h3>
      <div className={styles.preview}>{scene.inventory.filter((item) => item.slotId && item.id !== selected.id).map((item) => { const at = MANOR_LAYOUT_SLOTS.find((position) => position.id === item.slotId)!; return <span key={item.id} style={{ left: `${at.x}%`, top: `${at.y}%` }}><DecorationSprite partId={item.partId} /></span>; })}{slotId && (() => { const at = MANOR_LAYOUT_SLOTS.find((position) => position.id === slotId)!; return <span data-preview="true" style={{ left: `${at.x}%`, top: `${at.y}%` }}><DecorationSprite partId={selected.partId} /></span>; })()}</div>
      <fieldset className={styles.positions}><legend>摆放位置</legend>{MANOR_LAYOUT_SLOTS.map((position) => { const occupied = scene.inventory.some((item) => item.id !== selected.id && item.slotId === position.id); return <label key={position.id}><input type="radio" name="decoration-slot" value={position.id} checked={slotId === position.id} disabled={occupied || busy} onChange={() => setSlotId(position.id)} />{position.label}{occupied ? " · 已占用" : ""}</label>; })}</fieldset>
      <div className={styles.actions}><button disabled={busy || quiet || !slotId} onClick={() => void perform({ action: "layout", itemId: selected.id, slotId, expectedRevision: scene.layoutRevision })}><Check size={18} />确认布置</button>{selected.slotId && <button disabled={busy || quiet} onClick={() => void perform({ action: "layout", itemId: selected.id, slotId: null, expectedRevision: scene.layoutRevision })}><PackageOpen size={18} />收回仓库</button>}<button disabled={busy} onClick={() => setSelectedId("")}><Undo2 size={18} />取消预览</button></div>
    </section>}
    {busy && <p role="status">正在等待服务器确认</p>}
    {quiet && <p>舒缓模式中可查看收藏，已保存的布置不受影响。</p>}
  </section>;
}
