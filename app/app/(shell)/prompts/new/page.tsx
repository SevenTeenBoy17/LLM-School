"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PROMPT_CATEGORIES } from "@/lib/data/prompts";
import { MODELS } from "@/lib/data/models";
import { apiCreatePrompt } from "@/lib/client/libraryApi";
import type { PromptCategory, DifficultyLevel, ModelProvider } from "@/lib/types";
import { PromptTestPanel } from "@/components/prompts/PromptTestPanel";

interface Variable { key: string; defaultValue: string }

const SCENE_BY_CAT: Record<string, string> = { teach: "教学", ppt: "课件", quiz: "评价", research: "科研", study: "学习", admin: "行政" };

export default function NewPromptPage() {
  const router = useRouter();
  const [title, setTitle] = useState("生成一份高质量课堂教学设计");
  const [category, setCategory] = useState<PromptCategory>("teach");
  const [scene, setScene] = useState("教学");
  const [role, setRole] = useState("教师");
  const [level, setLevel] = useState<DifficultyLevel>("进阶");
  const [description, setDescription] = useState("按学情与课程标准生成完整教案，包含教学目标、活动设计与评价方案。");
  const [tags, setTags] = useState<string[]>(["教学", "教师", "推荐"]);
  const [model, setModel] = useState<ModelProvider>("claude");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [outputExample, setOutputExample] = useState("");
  const [variables, setVariables] = useState<Variable[]>([
    { key: "学科", defaultValue: "信息科技" },
    { key: "年级", defaultValue: "七年级" },
    { key: "主题", defaultValue: "生成式 AI 基本概念" },
  ]);
  const [body, setBody] = useState(`你是一名经验丰富的{学科}教师，
正在为{年级}学生设计一节关于「{主题}」的教学方案。
请输出结构化教案，包含：
1. 教学目标（核心素养维度）
2. 教学重难点
3. 课堂活动流程（导入 / 探究 / 应用 / 总结）
4. 学习评价方式
要求：语言适合学生理解，避免生成不符合学校规范的内容。`);
  const addVariable = () => setVariables((v) => [...v, { key: "", defaultValue: "" }]);
  const updateVariable = (i: number, patch: Partial<Variable>) =>
    setVariables((v) => v.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removeVariable = (i: number) =>
    setVariables((v) => v.filter((_, idx) => idx !== i));

  const buildInput = (status: "pub" | "draft") => ({
    title: title.trim(), category, scene: scene.trim() || "教学", role: role.trim() || "教师",
    recommendedModel: model, level, description: description.trim() || title.trim(),
    body, status, outputExample: outputExample.trim() || undefined,
    variables: variables.filter((v) => v.key.trim()).map((v) => ({ key: v.key.trim(), defaultValue: v.defaultValue })),
  });

  const submit = async (redirect: boolean) => {
    if (!title.trim()) { setNotice("请填写模板标题"); return; }
    setSubmitting(true);
    setNotice("");
    const created = await apiCreatePrompt(buildInput(redirect ? "pub" : "draft"));
    setSubmitting(false);
    if (!created) { setNotice("保存失败，请检查必填项后重试"); return; }
    if (redirect) router.push("/prompts");
    else setNotice(`已保存草稿「${created.title}」，仅自己可见`);
  };

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-2)] bg-[var(--card)]/40 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/prompts" className="gap-1"><ArrowLeft size={14} /> 返回</Link>
          </Button>
          <div>
            <div className="text-[14px] font-semibold">新建提示词模板</div>
            <div className="text-[12px] text-[var(--text-2)]">左侧编辑 · 右侧测试运行 · 验证后可发布</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notice && <span role="status" aria-live="polite" className="text-[12px] text-[var(--text-2)]">{notice}</span>}
          <Button variant="outline" size="sm" className="gap-1" disabled={submitting} onClick={() => submit(false)}><Save size={13} /> 暂存草稿</Button>
          <Button variant="grad" size="sm" className="gap-1" disabled={submitting} onClick={() => submit(true)}><Sparkles size={13} /> {submitting ? "提交中…" : "提交发布"}</Button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-0">
        <ScrollArea className="border-r border-[var(--border-2)]">
          <div className="space-y-5 p-5 md:p-7 max-w-3xl">
            <Section title="基础信息">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field id="prompt-title" label="模板标题"><Input id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
                <Field id="prompt-category" label="分类">
                  <Select value={category} onValueChange={(v) => { setCategory(v as PromptCategory); setScene(SCENE_BY_CAT[v] ?? scene); }}>
                    <SelectTrigger id="prompt-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROMPT_CATEGORIES.filter((c) => c.id !== "all" && c.id !== "featured" && c.id !== "star").map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="prompt-scene" label="场景标签"><Input id="prompt-scene" value={scene} onChange={(e) => setScene(e.target.value)} placeholder="如：教学 / 科研 / 行政" /></Field>
                <Field id="prompt-role" label="适用角色"><Input id="prompt-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="如：教师 / 学生 / 研究生" /></Field>
                <Field id="prompt-level" label="难度">
                  <Select value={level} onValueChange={(v) => setLevel(v as DifficultyLevel)}>
                    <SelectTrigger id="prompt-level"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["入门", "进阶", "专家"] as DifficultyLevel[]).map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="prompt-model" label="推荐模型">
                  <Select value={model} onValueChange={(v) => setModel(v as ModelProvider)}>
                    <SelectTrigger id="prompt-model"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODELS.filter((m) => m.id !== "gpt-image").map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="prompt-desc" label="一句话说明"><Input id="prompt-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="这个模板用来做什么" /></Field>
                <Field id="prompt-tags" label="标签（逗号分隔，仅展示）">
                  <Input
                    id="prompt-tags"
                    value={tags.join(", ")}
                    onChange={(e) => setTags(e.target.value.split(/[,，]\s*/).filter(Boolean))}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tags.map((t) => (<Badge key={t} variant="primary">{t}</Badge>))}
                  </div>
                </Field>
              </div>
            </Section>

            <Section title="变量定义" action={
              <Button size="sm" variant="ghost" onClick={addVariable} className="gap-1"><Plus size={13} /> 添加变量</Button>
            }>
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr_32px] items-center gap-2">
                    <Input aria-label={`变量 ${i + 1} 名称`} placeholder="变量名" value={v.key} onChange={(e) => updateVariable(i, { key: e.target.value })} />
                    <Input aria-label={`变量 ${i + 1} 默认值`} placeholder="默认值" value={v.defaultValue} onChange={(e) => updateVariable(i, { defaultValue: e.target.value })} />
                    <button onClick={() => removeVariable(i)} className="grid h-9 w-9 place-items-center rounded-[12px] text-[var(--text-3)] hover:bg-[var(--err-bg)] hover:text-[var(--c-alert)]" aria-label="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {variables.length === 0 && (
                  <div className="rounded-[12px] border border-dashed border-[var(--border)] p-4 text-center text-[12px] text-[var(--text-3)]">
                    尚未添加变量。变量将以 <code className="rounded bg-[var(--code-inline-bg)] px-1">{`{变量名}`}</code> 形式出现在 Prompt 正文中。
                  </div>
                )}
              </div>
            </Section>

            <Section title="提示词正文">
              <Textarea id="prompt-body" aria-label="提示词正文" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] font-mono text-[13px] leading-[1.75]" />
              <div className="mt-2 text-[11px] text-[var(--text-3)]">
                提示：用 <code className="rounded bg-[var(--code-inline-bg)] px-1">{`{变量名}`}</code> 占位，系统会在使用时自动替换。
              </div>
            </Section>

            <Section title="输出格式要求（可选）">
              <Textarea aria-label="输出格式要求" placeholder="例如：表格 + 课堂活动流程；语言风格严谨且适合课堂使用" value={outputExample} onChange={(e) => setOutputExample(e.target.value)} rows={3} className="min-h-[80px]" />
            </Section>
          </div>
        </ScrollArea>

        <PromptTestPanel body={body} model={model} variables={variables} outputExample={outputExample} />
      </div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="surface-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id?: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
