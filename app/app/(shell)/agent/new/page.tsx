"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { ArrowLeft, ArrowRight, ArrowLeftCircle, Save, Send, Sparkles, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MODELS, MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import type { ModelProvider, AgentItem } from "@/lib/types";
import { apiCreateAgent, apiUpdateAgent, apiGetAgent, apiSetAgentStatus, AgentUpdateError } from "@/lib/client/libraryApi";
import { cn } from "@/lib/utils";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";
import { findAgentTemplate, agentTemplatePrompt } from "@/lib/agent/templates";

// 工具开关 → 能力标签（写入 agent.capabilities，供列表展示）。
const TOOL_CAP: Record<string, string> = {
  files: "文件解析", docx: "Word 导出", pptx: "PPT 大纲", image: "图片生成", web: "联网检索", code: "代码解释", kb: "知识库",
};

const STEPS = [
  { id: 1, title: "基础信息", desc: "名称、分类、可见范围" },
  { id: 2, title: "模型选择", desc: "选择底层 LLM 与参数" },
  { id: 3, title: "系统提示词", desc: "定义角色与输出格式" },
  { id: 4, title: "知识库绑定", desc: "勾选可调用的资料空间" },
  { id: 5, title: "工具权限", desc: "开关 7 类工具能力" },
  { id: 6, title: "安全策略", desc: "敏感词、隐私、配额" },
  { id: 7, title: "发布设置", desc: "可见范围与审批流" },
];

const KNOWLEDGE_BASES = [
  { id: "info-7", name: "七年级信息科技课程库", role: "课程成员可用" },
  { id: "rule",   name: "学校制度库",         role: "全校可用" },
  { id: "team",   name: "教研组资料库",        role: "教师可用" },
  { id: "paper",  name: "科研文献库",          role: "教师可用" },
];

const TOOLS = [
  { id: "files",   label: "文件上传分析" },
  { id: "docx",    label: "Word 导出" },
  { id: "pptx",    label: "PPT 大纲生成" },
  { id: "image",   label: "图片生成" },
  { id: "web",     label: "联网检索" },
  { id: "code",    label: "代码解释" },
  { id: "kb",      label: "调用知识库" },
];

