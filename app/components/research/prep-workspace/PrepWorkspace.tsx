"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Archive, ArrowRight, ChevronRight, ClipboardList, FileText, LockKeyhole, MessageSquare, Plus, Search } from "lucide-react";
import { WorkspaceFrame, ResearchArt, WorkButton, DemoNotice, useDemoState } from "@/components/research/workspace-shared";
import { SAMPLE_PROJECTS, adaptProject, validProjects, capacityError, type PrepProject, type PrepEntry } from "./model";
import { CreatePrepDialog } from "./CreatePrepDialog";
import { PrepDetail } from "./PrepDetail";
import { TemplateLibrary } from "./TemplateLibrary";
import { MaterialStrip } from "./MaterialStrip";
import s from "./prep.module.css";

const ResearchGroupWorkspace = dynamic(() => import("../group-workspace/ResearchGroupWorkspace"), { ssr: false, loading: () => <div className={s.loadingProgress} role="progressbar" aria-label="正在加载教研组"><span /></div> });

const tabs = ["我的共备", "教研组", "模板库", "已归档"] as const;
export default function PrepWorkspace() {
  const [projects, setProjects, storage] = useDemoState<PrepProject[]>("prep-workspace-v1", SAMPLE_PROJECTS, validProjects);
  const [tab, setTab] = useState<(typeof tabs)[number]>("我的共备");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [selected, setSelected] = useState<{ id: string; entry: PrepEntry } | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const project = projects.find(p => p.id === selected?.id);
  const openProject = (id: string, entry: PrepEntry = "document") => { setNotice(""); setSelected({ id, entry }); };
  const filtered = useMemo(() => projects.filter(p => (tab === "已归档" ? p.archived : !p.archived) && (!subject || p.subject === subject) && (!kind || p.kind === kind) && (!onlyPending || p.discussions.some(d => !d.reason)) && `${p.title} ${p.subject} ${p.lead} ${p.members}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt), [projects, tab, subject, kind, query, onlyPending]);
  const commit = (next: PrepProject[]): string | null => {
    const error = !storage.ready ? "工作区尚未就绪，当前输入仍保留。" : capacityError(next) ?? (!validProjects(next) ? "材料超出单项限制或格式无效，当前输入仍保留。" : null);
    if (error) return error;
    setProjects(next);
    return null;
  };
  const saveProject = (p: PrepProject) => projects.some(item => item.id === p.id) ? commit(projects.map(item => item.id === p.id ? p : item)) : "项目已不可用，未保存本次修改。";
  const add = (p: PrepProject) => { const error = commit([p, ...projects]); if (!error) openProject(p.id); return error; };
  return <div data-testid="prep-workspace" className={s.root}><WorkspaceFrame className={s.workspace}>{tab !== "教研组" && <DemoNotice />}
    {tab !== "教研组" && storage.ready && (storage.message || !storage.persistent) && <p role="status" className={s.warning}>{storage.message || "浏览器存储不可用，仅在页面内存中保留；刷新或离开页面可能丢失。"}</p>}
    {!storage.ready ? <div className={s.empty}><p role="status">正在读取本机工作区…</p><div className={s.loadingProgress} role="progressbar" aria-label="正在读取本机工作区"><span /></div></div> : project ? <PrepDetail key={project.id} project={project} entry={selected?.entry} persistent={storage.persistent} onSave={saveProject} onBack={() => setSelected(null)} onAdapt={p => add(adaptProject(p))} /> : <>
      <header className={s.heading}><ResearchArt name="prep" size={64} /><div><h1>集体备课</h1><p>围绕真实问题，共备一份可调整的课堂方案</p></div>{tab !== "教研组" && <div className={s.actions}><WorkButton onClick={() => setTab("模板库")}><FileText size={17} />从模板开始</WorkButton><WorkButton primary onClick={() => setCreating(true)}><Plus size={18} />新建共备</WorkButton></div>}</header>
      <nav className={s.tabs} aria-label="备课工作区">{tabs.map(t => <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>{t}</button>)}</nav>
      {notice && <p className={s.feedback} role="status">{notice}</p>}
      {tab === "模板库" ? <TemplateLibrary /> : tab === "教研组" ? <ResearchGroupWorkspace /> : <>
        <div className={s.homeColumns}><div className={s.mainList}>
          <div className={s.filters}><label className={s.search}><Search size={18} /><input aria-label="搜索共备" value={query} maxLength={200} onChange={e => setQuery(e.target.value)} placeholder="搜索课题、学科或成员" /></label><select aria-label="备课类型" value={kind} onChange={e => setKind(e.target.value)}><option value="">全部类型</option><option>日常共备</option><option>研究课</option></select><select aria-label="学科筛选" value={subject} onChange={e => setSubject(e.target.value)}><option value="">全部学科</option>{Array.from(new Set(projects.map(p => p.subject))).sort().map(x => <option key={x}>{x}</option>)}</select></div>
          <div className={s.sectionHeader}><h2>{tab === "已归档" ? "已归档的共备" : onlyPending ? "待我处理" : "正在推进"}</h2>{onlyPending && <button className={s.textButton} onClick={() => setOnlyPending(false)}>显示全部</button>}</div>
          {filtered.length ? <div className={s.tableScroll}><table className={s.projectTable}><thead><tr><th>共备课题</th><th>当前阶段</th><th>下一步</th><th>主备</th><th>更新时间</th><th><span className={s.srOnly}>操作</span></th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><button className={s.projectName} onClick={() => openProject(p.id, onlyPending ? "discussion" : "document")}><ResearchArt name={p.art} size={48} /><span><strong>{p.title}</strong><small>{p.grade} · {p.subject} · {p.kind}</small><small><LockKeyhole size={11} />仅本机 · {p.example ? "示例" : "个人草稿"}</small></span></button></td><td><span className={s.stage} data-stage={p.stage}>{p.stage}</span></td><td>{p.next}</td><td>{p.lead}</td><td className={s.time}>{new Date(p.updatedAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })}</td><td><button className={s.iconButton} title={p.archived ? "恢复到我的共备" : "归档共备"} aria-label={`${p.archived ? "恢复" : "归档"} ${p.title}`} onClick={() => { const error = saveProject({ ...p, archived: !p.archived }); setNotice(error ?? (p.archived ? "已恢复本机项目。" : "已归档本机项目，可在已归档中恢复。未删除记录。")); }}><Archive size={16} /></button></td></tr>)}</tbody></table></div> : <div className={s.empty}><Search size={28} /><h3>没有匹配的共备</h3><WorkButton onClick={() => { setQuery(""); setSubject(""); setKind(""); setOnlyPending(false); }}>清除筛选</WorkButton><WorkButton onClick={() => setCreating(true)}>新建共备</WorkButton></div>}
        </div><aside className={s.homeAside}><h2>待我处理</h2>{projects.filter(p => !p.archived && p.discussions.some(d => !d.reason)).slice(0, 3).map((p, i) => <button className={s.todo} key={p.id} onClick={() => openProject(p.id, "discussion")}>{i % 2 ? <ClipboardList size={26} /> : <MessageSquare size={26} />}<span><strong>{p.next}</strong><small>{p.title}{p.example ? " · 示例" : ""}</small></span><ChevronRight size={18} /></button>)}<button className={s.textButton} onClick={() => { setTab("我的共备"); setOnlyPending(true); }}>查看全部 <ArrowRight size={15} /></button><section><h2>最近共识</h2><p>先记录学生如何解释，再讨论支架调整。</p><small>示例讨论摘要，不代表真实团队共识。</small><button className={s.textButton} onClick={() => { const p = projects.find(p => p.id === "sample-water"); if (p) openProject(p.id, "discussion"); }}>校园节水 · 讨论记录</button></section></aside></div>
        <MaterialStrip projects={projects} onOpen={openProject} motionKey={tab} />
      </>}
    </>}
    <CreatePrepDialog open={creating} onOpenChange={setCreating} onCreate={add} />
  </WorkspaceFrame></div>;
}
