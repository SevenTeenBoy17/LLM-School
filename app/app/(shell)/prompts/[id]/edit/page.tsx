"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PROMPT_CATEGORIES } from "@/lib/data/prompts";
import { MODELS } from "@/lib/data/models";
import { apiGetPrompt, apiListPrompts, apiUpdatePrompt } from "@/lib/client/libraryApi";
import type { DifficultyLevel, ModelProvider, PromptCategory, PromptVariable } from "@/lib/types";
import { PromptTestPanel } from "@/components/prompts/PromptTestPanel";

type LoadState = "loading" | "ready" | "denied" | "missing";

const SCENE_BY_CAT: Record<string, string> = {
  teach: "教学",
  ppt: "课件",
  quiz: "评价",
  research: "科研",
  study: "学习",
  admin: "行政",
};

export default function EditPromptPage() {
  const router = useRouter();
  const params = useParams<Record<string, string | string[]>>();
  const promptId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  }, [params]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"pub" | "draft">("draft");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PromptCategory>("teach");
  const [scene, setScene] = useState("教学");
  const [role, setRole] = useState("教师");
  const [level, setLevel] = useState<DifficultyLevel>("进阶");
  const [model, setModel] = useState<ModelProvider>("claude");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [outputExample, setOutputExample] = useState("");
  const [variables, setVariables] = useState<PromptVariable[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!promptId) {
        setLoadState("missing");
        return;
      }
      setLoadState("loading");
      const [prompt, viewer] = await Promise.all([apiGetPrompt(promptId), apiListPrompts()]);
      if (!alive) return;
      if (!prompt) {
        setLoadState("missing");
        return;
      }
      if (!prompt.ownerId || prompt.ownerId !== viewer.userId) {
        setLoadState("denied");
        return;
      }
      setTitle(prompt.title);
      setCategory(prompt.category);
      setScene(prompt.scene);
      setRole(prompt.role);
      setLevel(prompt.level);
      setModel(prompt.recommendedModel);
      setDescription(prompt.description);
      setBody(prompt.body ?? "");
      setOutputExample(prompt.outputExample ?? "");
      setVariables(prompt.variables ?? []);
      setStatus(prompt.status ?? "pub");
      setLoadState("ready");
    })();
    return () => {
      alive = false;
    };
  }, [promptId]);

  const updateVariable = (i: number, patch: Partial<PromptVariable>) =>
    setVariables((cur) => cur.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const addVariable = () => setVariables((cur) => [...cur, { key: "", defaultValue: "" }]);
  const removeVariable = (i: number) => setVariables((cur) => cur.filter((_, idx) => idx !== i));

  const save = async (nextStatus: "pub" | "draft") => {
    if (!title.trim()) {
      setNotice("请填写模板标题");
      return;
    }
    setSubmitting(true);
    setNotice("");
    const updated = await apiUpdatePrompt(promptId, {
      title: title.trim(),
      category,
      scene: scene.trim() || "教学",
      role: role.trim() || "教师",
      recommendedModel: model,
      level,
      description: description.trim() || title.trim(),
      body,
      outputExample: outputExample.trim() || undefined,
      status: nextStatus,
      variables: variables
        .filter((v) => v.key.trim())
        .map((v) => ({ key: v.key.trim(), defaultValue: v.defaultValue, placeholder: v.placeholder })),
    });
    setSubmitting(false);
    if (!updated) {
      setNotice("保存失败，请确认自己仍有编辑权限后重试");
      return;
    }
    setStatus(updated.status ?? nextStatus);
    if (nextStatus === "pub") {
      setNotice("已发布到校内提示词中心");
      router.push("/prompts");
      return;
    }
    setNotice("已保存草稿，仅自己可见");
  };

  if (loadState !== "ready") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="surface-card max-w-md p-6 text-center">
          <div className="text-[14px] font-semibold">
            {loadState === "loading" ? "正在加载提示词" : loadState === "denied" ? "无法编辑此提示词" : "提示词不存在"}
          </div>
          <p className="mt-2 text-[13px] leading-6 text-[var(--text-2)]">
            {loadState === "loading"
              ? "请等待模板数据从服务端返回。"
              : loadState === "denied"
                ? "只能编辑自己创建的提示词，公开模板和他人模板不可修改。"
                : "该模板可能已被删除，或当前账号无权查看。"}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/prompts">返回提示词中心</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-2)] bg-[var(--card)]/40 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/prompts" className="gap-1"><ArrowLeft size={14} /> 返回</Link>
          </Button>
          <div>
            <div className="text-[14px] font-semibold">编辑提示词模板</div>
            <div className="text-[12px] text-[var(--text-2)]">
              当前状态：{status === "draft" ? "草稿，仅自己可见" : "已发布，校内可用"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {notice && <span role="status" aria-live="polite" className="text-[12px] text-[var(--text-2)]">{notice}</span>}
          <Button variant="outline" size="sm" className="gap-1" disabled={submitting} onClick={() => save("draft")}>
            <Save size={13} /> 保存草稿
          </Button>
          <Button variant="grad" size="sm" className="gap-1" disabled={submitting} onClick={() => save("pub")}>
            <Sparkles size={13} /> {status === "draft" ? "发布模板" : "保存发布版"}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[1.35fr_0.95fr]">
        <ScrollArea className="border-r border-[var(--border-2)]">
          <div className="space-y-5 p-5 md:p-7">
            <Section title="基础信息">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field id="prompt-title" label="模板标题">
                  <Input id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </Field>
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
                <Field id="prompt-scene" label="场景标签">
                  <Input id="prompt-scene" value={scene} onChange={(e) => setScene(e.target.value)} />
                </Field>
                <Field id="prompt-role" label="适用角色">
                  <Input id="prompt-role" value={role} onChange={(e) => setRole(e.target.value)} />
                </Field>
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
                <div className="md:col-span-2">
                  <Field id="prompt-desc" label="一句话说明">
                    <Input id="prompt-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="变量定义" action={
              <Button size="sm" variant="ghost" onClick={addVariable} className="gap-1"><Plus size={13} /> 添加变量</Button>
            }>
              <div className="space-y-2">
                {variables.map((v, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr_44px] items-center gap-2">
                    <Input aria-label={`变量 ${i + 1} 名称`} placeholder="变量名" value={v.key} onChange={(e) => updateVariable(i, { key: e.target.value })} />
                    <Input aria-label={`变量 ${i + 1} 默认值`} placeholder="默认值" value={v.defaultValue} onChange={(e) => updateVariable(i, { defaultValue: e.target.value })} />
                    <button
                      type="button"
                      onClick={() => removeVariable(i)}
                      className="grid h-11 w-11 place-items-center rounded-[12px] text-[var(--text-3)] hover:bg-[var(--err-bg)] hover:text-[var(--c-alert)]"
                      aria-label={`删除变量 ${i + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {variables.length === 0 && (
                  <div className="rounded-[12px] border border-dashed border-[var(--border)] p-4 text-center text-[12px] text-[var(--text-3)]">
                    暂无变量。可用 <code className="rounded bg-[var(--code-inline-bg)] px-1">{`{变量名}`}</code> 作为占位符。
                  </div>
                )}
              </div>
            </Section>

            <Section title="提示词正文">
              <Textarea id="prompt-body" aria-label="提示词正文" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[320px] font-mono text-[13px] leading-[1.75]" />
            </Section>

            <Section title="输出格式要求（可选）">
              <Textarea aria-label="输出格式要求" placeholder="例如：Markdown 表格、固定栏目、最后附检查清单" value={outputExample} onChange={(e) => setOutputExample(e.target.value)} rows={3} className="min-h-[80px]" />
            </Section>
          </div>
        </ScrollArea>

        <aside className="flex min-h-0 flex-col bg-[var(--card)]/50 backdrop-blur-sm">
          <PromptTestPanel body={body} model={model} variables={variables} outputExample={outputExample} />
          <div className="border-t border-[var(--border-2)] p-4">
            <div className="surface-card p-4">
              <div className="text-[13px] font-semibold">发布前检查</div>
              <div className="mt-3 space-y-3 text-[13px] leading-6 text-[var(--text-2)]">
                <CheckLine ok={title.trim().length > 0} text="标题清晰，方便教师搜索和复用" />
                <CheckLine ok={description.trim().length > 0} text="说明能够交代模板用途" />
                <CheckLine ok={body.trim().length >= 20} text="正文包含足够上下文和输出要求" />
                <CheckLine ok={variables.every((v) => !v.key.trim() || body.includes(`{${v.key.trim()}}`))} text="变量名与正文占位符保持一致" />
              </div>
              <div className="mt-5 rounded-[12px] bg-[var(--rg-hover-bg)] p-3 text-[12px] leading-6 text-[var(--text-2)]">
                草稿只对创建者可见；发布后，校内已登录角色可以查看和使用，但仍不能编辑你的模板。
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="surface-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
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

function CheckLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={ok ? "mt-0.5 text-[var(--c-growth)]" : "mt-0.5 text-[var(--warn-ink)]"}>{ok ? "✓" : "!"}</span>
      <span>{text}</span>
    </div>
  );
}
