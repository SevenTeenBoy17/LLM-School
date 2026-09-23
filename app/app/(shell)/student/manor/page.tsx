"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChevronRight, Coins, Droplets, Hand, HeartPulse, HelpCircle, LayoutGrid, Leaf, List, LoaderCircle, LockKeyhole, NotebookPen, PackageOpen, RefreshCw, Search, Shovel, Sparkles, Sprout, Users, X } from "lucide-react";
import { MANOR_CROPS } from "@/lib/gamify";
import { DecorationWarehouse, SceneDecorations, PublicDecorationView } from "./components/V7Decorations";
import { V7PlotHistory } from "./components/V7PlotHistory";
import { commandManorScene, hasPendingManorScene } from "@/lib/client/manorSceneApi";
import type { ManorSceneSnapshot } from "@/lib/manor/v7-scene-contracts";
import { LearningHub, type LearningPanel } from "./components/LearningHub";
import { allocateManorGrants, createManorLearningRepository, ManorApiError, portfolioFromArtifact, type ManorBootstrap } from "./model/manor-learning";
import styles from "./scene-v6.module.css";

type Plot = ManorBootstrap["plots"][number];
type Tool = "inspect" | "water" | "harvest" | "clear";
type FarmDialog = { kind: "plot"; id: number } | { kind: "warehouse" | "neighbors" | "help" | "resources" };
type Visit = { name: string; plots: Array<{ plot: number; cropId: string | null; stage: number }>; decorations: Array<{ partId: string; slotId: string }> };
const subscribe = () => () => undefined;
const subscribeViewport = (onChange: () => void) => {
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const STAGES = ["种子期", "萌芽期", "生长期", "成熟期"];
const CROP_ORDER = ["wheat", "tomato", "bean", "rice", "sunflower", "bamboo"];
const TOOLS = [{ id: "inspect", label: "查看 / 播种", Icon: Hand }, { id: "water", label: "照料 · 8 点", Icon: Droplets }, { id: "harvest", label: "收获", Icon: PackageOpen }, { id: "clear", label: "清理", Icon: Shovel }] as const;
const PANELS = [{ id: "mission", label: "今日任务", Icon: NotebookPen }, { id: "greenhouse", label: "记忆温室", Icon: Leaf }, { id: "workshop", label: "创作工坊", Icon: BookOpen }, { id: "wellbeing", label: "健康节奏", Icon: HeartPulse }] as const;

function CropSprite({ crop, stage = 3 }: { crop: string; stage?: number }) {
  const column = CROP_ORDER.indexOf(crop);
  if (column < 0) return <Sprout aria-hidden="true" />;
  // The generated atlas has unequal row gutters, verified against its actual pixels.
  const rows = [[0, 207], [207, 194], [401, 267], [668, 356]];
  const [top, height] = rows[Math.max(0, Math.min(3, stage))];
  return <span aria-hidden="true" className={styles.cropSprite} style={{ backgroundSize: `600% ${1024 / height * 100}%`, backgroundPosition: `${column * 20}% ${top / (1024 - height) * 100}%` }} />;
}

export default function ManorPage() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const compact = useSyncExternalStore(subscribeViewport, () => window.matchMedia("(max-width: 760px)").matches, () => false);
  const repository = useMemo(() => createManorLearningRepository(), []);
  const [data, setData] = useState<ManorBootstrap>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const sequence = useRef(0);
  const [tool, setTool] = useState<Tool>("inspect");
  const [panel, setPanel] = useState<LearningPanel | null>(null);
  const [dialog, setDialog] = useState<FarmDialog | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [viewOverride, setView] = useState<"scene" | "list">();
  const view = viewOverride ?? (compact ? "list" : "scene");
  const [warehouseTab, setWarehouseTab] = useState("harvests");
  const [search, setSearch] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const focusRef = useRef<HTMLElement | null>(null);
  const restoredLink = useRef(false);
  const quiet = Boolean(data?.profile.quietUntil && data.profile.quietUntil > now);
  const plot = dialog?.kind === "plot" ? data?.plots.find((item) => item.id === dialog.id) : undefined;
  const crop = MANOR_CROPS.find((item) => item.id === plot?.cropId);
  const evidence = data?.evidence.find((item) => item.id === plot?.evidenceId);
  const mission = data?.missions.find((item) => item.id === evidence?.missionId);
  const plotEnergy = (data?.grants ?? []).filter((grant) => ["available", "partially_consumed"].includes(grant.status) && grant.allowedPurposes.some((purpose) => ["plot", "support_plot"].includes(purpose))).reduce((sum, grant) => sum + grant.remainingUnits, 0);
  const portfolio = useMemo(() => data?.artifacts.map((item) => portfolioFromArtifact(item, data.evidence, data.missions)) ?? [], [data]);

  const reload = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await repository.bootstrap();
      if (request === sequence.current) {
        setData(result); setLoading(false); setError("");
        if (!restoredLink.current) {
          restoredLink.current = true;
          const artifactId = new URLSearchParams(window.location.search).get("artifactId");
          if (artifactId) {
            setPanel("portfolio");
            if (!result.artifacts.some((item) => item.id === artifactId)) setNotice("该成果不存在，或当前账号无权查看。");
          } else if (new URLSearchParams(window.location.search).has("missionId")) setPanel("mission");
        }
      }
    } catch (failure) {
      if (request === sequence.current) { setError(failure instanceof Error ? failure.message : "庄园暂时无法读取。"); setLoading(false); }
      throw failure;
    }
  }, [repository]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstFrame = window.requestAnimationFrame(() => { void reload().catch(() => undefined); });
    let previousDay = Math.floor((Date.now() + 8 * 3600000) / 86400000);
    const timer = window.setInterval(() => {
      const time = Date.now(); setNow(time);
      const day = Math.floor((time + 8 * 3600000) / 86400000);
      if (day !== previousDay) { previousDay = day; void reload().catch(() => undefined); }
    }, 30000);
    const refresh = () => { if (document.visibilityState === "visible") void reload().catch(() => undefined); };
    document.addEventListener("visibilitychange", refresh);
    return () => { cancelAnimationFrame(firstFrame); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); document.body.style.overflow = previous; };
  }, [reload]);

  function rememberFocus() { focusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  const openPanel = (next: LearningPanel) => { rememberFocus(); setDialog(null); setPanel(next); setError(""); };
  const openDialog = (next: FarmDialog) => { rememberFocus(); setClearConfirm(false); setVisit(null); setDialog(next); setError(""); setNotice(""); };
  const closePanel = () => { setPanel(null); requestAnimationFrame(() => focusRef.current?.focus()); };
  const updateScene = (scene: ManorSceneSnapshot) => setData((current) => current ? { ...current, scene, neighbors: scene.neighbors, resources: { ...current.resources, points: scene.balance } } : current);
  async function publishScene(enabled?: boolean) {
    if (!data?.scene || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const result = await commandManorScene(data.subject.id, enabled === undefined ? undefined : { action: "publication", enabled, expectedRevision: data.scene.publication.revision, expectedClassId: data.scene.publication.classId });
      updateScene(result.scene);
      setNotice(result.scene.publication.enabled ? "已向当前同班伙伴公开农田和装饰。" : "已撤回公开，新的参观请求将被拒绝。");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "公开设置未保存。"); }
    finally { lock.current = false; setBusy(false); }
  }

  async function mutatePlot(target: Plot, action: "plant" | "nurture" | "harvest" | "clear", cropId?: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      if (quiet) throw new Error("今日已进入舒缓模式，仍可查看农田与学习成果。");
      const allocations = action === "nurture" ? allocateManorGrants(data?.grants ?? [], ["plot", "support_plot"], 8) : [];
      if (!allocations) throw new Error(`本次照料需要 8 点可用成长能量，当前可用 ${plotEnergy} 点。`);
      const result = await repository.plotAction(target.id, { action, expectedRevision: target.revision, cropId, grantAllocations: allocations });
      setData((current) => current ? { ...current, plots: current.plots.map((item) => item.id === target.id ? result.plot : item), resources: { ...current.resources, growthEnergy: result.growthEnergy } } : current);
      setClearConfirm(false);
      setNotice(action === "harvest" ? "收获已入仓。" : action === "clear" ? "已清理，学习证据仍保留。" : action === "plant" ? "播种已保存。" : "照料已保存，学习来源已关联。" );
      await reload().catch(() => setNotice("操作已保存，总览同步失败，请刷新重试。"));
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "操作未完成。";
      if (failure instanceof ManorApiError && failure.code === "MANOR_REVISION_CONFLICT") await reload().catch(() => undefined);
      setError(message);
    } finally { lock.current = false; setBusy(false); }
  }

  function inspectPlot(target: Plot) {
    openDialog({ kind: "plot", id: target.id });
    if (tool === "clear" && target.cropId) setClearConfirm(true);
    if (!quiet && target.unlocked && target.cropId) {
      if (tool === "water" && target.stage < 3 && plotEnergy >= 8) void mutatePlot(target, "nurture");
      if (tool === "harvest" && target.stage >= 3) void mutatePlot(target, "harvest");
    }
  }

  async function visitNeighbor(neighbor: { id: string; name: string }) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v2/manor/scene?visit=${encodeURIComponent(neighbor.id)}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.plots)) throw new Error("该伙伴已撤回公开或不在当前班级，请刷新名单。");
      setVisit({ name: result.name, plots: result.plots, decorations: result.decorations });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "参观失败。"); }
    finally { setBusy(false); lock.current = false; }
  }

  const nurtureLearningPlot = async (plotId: number, grantId: string) => {
    const target = data?.plots.find((item) => item.id === plotId);
    if (!target || lock.current) throw new Error("地块正忙，请稍后再试。");
    lock.current = true;
    try {
      const result = await repository.plotAction(plotId, { action: target.cropId ? "nurture" : "plant_and_nurture", cropId: target.cropId ? undefined : "wheat", expectedRevision: target.revision, grantId, amount: 8 });
      setData((current) => current ? { ...current, plots: current.plots.map((item) => item.id === plotId ? result.plot : item), resources: { ...current.resources, growthEnergy: result.growthEnergy } } : current);
      await reload().catch(() => setNotice("照料已保存，总览同步失败。"));
    } finally { lock.current = false; }
  };

  if (!mounted) return null;
  return createPortal(<div className={styles.page} data-testid="manor-stage" data-scenario={loading ? "loading" : !data ? "failure" : "normal"}>
    <svg width="0" height="0" aria-hidden="true"><defs><filter id="manor-crop-alpha" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 0 3" /><feComposite operator="in" in2="SourceAlpha" /></filter></defs></svg>
    <div className={styles.shell} data-testid="manor-background" inert={dialog || panel ? true : undefined}>
      <header className={styles.chrome} data-testid="farm-chrome">
        <Link href="/student/home" className={styles.iconButton} aria-label="返回学习中心" title="返回学习中心"><ArrowLeft size={20} /></Link>
        <div className={styles.brand}><Sprout size={29} /><div><strong>个人庄园</strong><small>EduAI 学习农场</small></div></div>
        <nav className={styles.links} aria-label="庄园快捷入口"><button aria-current="page" onClick={() => setView("scene")}>我的农场</button><Link href="/student/growth">成长档案<ArrowUpRight size={14} /></Link><Link href="/student/activities">学习活动<ArrowUpRight size={14} /></Link><Link href="/student/resources">学习资源<ArrowUpRight size={14} /></Link></nav>
        <div className={styles.headerEnd}><button className={styles.iconButton} title="刷新庄园" aria-label="刷新庄园" disabled={busy || loading} onClick={() => void reload().catch(() => undefined)}><RefreshCw size={18} /></button><button className={styles.iconButton} title="庄园规则" aria-label="庄园规则" onClick={() => openDialog({ kind: "help" })}><HelpCircle size={19} /></button><Link href="/profile" className={styles.profile}><span>{data?.subject.name.slice(0, 1) ?? "学"}</span><b>{data?.subject.name ?? "正在读取"}</b></Link><Link href="/student/home" className={styles.iconButton} aria-label="关闭农场" title="关闭农场"><X size={20} /></Link></div>
      </header>
      <main className={styles.scene} data-testid="farm-scene" aria-label="个人庄园农场主场景" data-view={view}>
        <div className={styles.world} aria-hidden={view === "list"} data-testid="manor-scene">
          <div className={styles.environment} aria-hidden="true" />
          <SceneDecorations scene={data?.scene} onOpen={() => { setWarehouseTab("items"); openDialog({ kind: "warehouse" }); }} />
          <nav className={styles.buildings} aria-label="场景建筑">
            <button style={{ left: "20%", top: "32%" }} onClick={() => openPanel("greenhouse")} tabIndex={view === "list" ? -1 : 0} disabled={!data}><Leaf size={18} />记忆温室</button>
            <button style={{ left: "88%", top: "32%" }} onClick={() => openPanel("workshop")} tabIndex={view === "list" ? -1 : 0} disabled={!data}><NotebookPen size={18} />创作工坊</button>
            <button style={{ left: "14%", top: "62%" }} onClick={() => openDialog({ kind: "warehouse" })} tabIndex={view === "list" ? -1 : 0} disabled={!data}><PackageOpen size={18} />仓库与装扮</button>
          </nav>
          <div className={styles.field} role="group" aria-label="24 块农田" data-testid="plot-grid">
            {(data?.plots ?? []).map((item) => {
              const col = item.id % 6, row = Math.floor(item.id / 6);
              const name = MANOR_CROPS.find((entry) => entry.id === item.cropId)?.name ?? item.cropId;
              return <div key={item.id} className={styles.plot} style={{ left: `${(860 + (col - row) * 80) / 16}%`, top: `${(420 + (col + row) * 40) / 9}%`, zIndex: col + row + 1 }} data-unlocked={item.unlocked}>
                <span className={styles.soil} aria-hidden="true" />{item.cropId && <CropSprite crop={item.cropId} stage={item.stage} />}
                {!item.unlocked ? <LockKeyhole className={styles.plotIcon} size={19} /> : !item.cropId ? <Sprout className={styles.plotIcon} size={22} /> : null}
                <span className={styles.plotNumber}>{item.id + 1}</span>{item.cropId && item.stage === 3 && <span className={styles.ready}>可收获</span>}
                <button type="button" className={styles.plotHit} data-plot={item.id} data-crop={item.cropId ?? "empty"} data-stage={item.stage} aria-label={`第 ${item.id + 1} 块${item.unlocked ? item.cropId ? `土地，${name}，${STAGES[item.stage]}` : "空地" : "土地，暂未开放"}`} disabled={busy} tabIndex={view === "list" ? -1 : 0} onClick={() => inspectPlot(item)} />
              </div>;
            })}
          </div>
        </div>
        <section className={styles.player} aria-label="庄园学习状态" data-testid="player-status"><div className={styles.playerTitle}><span className={styles.crest}><Sprout size={32} /></span><div><h1>{data?.subject.name ?? "我的"}的庄园</h1><p>{data?.subject.department || "学习与成长"}</p></div></div><div className={styles.daily}><span>今日学习</span><strong>{data?.daily.completed ? "已完成闭环" : "尚未完成"}</strong></div><button className={styles.resources} onClick={() => openDialog({ kind: "resources" })}><span><Coins size={17} />积分 <b>{data?.resources.points ?? "—"}</b></span><span><Sparkles size={17} />能量 <b>{data?.resources.growthEnergy ?? "—"}</b></span><ChevronRight size={16} /></button></section>
        <nav className={styles.modeDock} aria-label="学习空间" data-testid="mode-dock">{PANELS.map(({ id, label, Icon }) => <button key={id} aria-label={label} onClick={() => openPanel(id)} disabled={!data}><span><Icon size={25} /></span><b>{label}</b>{id === "greenhouse" && Boolean(data?.reviews.filter((review) => review.status !== "completed").length) && <small>{data?.reviews.filter((review) => review.status !== "completed").length}</small>}</button>)}</nav>
        <nav className={styles.rail} aria-label="庄园拓展"><button onClick={() => openPanel("class")} disabled={!data}><Users size={24} /><span>班级共建</span></button><button onClick={() => openPanel("portfolio")} disabled={!data}><BookOpen size={24} /><span>学习成果</span></button><button onClick={() => openDialog({ kind: "warehouse" })} disabled={!data} data-testid="warehouse-button"><PackageOpen size={24} /><span>我的仓库</span></button></nav>
        <div className={styles.viewSwitch} aria-label="农田视图"><button title="场景视图" aria-label="场景视图" aria-pressed={view === "scene"} onClick={() => setView("scene")}><LayoutGrid size={18} /></button><button title="农田清单" aria-label="农田清单" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={19} /></button></div>
        {view === "list" && <section className={styles.plotList} aria-label="农田清单"><header><h2>我的农田</h2><span>{data?.plots.filter((item) => item.unlocked).length ?? 0} 块开放</span></header><div>{data?.plots.map((item) => <button key={item.id} className={styles.plotRow} onClick={() => inspectPlot(item)} disabled={busy}><span className={styles.listCrop}>{item.cropId ? <CropSprite crop={item.cropId} stage={item.stage} /> : item.unlocked ? <Sprout size={24} /> : <LockKeyhole size={22} />}</span><span><b>第 {item.id + 1} 块田</b><small>{!item.unlocked ? "暂未开放" : item.cropId ? `${MANOR_CROPS.find((entry) => entry.id === item.cropId)?.name ?? item.cropId} · ${STAGES[item.stage]}` : "可以播种"}</small></span><ChevronRight size={18} /></button>)}</div></section>}
        <div className={styles.bottomBar}><button className={styles.neighbors} data-testid="friend-dock" onClick={() => openDialog({ kind: "neighbors" })} disabled={!data}><Users size={21} /><span>同班伙伴</span><b>{data?.neighbors.length ?? 0}</b></button><nav className={styles.tools} aria-label="农具">{TOOLS.map(({ id, label, Icon }) => <button key={id} title={label} aria-label={label} aria-pressed={tool === id} onClick={() => setTool(id)}><Icon size={24} /><span>{label}</span></button>)}</nav><button className={styles.finish} onClick={() => openPanel("wellbeing")} disabled={!data}><HeartPulse size={21} />{quiet ? "舒缓模式" : "结束今日学习"}</button></div>
        {!data && <div className={styles.state} role={error ? "alert" : "status"}>{loading ? <LoaderCircle className={styles.spin} size={30} /> : <Leaf size={30} />}<h2>{loading ? "正在读取庄园" : "庄园暂时无法读取"}</h2>{error && <p>{error}</p>}{!loading && <button onClick={() => { setLoading(true); void reload().catch(() => undefined); }}><RefreshCw size={18} />重新请求</button>}</div>}
        {data && (error || notice || quiet) && <div className={styles.notice} role={error ? "alert" : "status"}>{error || notice || "已进入舒缓模式，仍可查看农田和学习成果。"}</div>}
      </main>
    </div>
    {data && <LearningHub bootstrap={data} panel={panel} studentName={data.subject.name} missions={data.missions} grants={data.grants} initialReviews={data.reviews} initialPortfolio={portfolio} profileRevision={data.profile.revision} quietUntil={data.profile.quietUntil} initialClassProgress={data.classBuild ? Math.round(data.classBuild.raised / Math.max(1, data.classBuild.cost) * 100) : 0} growthEnergy={data.resources.growthEnergy} missionProgress={data.daily.completed ? 1 : 0} availablePlotIds={data.plots.filter((item) => item.unlocked && item.stage < 3).map((item) => item.id)} onOpen={openPanel} onClose={closePanel} onRefresh={reload} onNurturePlot={nurtureLearningPlot} onGrowthEnergy={(value) => setData((current) => current ? { ...current, resources: { ...current.resources, growthEnergy: value } } : current)} onProfileRevision={(revision) => setData((current) => current ? { ...current, profile: { ...current.profile, revision } } : current)} onQuietUntil={(quietUntil) => setData((current) => current ? { ...current, profile: { ...current.profile, quietUntil } } : current)} onMissionComplete={() => void reload().catch(() => undefined)} />}
    <Dialog.Root open={Boolean(dialog && data)} onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}><Dialog.Portal><Dialog.Overlay className={styles.backdrop} /><Dialog.Content className={styles.dialog} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }} onCloseAutoFocus={(event) => { event.preventDefault(); focusRef.current?.focus(); }} aria-describedby={undefined}>
      <header><Dialog.Title>{dialog?.kind === "plot" ? `第 ${(plot?.id ?? 0) + 1} 块田` : dialog?.kind === "warehouse" ? "我的仓库" : dialog?.kind === "neighbors" ? "同班伙伴" : dialog?.kind === "resources" ? "我的学习资源" : "庄园规则"}</Dialog.Title><Dialog.Close disabled={busy} title="关闭" aria-label="关闭"><X size={20} /></Dialog.Close></header>
      <div className={styles.dialogBody}>
      {dialog?.kind === "plot" && plot && <>
        {!plot.unlocked ? <div className={styles.empty}><LockKeyhole size={34} /><h3>这块土地暂未开放</h3><p>其余地块暂未开放，不以成长值解锁。</p><button onClick={() => setDialog(null)}>回到已开放农田</button></div> : !plot.cropId ? <><h3>选择种子</h3><div className={styles.seeds}>{MANOR_CROPS.map((seed) => {
          const access = data?.cropAccess?.find((entry) => entry.id === seed.id);
          const unlocked = access?.unlocked ?? seed.id === "wheat";
          return <button key={seed.id} disabled={busy || quiet || !unlocked} onClick={() => void mutatePlot(plot, "plant", seed.id)}><CropSprite crop={seed.id} /><b>{seed.name}</b><small>{unlocked ? "可播种" : `${access?.progress ?? 0} / ${access?.need ?? "—"}`}</small>{!unlocked && <span className={styles.seedRule}>{seed.unlock.kind === "points" ? "此品种暂未开放兑换" : seed.prompt}</span>}</button>;
        })}</div>{quiet && <p>舒缓模式中，明天再来播种。</p>}</> : <>
          <div className={styles.cropDetail}><CropSprite crop={plot.cropId} stage={plot.stage} /><div><h3>{crop?.name ?? plot.cropId}</h3><p>{STAGES[plot.stage]}</p><span className={styles.version}>已保存 · 版本 {plot.revision}</span></div></div>
          <section className={styles.source}><h3>这次成长的学习来源</h3>{evidence ? <><b>{mission?.title ?? "已关联学习证据"}</b><p>{mission?.subject} · 证据 {evidence.id.slice(-8)}</p><a href={`/student/manor?missionId=${encodeURIComponent(evidence.missionId)}&evidenceId=${encodeURIComponent(evidence.id)}`}><BookOpen size={17} />查看学习记录</a></> : <p>尚未关联学习证据。首次种植不代表学科能力已掌握。</p>}</section>
          <p className={styles.cost}>照料消耗 8 点成长能量 · 当前可用于农田 {plotEnergy} 点</p>
          {quiet ? <p>舒缓模式中，仅查看，不扣减资源。</p> : clearConfirm ? <div className={styles.confirm}><p>清理后该作物会移除，已有学习证据和成果不会删除。</p><button disabled={busy} onClick={() => void mutatePlot(plot, "clear")}><Shovel size={17} />确认清理</button><button disabled={busy} onClick={() => setClearConfirm(false)}>取消</button></div> : <div className={styles.actions}>{plot.stage >= 3 ? <button className={styles.primary} disabled={busy} onClick={() => void mutatePlot(plot, "harvest")}><PackageOpen size={18} />收获入仓</button> : plotEnergy >= 8 ? <button className={styles.primary} disabled={busy} onClick={() => void mutatePlot(plot, "nurture")}><Droplets size={18} />照料 · 8 点</button> : <button className={styles.primary} onClick={() => openPanel("mission")}><NotebookPen size={18} />前往学习任务</button>}<button disabled={busy} onClick={() => setClearConfirm(true)}><Shovel size={17} />清理作物</button></div>}
        </>}
      </>}
      {dialog?.kind === "warehouse" && data && <>
        <div className={styles.tabs} aria-label="仓库分类">{[{ id: "harvests", name: "收获" }, { id: "items", name: "收藏与装扮" }].map((tab) => <button aria-pressed={warehouseTab === tab.id} key={tab.id} onClick={() => setWarehouseTab(tab.id)}>{tab.name}</button>)}</div>
        {warehouseTab === "harvests" ? <>
          <label className={styles.search}><Search size={18} /><input aria-label="搜索仓库" placeholder="搜索名称" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className={styles.seeds}>{MANOR_CROPS.filter((item) => item.name.includes(search) && (data.resources.harvests[item.id] ?? 0) > 0).map((item) => <div key={item.id} className={styles.inventoryItem}><CropSprite crop={item.id} /><b>{item.name}</b><span>已收获 {data.resources.harvests[item.id]} 次</span></div>)}</div>
          {!MANOR_CROPS.some((item) => item.name.includes(search) && (data.resources.harvests[item.id] ?? 0) > 0) && <div className={styles.empty}><PackageOpen size={32} /><h3>{search ? "没有符合搜索条件的收获" : "还没有收获"}</h3><button onClick={() => { setDialog(null); setView("list"); }}><Sprout size={18} />查看我的农田</button></div>}
          <div className={styles.actions}><button onClick={() => openPanel("workshop")}><NotebookPen size={18} />写一份观察记录</button><button onClick={() => openPanel("portfolio")}><BookOpen size={18} />查看学习成果</button></div>
        </> : data.scene ? <DecorationWarehouse key={data.subject.id} userId={data.subject.id} scene={data.scene} onChange={updateScene} quiet={quiet} /> : <p>装扮库存尚未同步，请刷新庄园。</p>}
      </>}
      {dialog?.kind === "neighbors" && data && <>
        <button disabled={busy} onClick={() => { setVisit(null); void reload().catch(() => undefined); }}><RefreshCw size={18} />刷新同班伙伴</button>
        {visit && <PublicDecorationView items={visit.decorations} />}
        {data.scene && !visit && <section className={styles.publication}><label><input type="checkbox" checked={data.scene.publication.enabled} disabled={busy || !data.scene.publication.classId} onChange={(event) => void publishScene(event.target.checked)} />向当前同班伙伴公开我的农田和装饰</label><p>不公开积分、作答或学习评价。可以随时撤回；已保存的截图无法收回。</p>{!data.scene.publication.classId && <p>尚未加入班级，公开功能未启用。</p>}{hasPendingManorScene(data.subject.id) && <button disabled={busy} onClick={() => void publishScene()}><RefreshCw size={18} />恢复待确认操作</button>}</section>}
        {visit ? <><button onClick={() => setVisit(null)}><ArrowLeft size={17} />返回同班伙伴</button><h3>{visit.name}的公开农田</h3><div className={styles.visitGrid}>{visit.plots.map((item) => <div key={item.plot}>{item.cropId ? <CropSprite crop={item.cropId} stage={item.stage} /> : <Sprout size={25} />}<b>第 {item.plot + 1} 块田</b><small>{item.cropId ? `${MANOR_CROPS.find((entry) => entry.id === item.cropId)?.name ?? item.cropId} · ${STAGES[item.stage]}` : "空地"}</small></div>)}</div></> : <div className={styles.neighborList}>{data.neighbors.length ? data.neighbors.map((neighbor) => <button key={neighbor.id} disabled={busy} onClick={() => void visitNeighbor(neighbor)}><span>{neighbor.name.slice(0, 1)}</span><b>{neighbor.name}</b><span>参观<ChevronRight size={17} /></span></button>) : <div className={styles.empty}><Users size={32} /><h3>{data.scene?.classmateCount ? "同班伙伴尚未公开庄园" : "暂时没有同班伙伴"}</h3><p>这里只显示当前同班且主动公开的庄园。</p></div>}</div>}
      </>}
      {dialog?.kind === "resources" && data && <><dl className={styles.resourceList}><div><dt>学习积分</dt><dd>{data.resources.points}</dd></div><div><dt>成长能量</dt><dd>{data.resources.growthEnergy}</dd></div><div><dt>可用于照料</dt><dd>{plotEnergy}</dd></div><div><dt>累计收获</dt><dd>{data.resources.harvestedTotal}</dd></div></dl><p>积分与成长能量分别记账，不能互相替代。保存学习记录、反思和复习不消耗能量。</p><h3>能量来源</h3><div className={styles.grantList}>{data.grants.filter((grant) => grant.remainingUnits > 0).map((grant) => { const source = data.evidence.find((item) => item.id === grant.evidenceId); const task = data.missions.find((item) => item.id === source?.missionId); return <div key={grant.id}><b>{task?.title ?? "学习证据"}</b><span>剩余 {grant.remainingUnits} / {grant.units}</span><small>{grant.allowedPurposes.some((purpose) => ["plot", "support_plot"].includes(purpose)) ? "可用于照料" : "非农田用途"} · 证据 {grant.evidenceId.slice(-8)}</small></div>; })}{!data.grants.some((grant) => grant.remainingUnits > 0) && <p>尚无可用成长能量。</p>}</div><button className={styles.primary} onClick={() => openPanel("mission")}><NotebookPen size={18} />前往学习任务</button></>}
      {dialog?.kind === "help" && <div className={styles.rules}><h3>从学习到成长</h3><ol><li>完成任务，留下答案和解释。</li><li>查看反馈，修订想法，写下反思。</li><li>保存成果，也可以用可用成长能量照料农田。</li><li>到记忆温室复习，或结束今天的学习。</li></ol><p>答错不会使作物生病，离线不会枯萎。没有付费、抽奖、互偷和个人排名。农田只是成长记录，不是成绩判断。</p><Link href="/student/growth">查看成长档案<ArrowUpRight size={17} /></Link></div>}
      {dialog?.kind === "plot" && plot && <V7PlotHistory key={`${data?.subject.id}:${plot.id}:${plot.revision}`} plotId={plot.id} />}
      {busy && <p className={styles.feedback} role="status"><LoaderCircle className={styles.spin} size={18} />等待服务器确认…</p>}{error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.feedback} role="status"><Check size={17} />{notice}</p>}
      </div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>, document.body);
}