function NewAgentInner() {
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get("id");
  const template = !editId ? findAgentTemplate(search.get("template")) : undefined;
  const savedId = useRef<string | null>(null);
  const saveLock = useRef(false);
  const [extraCapabilities, setExtraCapabilities] = useState<string[]>([]);
  const [instructionsLocked, setInstructionsLocked] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(editId ? "loading" : "ready");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [retainedKnowledgeBase, setRetainedKnowledgeBase] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [testOut, setTestOut] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testStartedAt, setTestStartedAt] = useState<number>();
  const [panelInput, setPanelInput] = useState(template?.sample ?? "帮我设计一节信息科技课，主题：生成式 AI 的基本概念");

  // Step 1
  const [name, setName] = useState(template?.name ?? "信息科技教案助手");
  const [category, setCategory] = useState<string>(template?.category ?? "教学");
  const [intro, setIntro] = useState(template?.description ?? "为信息科技教师量身定制教案、活动设计、评价方案。");
  const [audience, setAudience] = useState("教师");
  const [icon, setIcon] = useState(template?.icon ?? "BookOpen");

  // Step 2
  const [model, setModel] = useState<ModelProvider>("claude");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxContext, setMaxContext] = useState([16]);

  // Step 3
  const [system, setSystem] = useState(
template ? agentTemplatePrompt(template) : `你是一名经验丰富的{学科}教师，正在帮助{年级}学生学习{主题}。
请按照以下要求输出：
1. 语言适合学生理解
2. 内容准确，并参考课程资料库
3. 给出课堂活动建议与评价方式
4. 避免生成不符合学校规范的内容`
  );

  // Step 4
  const [kbs, setKbs] = useState<string[]>(template ? [] : ["info-7", "team"]);

  // Step 5
  const [tools, setTools] = useState<Record<string, boolean>>({
    files: !template, docx: !template, pptx: !template, image: false, web: false, code: false, kb: !template,
  });

  // Step 6
  const [security, setSecurity] = useState({
    sensitive: true, privacy: true, riskAlert: true, downloadGate: true, log: true,
  });
  const [dailyQuota, setDailyQuota] = useState([200]);

  // Step 7
  const [visibility, setVisibility] = useState("全校");
  const [version, setVersion] = useState("v1.0.0");

  const m = MODELS.find((x) => x.id === model) || MODELS[0];

  // 编辑模式：?id= 存在则载入既有智能体填充表单。
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    (async () => {
      try {
      const a = await apiGetAgent(editId, false, controller.signal);
      if (!alive) return;
      if (!a) { setLoadState("error"); return; }
      setName(a.name); setCategory(a.category); setIntro(a.description);
      setModel(a.recommendedModel); setIcon(a.icon || "BookOpen");
      setSystem(a.systemPrompt ?? "");
      setInstructionsLocked(a.status !== "draft");
      const kb = KNOWLEDGE_BASES.find((k) => k.name === a.knowledgeBase);
      setKbs(kb ? [kb.id] : []);
      setRetainedKnowledgeBase(kb ? "" : a.knowledgeBase);
      setExtraCapabilities(a.capabilities.filter(cap => !Object.values(TOOL_CAP).includes(cap)));
      // 用能力标签回勾工具
      const capSet = new Set(a.capabilities);
      setTools((cur) => {
        const next = { ...cur };
        for (const [tid, cap] of Object.entries(TOOL_CAP)) next[tid] = capSet.has(cap);
        return next;
      });
      setLoadState("ready");
      } catch { if (alive) setLoadState("error"); }
      finally { clearTimeout(timer); }
    })();
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [editId, loadAttempt]);

  const buildInput = () => {
    const capabilities = [...new Set([...extraCapabilities, ...Object.entries(tools).filter(([, on]) => on).map(([tid]) => TOOL_CAP[tid]).filter(Boolean)])];
    const kbNames = kbs.map((id) => KNOWLEDGE_BASES.find((k) => k.id === id)?.name).filter(Boolean) as string[];
    return {
      name: name.trim(), category: category as AgentItem["category"], description: intro.trim(),
      recommendedModel: model, knowledgeBase: kbNames[0] ?? retainedKnowledgeBase, capabilities, icon,
      systemPrompt: system,
    };
  };

  const submit = async (redirect: boolean) => {
    if (saveLock.current || loadState !== "ready" || instructionsLocked) return;
    if (!name.trim()) { setNotice("请填写智能体名称"); setStep(1); return; }
    if (system.length > 6000) { setNotice("任务指令不能超过6000字"); setStep(3); return; }
    saveLock.current = true; setSubmitting(true); setNotice("");
    try {
      const input = buildInput();
      const targetId = editId || savedId.current;
      const saved = targetId ? await apiUpdateAgent(targetId, input) : await apiCreateAgent(input);
      if (!saved) {
        setNotice(editId ? "更新失败（仅可编辑自己创建的智能体）" : "创建失败，请检查必填项");
        return;
      }
      savedId.current = saved.id;
      if (!editId && redirect) {
        let submitted = false;
        try { submitted = Boolean(await apiSetAgentStatus(saved.id, "review")); } catch { /* 草稿已保存，保留明确的重试入口。 */ }
        if (!submitted) {
          setNotice(`已创建「${saved.name}」草稿，但提交审核失败，请在智能体卡片「更多 → 提交审核」重试`);
          return;
        }
      }
      if (redirect) router.push("/agent");
      else setNotice(targetId ? "已保存修改" : `已创建「${saved.name}」（草稿），可在「更多 → 提交审核」送审`);
    } catch (error) {
      setNotice(error instanceof AgentUpdateError
        ? error.status === 409 ? "状态已变更，未保存本次修改。请先在目录撤回审核，或另建修订草稿；当前输入已保留。"
          : error.status === 403 ? "无权修改此智能体，请确认创建者账号。"
          : error.status === 400 ? "配置未保存，请检查名称、简介及指令长度。"
          : "更新失败，请稍后重试；当前输入已保留。"
        : "保存结果未确认：网络或服务异常，请先检查智能体列表。");
    } finally {
      setSubmitting(false);
      saveLock.current = false;
    }
  };

  // 系统提示词真实测试：把 system 作为开场约束 + 固定问句走 /api/chat。
  const runSystemTest = async () => {
    if (testing || loadState !== "ready" || instructionsLocked) return;
    const message = `${system}\n\n${panelInput.trim()}`;
    if (message.length > 2000) { setTestOut("临时测试最多2000字，请缩短指令，或保存草稿后在 AI 对话中测试完整指令。"); return; }
    setTestStartedAt(Date.now());
    setTesting(true); setTestOut(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, modelId: model }),
      });
      if (!res.ok) throw new Error(`chat_${res.status}`);
      const data = (await res.json()) as { reply?: string; kind?: string; source?: string };
      const prefix = (data.kind && data.kind !== "normal") || data.source === "local-fallback" ? "[未完成正常模型测试，请核对返回状态]\n" : "";
      setTestOut(prefix + (data.reply || "（模型未返回内容）"));
    } catch {
      setTestOut("测试失败：网络或服务异常。");
    } finally {
      setTesting(false);
    }
  };

  // 右栏实时测试：用当前 system + 用户输入的测试问题走真实 /api/chat（不再是写死假面板）。
  const runPanelTest = async () => {
    if (testing || !panelInput.trim() || loadState !== "ready" || instructionsLocked) return;
    const message = `${system}\n\n${panelInput.trim()}`;
    if (message.length > 2000) { setTestOut("临时测试最多2000字，请缩短指令，或保存草稿后在 AI 对话中测试完整指令。"); return; }
    setTestStartedAt(Date.now());
    setTesting(true); setTestOut(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, modelId: model }),
      });
      if (!res.ok) throw new Error(`chat_${res.status}`);
      const data = (await res.json()) as { reply?: string; kind?: string; source?: string };
      const prefix = (data.kind && data.kind !== "normal") || data.source === "local-fallback" ? "[未完成正常模型测试，请核对返回状态]\n" : "";
      setTestOut(prefix + (data.reply || "（模型未返回内容）"));
    } catch {
      setTestOut("测试失败：网络或服务异常。");
    } finally {
      setTesting(false);
    }
  };

  if (loadState !== "ready" || instructionsLocked) return <section className="m-6 max-w-xl space-y-4">
    <h1 className="text-xl font-semibold">编辑智能体</h1>
    {loadState === "loading" ? <GenerationProgress label="正在载入智能体配置" />
      : <p role="alert">{instructionsLocked ? "此智能体已进入审核或发布流程，运行配置不可直接修改。请在目录撤回审核，或新建修订草稿。" : "未能载入智能体，可能是网络异常、资源不存在或无访问权限。未提交任何修改。"}</p>}
    <div className="flex gap-3"><Button asChild variant="outline"><Link href="/agent"><ArrowLeft size={14} />返回智能体目录</Link></Button>
      {loadState === "error" && <Button onClick={() => { setLoadState("loading"); setLoadAttempt(value => value + 1); }}>重新载入</Button>}</div>
  </section>;

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-2)] bg-[var(--card)]/40 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/agent" className="gap-1"><ArrowLeft size={14} /> 返回</Link>
          </Button>
          <div>
            <div className="text-[14px] font-semibold">{editId ? "编辑智能体" : "新建智能体"}</div>
            <div className="text-[12px] text-[var(--text-2)]">7 步配置 · 步骤 {step} / 7</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" disabled={submitting} onClick={() => submit(false)}><Save size={13} /> {editId ? "保存" : "暂存草稿"}</Button>
          <Button variant="grad" size="sm" className="gap-1" disabled={submitting} onClick={() => submit(true)}>
            <Sparkles size={13} /> {submitting ? "提交中…" : editId ? "保存并返回" : "创建并提交"}
          </Button>
        </div>
      </div>

      {notice && <p role="status" aria-live="polite" className="px-5 py-3 text-sm text-[var(--text-2)]">{notice}</p>}

      {submitting && (
        <div className="min-w-0 px-5 py-3">
          <GenerationProgress label="正在提交智能体配置" />
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[220px_1fr_360px] gap-0">
        {/* Steps sidebar */}
        <ScrollArea className="hidden xl:block border-r border-[var(--border-2)] bg-[var(--card)]/40 backdrop-blur-sm">
          <div className="p-4">
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition-colors",
                  step === s.id ? "bg-[var(--rg-selected-bg)] text-[var(--c-primary)]" : "hover:bg-[var(--rg-hover-bg)]"
                )}
              >
                <span className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold",
                  s.id < step ? "bg-[var(--c-growth)] text-white"
                    : step === s.id ? "bg-[var(--c-primary)] text-white"
                    : "bg-[var(--rg-control-hover)] text-[var(--text-3)]"
                )}>
                  {s.id < step ? <Check size={12} strokeWidth={3} /> : s.id}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight">{s.title}</div>
                  <div className="text-[11px] text-[var(--text-2)]">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Form */}
        <ScrollArea className="border-r border-[var(--border-2)]">
          <div className="space-y-5 p-5 md:p-7 max-w-3xl">
            <div className="surface-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">步骤 {step} / 7</div>
              <h2 className="mt-1 text-[18px] font-semibold">{STEPS[step - 1].title}</h2>
              <p className="text-[13px] text-[var(--text-2)]">{STEPS[step - 1].desc}</p>
            </div>

            {step === 1 && (
              <div className="surface-card p-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field id="agent-name" label="智能体名称"><Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                  <Field id="agent-category" label="分类">
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="agent-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["教学", "科研", "行政", "学习"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field id="agent-intro" label="简介"><Textarea id="agent-intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} /></Field>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field id="agent-audience" label="使用对象">
                    <Select value={audience} onValueChange={setAudience}>
                      <SelectTrigger id="agent-audience"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["教师", "学生", "管理员", "全校用户"].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="智能体头像 / 图标">
                    <div className="flex flex-wrap gap-2">
                      {["BookOpen", "FileText", "BarChart3", "Users", "Bot", "Sparkles"].map((ic) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const Ic = (Icons as any)[ic] as React.ComponentType<{ size?: number }>;
                        return (
                          <button key={ic} type="button" onClick={() => setIcon(ic)} aria-label={`选择图标 ${ic}`} aria-pressed={icon === ic}
                            className={cn("grid h-10 w-10 place-items-center rounded-[12px] border bg-[var(--card)] hover:bg-[var(--rg-selected-bg)] hover:text-[var(--c-primary)]",
                              icon === ic ? "border-[var(--c-edu)] text-[var(--c-primary)] ring-2 ring-[var(--c-edu)]/30" : "border-[var(--border)] text-[var(--text-2)]")}>
                            <Ic size={16} />
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="surface-card p-5 space-y-4">
                <Label>选择底层模型</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {MODELS.map((mm) => (
                    <button
                      key={mm.id}
                      onClick={() => setModel(mm.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-[12px] border bg-[var(--card)] p-3 text-left transition",
                        model === mm.id ? "border-[var(--c-edu)] ring-2 ring-[var(--c-edu)]/30" : "border-[var(--border-2)] hover:border-[var(--c-edu)]/40"
                      )}
                    >
                      <div className="grid h-11 w-11 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(mm) }}>
                        <ModelGlyph id={mm.id} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold">{mm.name}</div>
                        <div className="text-[12px] text-[var(--text-2)] line-clamp-1">{mm.tags.join(" · ")}</div>
                      </div>
                      {model === mm.id && <Check size={16} className="text-[var(--c-edu)]" />}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <Label>温度（创造性）</Label>
                      <span className="text-num font-semibold">{temperature[0].toFixed(2)}</span>
                    </div>
                    <Slider thumbLabel="温度创造性" value={temperature} onValueChange={setTemperature} min={0} max={1} step={0.05} />
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <Label>最大上下文（k tokens）</Label>
                      <span className="text-num font-semibold">{maxContext[0]}K</span>
                    </div>
                    <Slider thumbLabel="最大上下文" value={maxContext} onValueChange={setMaxContext} min={4} max={128} step={4} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="surface-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>系统提示词</Label>
                  <NotYetAvailable why="从提示词中心导入到系统提示词的选择器未开通；可直接在下方编辑，或到提示词中心复制正文粘贴">+ 从提示词中心导入</NotYetAvailable>
                </div>
                <Textarea aria-label="系统提示词" maxLength={6000} disabled={instructionsLocked} value={system} onChange={(e) => setSystem(e.target.value)} rows={12} className="font-mono text-[13px] leading-[1.75]" />
                {instructionsLocked && <p className="text-xs text-[var(--text-2)]">审核中或已发布的任务指令不可直接修改；请先撤回审核，或新建修订草稿。</p>}
                <div className="flex gap-2 text-[13px]">
                  <Button variant="grad" size="sm" disabled={testing} onClick={runSystemTest} className="gap-1"><Send size={12} /> {testing ? "运行中…" : "运行测试（真实模型）"}</Button>
                </div>
                {(testing || testOut) && (
                  <div className="mt-1 rounded-[12px] border border-[var(--border-2)] bg-[var(--rg-hover-bg)] p-3 text-[13px] leading-[1.75]">
                    {testing ? (
                      <GenerationProgress label="正在生成测试回复" startedAt={testStartedAt} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans">{testOut}</pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="surface-card p-5 space-y-3">
                <Label>勾选可被本智能体调用的知识库</Label>
                {retainedKnowledgeBase && <p className="text-sm text-[var(--text-2)]">原有绑定：{retainedKnowledgeBase}。未选择替代项时保留原绑定。<Button variant="ghost" size="sm" onClick={() => setRetainedKnowledgeBase("")}>解除原绑定</Button></p>}
                <div className="space-y-2">
                  {KNOWLEDGE_BASES.map((k) => (
                    <label key={k.id} className="flex items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-3 transition hover:bg-[var(--rg-hover-bg)]">
                      <Checkbox checked={kbs.includes(k.id)} onCheckedChange={(v) =>
                        setKbs((cur) => v ? [...cur, k.id] : cur.filter((x) => x !== k.id))
                      } />
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold">{k.name}</div>
                        <div className="text-[12px] text-[var(--text-2)]">{k.role}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="surface-card p-5 space-y-2">
                <Label>工具权限（共 7 项）</Label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {TOOLS.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-[12px] border border-[var(--border-2)] p-3">
                      <span className="text-[13px]">{t.label}</span>
                      <Switch aria-label={t.label} checked={tools[t.id] || false} onCheckedChange={(v) => setTools((cur) => ({ ...cur, [t.id]: v }))} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 6 && (
              <fieldset disabled className="surface-card p-5 space-y-3">
                <p className="text-sm text-[var(--text-2)]">个体安全参数尚未接入，以下为配置参考，不会保存。实际隐私、日志与配额由平台策略统一控制。</p>
                <SwitchRow label="敏感信息检测"  desc="自动识别身份证号、手机号、学生隐私"
                  checked={security.sensitive} onChange={(v) => setSecurity((s) => ({ ...s, sensitive: v }))} />
                <SwitchRow label="学生隐私保护"  desc="禁止输出包含个体识别信息的内容"
                  checked={security.privacy} onChange={(v) => setSecurity((s) => ({ ...s, privacy: v }))} />
                <SwitchRow label="回答风险提醒"  desc="对涉及医学、法律等敏感场景给出免责提示"
                  checked={security.riskAlert} onChange={(v) => setSecurity((s) => ({ ...s, riskAlert: v }))} />
                <SwitchRow label="文件下载权限"  desc="导出 Word / PPT 需管理员审批"
                  checked={security.downloadGate} onChange={(v) => setSecurity((s) => ({ ...s, downloadGate: v }))} />
                <SwitchRow label="完整日志留存"  desc="所有对话写入审计日志，保留 180 天"
                  checked={security.log} onChange={(v) => setSecurity((s) => ({ ...s, log: v }))} />
                <div>
                  <div className="mb-2 flex items-center justify-between text-[13px]">
                    <Label>单用户每日调用配额</Label>
                    <span className="text-num font-semibold">{dailyQuota[0]} 次</span>
                  </div>
                  <Slider disabled thumbLabel="单用户每日调用配额" value={dailyQuota} onValueChange={setDailyQuota} min={10} max={1000} step={10} />
                </div>
              </fieldset>
            )}

            {step === 7 && (
              <div className="surface-card p-5 space-y-4">
                <Field id="agent-visibility" label="可见范围">
                  <Select disabled value={visibility} onValueChange={setVisibility}>
                    <SelectTrigger id="agent-visibility"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["私有", "课程内", "学院内", "全校"].map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-sm text-[var(--text-2)]">分课程 / 学院权限尚未接入。草稿仅创建者与管理员可见，审批发布后面向全校用户；不要提交含内部答案或个人隐私的指令。</p>
                <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border-2)] p-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">学校审核策略</div>
                    <div className="text-[12px] leading-5 text-[var(--text-2)]">
                      当前学校策略要求管理员审核后发布；如需稍后提交，请使用顶部「暂存草稿」。
                    </div>
                  </div>
                  <Badge variant="primary">必须审核</Badge>
                </div>
                <Field id="agent-version" label="版本号"><Input id="agent-version" value={version} onChange={(e) => setVersion(e.target.value)} /></Field>
                <div className="rounded-[12px] bg-[var(--ok-bg)] p-3 text-[12px] text-[var(--ok-ink)]">
                  <ShieldCheck className="inline" size={13} /> 配置完成后将提交管理员审核；审核通过后才会面向师生开放。
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Test panel */}
        <div className="flex flex-col bg-[var(--card)]/50 backdrop-blur-sm">
          <div className="border-b border-[var(--border-2)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(m) }}>
                  <ModelGlyph id={m.id} size={16} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold">实时测试 · {name}</div>
                  <div className="text-[11px] text-[var(--text-2)]">使用 {m.name} · {kbs.length} 个知识库</div>
                </div>
              </div>
              <Badge variant={testing ? "primary" : "green"}>{testing ? "测试中" : "● 就绪"}</Badge>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2 text-[12px]">
              <div className="rounded-[12px] bg-[var(--card)] border border-[var(--border-2)] p-2.5">{panelInput || "（在下方输入测试问题）"}</div>
              <div className="text-[11px] text-[var(--text-3)]">{m.name} · 使用当前系统提示词（第 3 步）· 走真实 /api/chat</div>
              {testing ? (
                <div className="rounded-[12px] p-3 text-[var(--text-2)]" style={{ backgroundImage: "linear-gradient(135deg,var(--rg-selected-bg),var(--rg-hover-bg))" }}>
                  <GenerationProgress label="正在生成测试回复" startedAt={testStartedAt} />
                </div>
              ) : testOut ? (
                <div className="rounded-[12px] p-3 leading-[1.7]" style={{ backgroundImage: "linear-gradient(135deg,var(--rg-selected-bg),var(--rg-hover-bg))" }}>
                  <pre className="whitespace-pre-wrap font-sans text-[12px] text-[var(--text)]">{testOut}</pre>
                </div>
              ) : (
                <div className="rounded-[12px] border border-dashed border-[var(--border)] p-4 text-center text-[var(--text-3)]">点击发送，用真实模型测试当前配置</div>
              )}
              <div className="mt-1 text-[11px] text-[var(--text-3)]">注：本测试同样经服务端未成年人安全策略把关；不显示编造的 token/耗时数据。</div>
            </div>
          </ScrollArea>

          <div className="border-t border-[var(--border-2)] p-3 flex gap-2">
            <input value={panelInput} onChange={(e) => setPanelInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void runPanelTest(); } }} aria-label="测试问题" className="h-9 flex-1 rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[13px] outline-none placeholder:text-[var(--text-3)]" placeholder="输入测试问题…" />
            <Button variant="grad" size="sm" disabled={testing || !panelInput.trim()} onClick={runPanelTest} className="px-3" aria-label="发送测试问题"><Send size={13} /></Button>
          </div>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-[var(--border-2)] bg-[var(--card)]/40 px-5 py-3 backdrop-blur-sm">
        <div className="text-[12px] text-[var(--text-2)]">步骤 {step} / 7</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="gap-1">
            <ArrowLeftCircle size={13} /> 上一步
          </Button>
          {step < 7 ? (
            <Button variant="grad" size="sm" onClick={() => setStep((s) => Math.min(7, s + 1))} className="gap-1">
              下一步 <ArrowRight size={13} />
            </Button>
          ) : (
            <Button variant="grad" size="sm" className="gap-1" disabled={submitting} onClick={() => submit(true)}>
              <Sparkles size={13} /> {submitting ? "提交中…" : editId ? "保存并返回" : "创建并提交审核"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewAgentPage() {
  return (
    <React.Suspense fallback={null}>
      <NewAgentRoute />
    </React.Suspense>
  );
}

function NewAgentRoute() {
  const search = useSearchParams();
  return <NewAgentInner key={search.get("id") ?? search.get("template") ?? "new"} />;
}

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  const labeledChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const props = child.props as { "aria-label"?: string };
    if (props["aria-label"]) return child;
    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, { "aria-label": label });
  });

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {labeledChildren}
    </div>
  );
}

function SwitchRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-[var(--border-2)] p-3">
      <div>
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[12px] text-[var(--text-2)]">{desc}</div>
      </div>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant?: "green" | "primary" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
      variant === "green" && "bg-[var(--ok-bg)] text-[var(--ok-ink)]",
      variant === "primary" && "bg-[var(--rg-selected-bg)] text-[var(--info-ink)]",
      !variant && "bg-[var(--rg-control-bg)] text-[var(--text-2)]"
    )}>{children}</span>
  );
}
