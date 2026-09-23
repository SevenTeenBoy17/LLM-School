"use client";
import { ArrowUpRight, FileText } from "lucide-react";
import { AnimatedPanel } from "@/components/research/workspace-shared";
import type { PrepEntry, PrepProject } from "./model";
import s from "./prep.module.css";

function DocumentPreview({ project, kind, pending }: { project: PrepProject; kind: "draft" | "observation" | "adaptation"; pending?: boolean }) {
  return <div className={s.documentThumb} aria-hidden="true" data-testid={`prep-preview-${kind}`}>
    <div className={s.miniHeading}>{kind === "observation" ? "课堂观察记录表" : kind === "adaptation" ? "个人改编" : "共同底稿"}</div>
    <div className={s.miniTitle}>{project.title}</div>
    {kind === "observation" ? <><div className={s.miniText}>{project.observationPlan || "观察问题待填写"}</div><div className={s.miniGrid}>{["原始观察", "解释待验证", "下次调整"].map(label => <b key={label}>{label}</b>)}{project.evidence.length ? project.evidence.slice(0, 2).flatMap(e => [e.observation, e.interpretation, e.adjustment]).map((text, i) => <span key={i}>{text || "待补充"}</span>) : ["尚无课堂记录", "", "", "", "", ""].map((text, i) => <span key={i}>{text}</span>)}</div></> : <><div className={s.miniText}><b>{kind === "adaptation" ? pending ? "来源底稿 · 待改编" : "本班适用条件" : "学习目标"}</b><p>{kind === "adaptation" && !pending ? project.conditions || "待确认" : project.goal || "待填写"}</p></div><div className={s.miniRule} /><div className={s.miniText}><b>{pending ? "改编记录待创建" : "课堂任务"}</b>{!pending && project.rows.slice(0, 3).map(r => <p key={r.id}>{r.phase} · {r.task}</p>)}</div></>}
    <div className={s.miniFooter}>{pending ? "未创建" : `v${project.version} · ${project.example ? "示例" : "本机草稿"}`}</div>
  </div>;
}

export function MaterialStrip({ projects, onOpen, motionKey }: { projects: PrepProject[]; onOpen: (id: string, entry?: PrepEntry) => void; motionKey: string }) {
  const active = projects.filter(p => !p.archived);
  const common = active.find(p => !p.source && p.rows.length > 0) ?? active.find(p => !p.source) ?? active[0];
  const observation = active.find(p => p.kind === "研究课");
  const adaptation = active.find(p => p.source);
  const origin = adaptation ?? common;
  return <AnimatedPanel motionKey={motionKey} className={s.materialsSection}><h2>从已有材料继续</h2><div className={s.materialsGrid}>
    {common && <button className={s.materialItem} onClick={() => onOpen(common.id)}><DocumentPreview project={common} kind="draft" /><span><strong>共同底稿</strong><small>{common.title}</small><small>v{common.version} · {common.example ? "示例材料" : "本机草稿"}</small></span><FileText size={17} /></button>}
    {observation && <button className={s.materialItem} onClick={() => onOpen(observation.id, "observation")}><DocumentPreview project={observation} kind="observation" /><span><strong>观察记录表</strong><small>{observation.title}</small><small>{observation.evidence.length ? `${observation.evidence.length} 条${observation.example ? "示例观察" : "未核验记录"}` : "观察计划 · 尚无课堂记录"}</small></span><FileText size={17} /></button>}
    {origin && <button className={s.materialItem} onClick={() => onOpen(origin.id, adaptation ? "document" : "adapt")}><DocumentPreview project={origin} kind="adaptation" pending={!adaptation} /><span><strong>个人改编</strong><small>{origin.title}</small><small>{adaptation ? `v${adaptation.version} · 本机草稿` : "待创建 · 从此底稿开始"}</small></span>{adaptation ? <FileText size={17} /> : <ArrowUpRight size={17} />}</button>}
    {!active.length && <p className={s.muted}>尚无进行中的材料。</p>}
  </div></AnimatedPanel>;
}
