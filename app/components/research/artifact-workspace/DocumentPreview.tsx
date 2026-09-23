"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResearchArt } from "@/components/research/workspace-shared";
import { pagesOf, type ArtName } from "./model";
import s from "./workspace.module.css";

export function MarkdownBody({ content }: { content: string }) {
  return <div className={s.markdown}><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    img: ({ alt }) => <span className={s.muted}>[图片：{alt || "未载入的外部图片"}]</span>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    table: ({ children }) => <div className={s.tableScroll}><table>{children}</table></div>,
  }}>{content}</ReactMarkdown></div>;
}

export function DocumentPreview({ content, art, page = 0, zoom = 100 }: { content: string; art?: ArtName; page?: number; zoom?: number }) {
  const pages = pagesOf(content);
  const index = Math.min(page, pages.length - 1);
  return <div className={s.paperViewport}><article className={s.paper} style={{ width: `${zoom}%` }} aria-label={`材料正文，第 ${index + 1} 页`}>
    {art && <div className={s.paperArt}><ResearchArt name={art} size={70} /></div>}
    <MarkdownBody content={pages[index]} />
    <footer className={s.paperNumber}>第 {index + 1} 页 / 共 {pages.length} 页</footer>
  </article></div>;
}

export function DocumentThumbnail({ content, art, title }: { content: string; art?: ArtName; title: string }) {
  const lines = content.replace(/[#*|_]/g, "").split(/\n/).filter(line => line.trim()).slice(1, 6);
  return <div className={s.thumbnail} aria-hidden="true">
    <strong>{title}</strong>{art && <ResearchArt name={art} size={34} />}
    {lines.map((line, i) => <span key={i}>{line.slice(0, 48)}</span>)}
    <div className={s.thumbRule} /><div className={s.thumbRule} />
  </div>;
}
