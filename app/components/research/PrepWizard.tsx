"use client";

/**
 * 教师端三步向导（方案 §5 P4 / V4a）——「选模板 → 填 1-2 个必填 → 结果预览 + 微调折叠」。
 *
 * 两条硬约束，都不是装饰性要求：
 *
 * ① **安全/隐私三项（可见范围 / 是否留痕 / 模型来源）不得进折叠区。**
 *    §7.2 不可折叠白名单。这里的执行方式不是「我记得别放进去」，而是：三项都带
 *    `data-safety-critical` 标记，而 `<Collapsible>` 在渲染前会遍历子树、发现该标记就 throw
 *    （见 components/ui/collapsible.tsx）。**把口头约定变成会爆炸的约束**——
 *    这样即使后来有人「顺手把它们收进微调区省点空间」，开发环境立刻炸给他看。
 *
 * ② **键盘可达 + 焦点管理正确。**
 *    向导最常见的无障碍失败不是「按不到」，而是**换步之后焦点还留在已消失的按钮上**，
 *    屏幕阅读器用户完全不知道页面变了。这里每次换步把焦点移到当前步标题
 *    （`tabIndex={-1}` 的 h3），并用 `aria-live` 播报步骤变化。
 *
 * 数据全部来自真实模板池（`/api/prompts`），不编造模板。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/collapsible";
import { modelById } from "@/lib/data/models";
import type { ClientPrompt } from "@/lib/client/libraryApi";

const STEPS = ["选模板", "填必填项", "预览并开始"] as const;

/** 正文里的占位符 `{某某}`，按首次出现顺序去重。 */
export function bodySlots(body: string): string[] {
  const found = body.match(/\{([^{}\n]{1,20})\}/g) ?? [];
  return [...new Set(found.map((m) => m.slice(1, -1).trim()))].filter(Boolean);
}

/**
 * 取本模板的必填项，**最多两个**（§5 P4：「填 1-2 个必填」）。
 *
 * 为什么设上限：向导的价值就在于**把长表单砍成两问**。全列出来它就退化成又一个表单页，
 * 三步结构反而变成三层阻碍。
 *
 * ⚠️ 为什么是从**正文占位符**反推，而不是直接取 `variables[0..1]`：
 * 首版就是盲取前两个，实测立刻出问题——种子模板「高质量课堂教学设计生成」声明的
 * variables 是 `课程名称/年级/主题/课时/输出格式`，而正文里的占位符是
 * `{学科}/{年级}/{主题}/{课时}`：**`课程名称` 在正文里根本不存在**，
 * 于是老师认认真真填的第一项对输出毫无影响，正文里的 `{学科}` 还原样留着。
 *
 * 「取列表前两项」是「取最重要的两项」的**代用指标**——这里代用错了。
 * 改为以正文真正用到的槽位为准，并优先问**没有默认值**的那些（有默认值的可以先用着）。
 */
function requiredFields(t: ClientPrompt | null): { key: string; label: string; placeholder: string }[] {
  if (!t) return [];
  const declared = new Map((t.variables ?? []).map((v) => [v.key, v]));
  const slots = bodySlots(t.body || "");
  if (slots.length > 0) {
    const noDefault = slots.filter((s) => !declared.get(s)?.defaultValue);
    const pick = (noDefault.length ? noDefault : slots).slice(0, 2);
    return pick.map((key) => {
      const v = declared.get(key);
      return { key, label: key, placeholder: v?.placeholder || v?.defaultValue || `请填写${key}` };
    });
  }
  // 正文没有占位符：退回声明的变量；再没有就给两个通用问题（任何一份教案都要回答）。
  const vars = (t.variables ?? []).slice(0, 2);
  if (vars.length > 0) {
    return vars.map((v) => ({ key: v.key, label: v.key, placeholder: v.placeholder || v.defaultValue || `请填写${v.key}` }));
  }
  return [
    { key: "授课班级", label: "授课班级", placeholder: "例：初三(3)班" },
    { key: "本节课题", label: "本节课题", placeholder: "例：算法与程序实现 · 第一课时" },
  ];
}

/**
 * 把模板正文 + 填写值 + 微调项组装成最终提示词。纯函数，便于单测与预览一致。
 *
 * 占位符处理三档，按「不编造」优先：
 *   ① 老师填了 → 用填的；
 *   ② 没填但模板声明了默认值 → 用默认值；
 *   ③ 两者都没有 → **保留 `{槽位}` 并显式要求模型先问**，而不是让它自己猜一个。
 * 第 ③ 档是关键：把一个空槽悄悄留给模型，它多半会编一个看起来合理的学科/年级填进去，
 * 而老师拿到的是一份**基于虚构前提**的教案——这比留个花括号糟糕得多。
 */
