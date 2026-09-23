"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Download, FileText, Pencil, Star, Trash2, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SchoolResourceIcon } from "@/components/common/SchoolResourceIcon";
import { KINDS, SCOPES, fileExtension, readableBytes, type SchoolResource } from "@/lib/school-resources/model";
import styles from "./school-resources.module.css";
import { revealDialogFocus } from "./dialogFocus";
import { HtmlActivityPlayer } from "./HtmlActivityPlayer";
import { DocumentMediaPreview } from "./DocumentMediaPreview";
import { ActivityDistribution } from "./ActivityDistribution";
import { downloadBlob, sourceBlob } from "@/lib/school-resources/activityPackage";

export function downloadResource(resource: SchoolResource) {
  downloadBlob(sourceBlob(resource), resource.fileName);
}

export function ResourceDetail({ resource, accountId, favorite, pending, writable, onClose, onFavorite, onEdit, onRemove, onDownload }: {
  accountId: string;
  resource: SchoolResource; favorite: boolean; pending: boolean; writable: boolean; onClose: () => void; onFavorite: () => void;
  onEdit: () => void; onRemove: () => Promise<void>; onDownload: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [distribution, setDistribution] = useState(false);
  const [distributionBusy, setDistributionBusy] = useState(false);
  const [distributionDirty, setDistributionDirty] = useState(false);
  const isHtml = ["html", "htm"].includes(fileExtension(resource.fileName));
  const allowClose = () => !pending && !distributionBusy && (!distributionDirty || window.confirm("布置草稿尚未保存，确定放弃这些修改？"));
  const closeDistribution = () => { if (allowClose()) { setDistribution(false); setDistributionDirty(false); } };
  return <Dialog open onOpenChange={open => { if (!open && allowClose()) onClose(); }}>
    <DialogContent hideClose className={`${styles.theme} ${styles.detailDialog} ${isHtml ? styles.activityDialog : ""}`} onFocusCapture={revealDialogFocus} onInteractOutside={event => { if (pending || distributionBusy) event.preventDefault(); }}>
      <div className={styles.dialogHeader}><SchoolResourceIcon name={resource.kind === "other" ? "folder" : resource.kind} size={46} />
        <div><DialogTitle>{resource.title}</DialogTitle><DialogDescription>{resource.origin === "example" ? "示例资源 · 非真实校内共享文件" : "本机草稿 · 未上传到学校服务器"}</DialogDescription></div>
        <button onClick={() => { if (allowClose()) onClose(); }} disabled={pending || distributionBusy} className={styles.iconButton} title="关闭" aria-label="关闭资源详情"><X size={19} /></button>
      </div>
      <div className={styles.dialogBody}>
        <div className={styles.detailMeta}><span>{KINDS[resource.kind]}</span><span>{resource.subject}</span><span>{resource.grade}</span><span>{resource.author}</span></div>
        <p className={styles.description}>{resource.description || "暂未填写内容简介。"}</p>
        <div className={styles.previewHeading}><FileText size={16} /><h3>{isHtml ? "互动活动" : resource.origin === "example" ? "示例教学提纲" : "本机文件"}</h3></div>
        {isHtml ? <HtmlActivityPlayer key={resource.id + resource.revision} resource={resource} /> : <DocumentMediaPreview key={resource.id + resource.updatedAt} resource={resource} />}
        {distribution && <ActivityDistribution resource={resource} accountId={accountId} onClose={closeDistribution} onBusyChange={setDistributionBusy} onDirtyChange={setDistributionDirty} />}
        {isHtml && <p className={styles.mutedSmall}>原始 HTML 下载后不再受平台隔离保护。给学生使用时，推荐导出活动包并在「学习资源」中打开。</p>}
        <dl className={styles.fileFacts}><div><dt>文件</dt><dd>{resource.fileName}</dd></div><div><dt>大小</dt><dd>{readableBytes(resource.fileSize)}</dd></div>
          <div><dt>{resource.origin === "example" ? "来源" : "当前可见范围"}</dt><dd>{resource.origin === "example" ? "内置示例" : "仅自己 · 此浏览器"}</dd></div>
          {resource.origin === "local" && <><div><dt>分享意向（未生效）</dt><dd>{SCOPES[resource.scope]}</dd></div><div><dt>来源声明（本人填写）</dt><dd>{resource.rights === "own" ? "本人原创" : "已获授权"}</dd></div><div><dt>文件校验</dt><dd className={styles.hash}>{resource.sha256}</dd></div></>}
        </dl>
        <div className={styles.related}><span>继续教学工作</span><Link href="/research/prep">集体备课<ArrowUpRight size={15} /></Link><Link href="/research/courseware">课件工坊<ArrowUpRight size={15} /></Link></div>
        <p className={styles.mutedSmall}>打开工作区不会自动导入此资源；需要时可先下载文件。</p>
        {removing && <div className={styles.removeConfirm} role="alert"><strong>移除这份本机草稿？</strong><p>仅移除此浏览器保存的副本，不会删除电脑上的原文件。</p>
          {removeError && <p className={styles.error}>{removeError}</p>}
          <button disabled={pending} className={styles.secondary} onClick={() => setRemoving(false)}>保留草稿</button>
          <button disabled={!writable} className={styles.danger} onClick={async () => { try { await onRemove(); } catch (error) { setRemoveError(error instanceof Error ? error.message : "移除失败。"); } }}>确认移除本机副本</button></div>}
      </div>
      <div className={styles.dialogFooter}>
        {resource.origin === "local" && <button className={styles.iconButton} disabled={!writable || distributionBusy} title="移除本机草稿" aria-label="移除本机草稿" onClick={() => { if (allowClose()) setRemoving(true); }}><Trash2 size={17} /></button>}
        <button className={styles.secondary} disabled={!writable} aria-pressed={favorite} onClick={onFavorite}><Star size={16} fill={favorite ? "currentColor" : "none"} />{favorite ? "已收藏" : "收藏"}</button>
        {resource.origin === "local" && <button className={styles.secondary} disabled={!writable || !resource.blob || distributionBusy} title={!resource.blob ? "原文件缺失，请重新添加资料" : undefined} onClick={() => { if (allowClose()) onEdit(); }}><Pencil size={16} />编辑信息</button>}
        {isHtml && <button className={styles.primary} disabled={distributionBusy} aria-expanded={distribution} onClick={() => { if (distribution) closeDistribution(); else setDistribution(true); }}><Users size={17} />分享给学生</button>}
        <button className={isHtml ? styles.secondary : styles.primary} onClick={onDownload}><Download size={16} />{isHtml ? "下载 HTML" : resource.origin === "example" ? "下载示例提纲" : "下载原文件"}</button>
      </div>
    </DialogContent>
  </Dialog>;
}
