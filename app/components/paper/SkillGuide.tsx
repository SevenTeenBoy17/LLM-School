"use client";

import { BookOpen, ExternalLink, X } from "lucide-react";
import { Content } from "@radix-ui/react-dialog";
import { Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import type { ResearchSkill } from "@/lib/paper/catalog";
import s from "./paper-studio.module.css";

export function SkillGuide({ skill }: { skill: ResearchSkill }) {
  return <Dialog>
    <DialogTrigger asChild><button className={s.guideButton}><BookOpen size={15} /> 使用说明<span className="sr-only">：{skill.title}</span></button></DialogTrigger>
    <DialogPortal><DialogOverlay className={s.guideOverlay} /><Content className={s.guideDialog}>
      <DialogClose className={s.closeButton} aria-label="关闭使用说明"><X size={19} /></DialogClose>
      <div className={s.eyebrow}>{skill.kind} · {skill.owner}</div>
      <DialogTitle className={s.dialogTitle}>{skill.title}</DialogTitle>
      <DialogDescription>{skill.summary}</DialogDescription>
      <code className={s.skillName}>{skill.name}</code>
      <h3>核心用法</h3>
      <ol className={s.guideSteps}>{skill.steps.map(step => <li key={step}>{step}</li>)}</ol>
      <h3>运行条件</h3><p>{skill.dependency}</p>
      <p className={s.warning}>{skill.caution}</p>
      <p className={s.muted}>本站提供提炼后的提示词，不会安装或执行此 Skill。安装前核对维护者、许可证、脚本、权限与费用。</p>
      <div className={s.actions}>
        {skill.sourceUrl && <a className={s.secondary} href={skill.sourceUrl} target="_blank" rel="noopener noreferrer">查看源码 <ExternalLink size={15} /></a>}
        {skill.installUrl && <a className={s.secondary} href={skill.installUrl} target="_blank" rel="noopener noreferrer">安装 / 使用文档 <ExternalLink size={15} /></a>}
      </div>
    </Content></DialogPortal>
  </Dialog>;
}
