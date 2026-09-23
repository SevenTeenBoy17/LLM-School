"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ListChecks, Pause, Play, UserRound } from "lucide-react";
import { WorkButton } from "@/components/research/workspace-shared";
import { groupProgress, type GroupMember, type GroupSnapshot } from "@/lib/research-groups";
import { seatPosition, tableDimensions, tablePage } from "./roundtableLayout";
import { PlanetScene } from "./PlanetScene";
import { PLANET, shouldAnimate } from "./planetModel";
import styles from "./group-workspace.module.css";

export function BotPortrait({ member, className = "" }: { member: Pick<GroupMember, "bot" | "name">; className?: string }) {
  const [missing, setMissing] = useState(false);
  return <span className={`${styles.portrait} ${className}`} aria-hidden="true">
    {missing ? <UserRound size={32} /> : <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`/art/research-groups/bots/${member.bot}/main.png`} />
      {/* Local animated WEBP assets deliberately remain native images. */}
      <img src={`/art/research-groups/bots/${member.bot}/main.webp`} alt="" width={96} height={96} onError={() => setMissing(true)} />
    </picture>}
  </span>;
}

export function GroupScene({ snapshot, onMember }: { snapshot: GroupSnapshot; onMember: (member: GroupMember) => void }) {
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(320);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const onReady = useCallback(() => setReady(true), []);
  const onCanvasError = useCallback(() => setCanvasFailed(true), []);
  const compact = width < 620;
  const { members } = snapshot;
  const useList = width < 240 || members.some((member) => [...member.name].length > 18);
  const { pages, page: currentPage, displayed, capacity } = tablePage(members, page, compact);
  const dimensions = tableDimensions(width, compact);
  const running = shouldAnimate(paused, reduced, visible) && !canvasFailed;
  useEffect(() => {
    const surface = viewport.current;
    if (!surface) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    let inView = false;
    const visibility = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; visibility(); });
    observer.observe(surface);
    motion(); media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); media.removeEventListener("change", motion); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => {
    if (!visible || webglAvailable || canvasFailed) return;
    const frame = requestAnimationFrame(() => {
      let context: WebGL2RenderingContext | null = null;
      try {
        context = document.createElement("canvas").getContext("webgl2");
        if (context) setWebglAvailable(true);
        else onCanvasError();
      } catch { onCanvasError(); }
      finally { context?.getExtension("WEBGL_lose_context")?.loseContext(); }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, webglAvailable, canvasFailed, onCanvasError]);
  useEffect(() => {
    const surface = root.current;
    const lost = (event: Event) => { event.preventDefault(); onCanvasError(); };
    surface?.addEventListener("webglcontextlost", lost, true);
    return () => surface?.removeEventListener("webglcontextlost", lost, true);
  }, [onCanvasError]);
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const renderMember = (member: GroupMember, index: number) => {
    const tasks = snapshot.tasks.filter((task) => task.assigneeId === member.userId);
    const progress = groupProgress(tasks);
    const position = seatPosition(index, displayed.length, width, compact);
    return <button key={member.userId} type="button" className={useList ? styles.memberRow : styles.seat}
      style={useList ? undefined : { left: position.left, top: position.top }} onClick={() => onMember(member)}
      data-owner={member.isOwner} data-label-above={position.above} data-testid="roundtable-member"
      aria-label={`查看${member.name}的任务${member.isOwner ? "，组长" : ""}`} title={`${member.name}${member.department ? ` · ${member.department}` : ""}`}>
      <BotPortrait member={member} />
      <span className={styles.memberText}>
        <span className={styles.memberName}>{member.name}</span>
        <span className={styles.memberProgress}>{member.isOwner && <small>组长</small>}{progress.total ? `${progress.completed}/${progress.total} 项 · ${progress.percent}%` : "未分配"}</span>
      </span>
      <span className={styles.memberDetail}><ListChecks size={14} />查看任务</span>
    </button>;
  };
  return <section ref={root} className={styles.sceneSection} aria-label="教研组成员星球">
    <div className={styles.sectionHeading}>
      <h3>本组成员 <span>{members.length}</span></h3>
      <WorkButton className={styles.viewButton} aria-label={paused ? "播放星球动效" : "暂停星球动效"}
        title={reduced ? "已遵循系统减少动态效果设置" : paused ? "播放星球动效" : "暂停星球动效"}
        aria-pressed={paused} disabled={!ready || canvasFailed || reduced}
        onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}</WorkButton>
    </div>
    <div ref={viewport} className={`${styles.scene} ${compact ? styles.compactScene : ""}`}
      style={{ height: useList ? 230 : dimensions.height, "--planet-size": `${useList ? 164 : dimensions.diameter}px` } as CSSProperties}
      data-testid="research-group-scene" data-model-state={canvasFailed ? "fallback" : ready ? "ready" : "loading"}
      data-motion={!visible ? "hidden" : reduced ? "reduced" : running ? "running" : "paused"}>
      <div className={styles.sceneArt} aria-hidden="true">
        {(!ready || canvasFailed) && <div className={styles.planetFallback}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PLANET.poster} alt="" width={640} height={640} />
        </div>}
        {webglAvailable && !canvasFailed && <PlanetScene diameter={useList ? 164 : dimensions.diameter}
          running={running} onReady={onReady} onError={onCanvasError} />}
      </div>
      {!useList && displayed.map(renderMember)}
    </div>
    {useList && <div className={styles.memberList}>{displayed.map(renderMember)}</div>}
    {!ready && !canvasFailed && visible && <div className={styles.planetLoading} role="status"><span />正在载入星球</div>}
    {canvasFailed && <p className={styles.hint}>当前使用静态星球视图，成员与任务操作不受影响。</p>}
    <div className={styles.sceneFooter}>
      <span aria-live="polite">第 {currentPage + 1} 组成员 / 共 {pages} 组 · {capacity} 席 · 组长固定席</span>
      <div className={styles.pager}>
        <WorkButton aria-label="上一桌成员" title="上一桌成员" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></WorkButton>
        <WorkButton aria-label="下一桌成员" title="下一桌成员" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></WorkButton>
      </div>
    </div>
  </section>;
}