export function composePrompt(
  template: ClientPrompt | null,
  values: Record<string, string>,
  tune: { tone: string; length: string },
): string {
  if (!template) return "";
  const raw = (template.body || template.description || template.title || "").trim();
  const declared = new Map((template.variables ?? []).map((v) => [v.key, v]));
  const unresolved: string[] = [];

  const base = raw.replace(/\{([^{}\n]{1,20})\}/g, (whole, key: string) => {
    const k = key.trim();
    const typed = (values[k] ?? "").trim();
    if (typed) return typed;
    const def = declared.get(k)?.defaultValue?.trim();
    if (def) return def;
    unresolved.push(k);
    return whole;
  });

  // 声明了、但正文里没有对应槽位的变量：只有老师填了才附上，避免塞一堆空条件。
  const extra = Object.entries(values)
    .filter(([k, v]) => v.trim() && !raw.includes(`{${k}}`))
    .map(([k, v]) => `${k}：${v.trim()}`)
    .join("\n");

  const tuning = [tune.tone && `语气：${tune.tone}`, tune.length && `篇幅：${tune.length}`]
    .filter(Boolean)
    .join("\n");

  const ask = unresolved.length
    ? `\n【待确认】以下信息我还没提供：${[...new Set(unresolved)].join("、")}。请先向我确认，**不要自行假设**。`
    : "";

  return [base, extra && `\n【本次条件】\n${extra}`, tuning && `\n【呈现要求】\n${tuning}`, ask]
    .filter(Boolean)
    .join("\n");
}

