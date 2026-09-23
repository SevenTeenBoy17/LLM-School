"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PrepWizard } from "@/components/research/PrepWizard";
import type { ClientPrompt } from "@/lib/client/libraryApi";
import { WorkButton } from "@/components/research/workspace-shared";
import s from "./prep.module.css";

export function TemplateLibrary() {
  const [items, setItems] = useState<ClientPrompt[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let alive = true;
    const timer = setTimeout(() => controller.abort(), 30000);
    fetch("/api/prompts", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("load_failed");
      const data = await response.json();
      if (!Array.isArray(data.prompts)) throw new Error("invalid_response");
      if (alive) { setItems(data.prompts.filter((p: ClientPrompt) => /备课|教学设计|教案|课堂|导入/.test(`${p.category}${p.title}${p.scene ?? ""}`))); setStatus("ready"); }
    }).catch(() => { if (alive) setStatus("error"); }).finally(() => clearTimeout(timer));
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  const filtered = items.filter(p => `${p.title} ${p.scene ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className={s.templateLibrary}><header className={s.sectionHeader}><div><h2>真实模板库</h2><p>此入口连接已有提示词与个人对话，不属于本机共备项目。</p></div><Link href="/prompts/new">贡献新模板</Link></header>
    {status === "loading" ? <p role="status">正在读取模板…</p> : status === "error" ? <div role="alert"><p>模板读取失败，未使用示例数据替代。</p><WorkButton onClick={() => { setStatus("loading"); setAttempt(x => x + 1); }}>重新加载</WorkButton></div> : <><label className={s.search}>搜索模板<input value={query} onChange={e => setQuery(e.target.value)} placeholder="课题或教学场景" /></label>{filtered.length ? <PrepWizard key={query} templates={filtered} /> : <div className={s.empty}><h3>没有匹配的备课模板</h3><WorkButton onClick={() => setQuery("")}>清除筛选</WorkButton><Link href="/prompts/new">创建模板</Link></div>}</>}
  </section>;
}