export function PrepWizard({ templates }: { templates: ClientPrompt[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<ClientPrompt | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tone, setTone] = useState("");
  const [length, setLength] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const fields = useMemo(() => requiredFields(picked), [picked]);
  const allFilled = fields.every((f) => (values[f.key] ?? "").trim().length > 0);
  const preview = useMemo(
    () => composePrompt(picked, values, { tone, length }),
    [picked, values, tone, length],
  );

  // 焦点管理：每次换步把焦点移到当前步标题。
  // 不这么做的话，点「下一步」之后焦点仍停在那个已经被替换掉的按钮上，
  // 屏幕阅读器用户不会收到任何「页面变了」的信号——这是向导最常见的无障碍失败。
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const model = picked ? modelById(picked.recommendedModel) : null;

  const go = (next: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, next)));

  return (
    <section
      aria-labelledby="prep-wizard-title"
      data-testid="prep-wizard"
      className="surface-card overflow-hidden"
    >
      <header className="border-b border-[var(--border-2)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="prep-wizard-title" className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            <WandSparkles size={16} className="text-[var(--accent-focus)]" /> 三步开始备课
          </h2>
          {/* 步骤条。用 ol + aria-current="step"，而不是一排纯装饰的圆点——
              装饰性圆点对屏幕阅读器等于不存在，用户不知道自己在第几步。 */}
          <ol className="flex items-center gap-1.5" aria-label="备课向导进度">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  aria-current={i === step ? "step" : undefined}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition " +
                    (i === step
                      ? "bg-[var(--accent-tint)] font-semibold text-[var(--accent-focus)]"
                      : i < step
                        ? "text-[var(--ok-ink)]"
                        : "text-[var(--text-3)]")
                  }
                >
                  {i < step ? <Check size={12} aria-hidden /> : <span aria-hidden>{i + 1}</span>}
                  {label}
                </span>
                {i < STEPS.length - 1 && <span aria-hidden className="text-[var(--text-3)]">·</span>}
              </li>
            ))}
          </ol>
        </div>
        {/* 换步播报。视觉上冗余，对屏幕阅读器不是。 */}
        <p className="sr-only" aria-live="polite">
          第 {step + 1} 步，共 {STEPS.length} 步：{STEPS[step]}
        </p>
      </header>

      <div className="p-5">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-[14px] font-semibold text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-focus)]/40"
        >
          {step === 0 && "① 选一个模板"}
          {step === 1 && "② 填两项就够"}
          {step === 2 && "③ 确认后开始对话"}
        </h3>

        {step === 0 && (
          <div className="mt-3">
            {templates.length === 0 ? (
              <p className="text-[13px] text-[var(--text-2)]">
                模板池还是空的——先到「贡献新模板」建一个，向导会直接读到它。
              </p>
            ) : (
              <div role="radiogroup" aria-label="备课模板" className="grid gap-2 md:grid-cols-2">
                {templates.map((t) => {
                  const on = picked?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      data-testid={`prep-tpl-${t.id}`}
                      onClick={() => { setPicked(t); setValues({}); }}
                      className={
                        "rounded-[12px] border p-3 text-left transition min-h-[44px] " +
                        (on
                          ? "border-[var(--accent-focus)] bg-[var(--accent-tint)] ring-2 ring-[var(--accent-focus)]/20"
                          : "border-[var(--border-2)] hover:border-[var(--accent-focus)]/40")
                      }
                    >
                      <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{t.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-[12px] leading-snug text-[var(--text-2)]">
                        {t.scene || t.description || t.category}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-[var(--text-2)]">
              只问最影响结果的两项，其余留给对话里继续改。
            </p>
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-[13px] font-semibold text-[var(--text)]">
                  {f.label}
                  <span className="ml-1 text-[var(--err-ink)]" aria-hidden>*</span>
                  <span className="sr-only">（必填）</span>
                </span>
                <input
                  required
                  data-testid={`prep-field-${f.key}`}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="min-h-[44px] w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)] outline-none transition focus:border-[var(--accent-focus)] focus:ring-2 focus:ring-[var(--accent-focus)]/20"
                />
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="mt-3 space-y-3">
            <div>
              <div className="mb-1 text-[12px] text-[var(--text-2)]">将发送给 AI 的内容（可在对话里继续改）</div>
              <pre
                data-testid="prep-preview"
                className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-[12px] bg-[var(--rg-control-bg)] p-3 text-[12px] leading-relaxed text-[var(--text)]"
              >
                {preview}
              </pre>
            </div>

            {/* ⚠️ 安全/隐私三项**常驻可见**，绝不进下面的折叠区（§7.2）。
                三项都带 data-safety-critical：Collapsible 会在渲染前遍历子树，
                一旦发现该标记就 throw。约定因此变成了会爆炸的约束，而不是一句注释。 */}
            <div className="rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text)]">
                <ShieldCheck size={14} className="text-[var(--accent-focus)]" /> 开始前请知悉
              </div>
              <ul className="space-y-1 text-[12px] leading-relaxed text-[var(--text-2)]">
                <li data-safety-critical="wizard-scope">
                  <b className="text-[var(--text)]">可见范围：</b>生成结果进入你个人的对话记录，不会自动共享给学生或同事。
                </li>
                <li data-safety-critical="wizard-trace">
                  <b className="text-[var(--text)]">是否留痕：</b>对话正文会保存在校内数据库；审计日志另记调用事实（时间 / 路径 / 结果），不含正文。
                </li>
                <li data-safety-critical="wizard-model">
                  <b className="text-[var(--text)]">模型来源：</b>
                  {model ? `本次将用 ${model.name}` : "本次将用平台默认模型"}
                  ，进入对话后可随时切换；若网关不可用会降级为本地兜底并在回复上标注。
                </li>
              </ul>
            </div>

            {/* 微调项可以折叠——它们只影响文风，答错了也就是重写一遍。
                这正是折叠的正当用途：**代价可逆的选项**才可以藏起来。 */}
            <Collapsible
              data-testid="prep-tune"
              icon={<Sparkles size={14} />}
              title="微调（可选）"
              summary="语气与篇幅，不填就按模板默认来"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] text-[var(--text-2)]">语气</span>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="min-h-[44px] w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)]"
                  >
                    <option value="">按模板默认</option>
                    <option value="平实、可直接照着讲">平实</option>
                    <option value="启发式、多设问">启发式</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] text-[var(--text-2)]">篇幅</span>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="min-h-[44px] w-full rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] text-[var(--text)]"
                  >
                    <option value="">按模板默认</option>
                    <option value="精简，控制在一页内">精简</option>
                    <option value="详细，含分层活动与时间分配">详细</option>
                  </select>
                </label>
              </div>
            </Collapsible>
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--border-2)] px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-1.5"
          data-testid="prep-back"
          disabled={step === 0}
          onClick={() => go(step - 1)}
        >
          <ArrowLeft size={14} /> 上一步
        </Button>

        {step < STEPS.length - 1 ? (
          <div className="flex items-center gap-2">
            {/* 「为什么按不了」必须说出来。只把按钮置灰是把原因留给用户猜。 */}
            {((step === 0 && !picked) || (step === 1 && !allFilled)) && (
              <span id="prep-next-why" className="text-[12px] text-[var(--text-3)]">
                {step === 0 ? "先选一个模板" : "两项都填完才能继续"}
              </span>
            )}
            <Button
              variant="grad"
              size="sm"
              className="min-h-[44px] gap-1.5"
              data-testid="prep-next"
              disabled={(step === 0 && !picked) || (step === 1 && !allFilled)}
              aria-describedby={(step === 0 && !picked) || (step === 1 && !allFilled) ? "prep-next-why" : undefined}
              onClick={() => go(step + 1)}
            >
              下一步 <ArrowRight size={14} />
            </Button>
          </div>
        ) : (
          <Button
            variant="grad"
            size="sm"
            className="min-h-[44px] gap-1.5"
            data-testid="prep-start"
            onClick={() => router.push(`/chat?seed=${encodeURIComponent(preview)}`)}
          >
            开始对话 <ArrowRight size={14} />
          </Button>
        )}
      </footer>
    </section>
  );
}
