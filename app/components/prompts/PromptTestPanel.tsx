"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import type { ModelProvider } from "@/lib/types";

type PromptVariableLike = {
  key: string;
  defaultValue: string;
};

type TestMeta = {
  kind: string;
  source?: string;
  durationMs?: number;
};

interface PromptTestPanelProps {
  body: string;
  model: ModelProvider;
  variables: PromptVariableLike[];
  outputExample?: string;
  initialInput?: string;
}

export function PromptTestPanel({
  body,
  model,
  variables,
  outputExample = "",
  initialInput = "请按上面的变量生成完整教案",
}: PromptTestPanelProps) {
  const [testInput, setTestInput] = useState(initialInput);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testMeta, setTestMeta] = useState<TestMeta | null>(null);
  const [running, setRunning] = useState(false);

  const runTest = async () => {
    if (running) return;
    setRunning(true);
    setTestOutput(null);
    setTestMeta(null);
    const varsMap = Object.fromEntries(variables.filter((v) => v.key).map((v) => [v.key, v.defaultValue]));
    const resolved = body.replace(/\{([^}]+)\}/g, (m, k) => (varsMap[k]?.trim() ? varsMap[k] : m));
    const outputRequirement = outputExample.trim();
    const message = [
      resolved,
      outputRequirement ? `输出格式要求：\n${outputRequirement}` : "",
      testInput.trim(),
    ].filter(Boolean).join("\n\n");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, modelId: model }),
      });
      if (!res.ok) throw new Error(`chat_${res.status}`);
      const data = (await res.json()) as { reply?: string; kind?: string; source?: string; durationMs?: number };
      setTestOutput(data.reply || "（模型未返回内容）");
      setTestMeta({ kind: data.kind || "normal", source: data.source, durationMs: data.durationMs });
    } catch {
      setTestOutput("测试失败：网络不可达或服务异常，请稍后重试。");
      setTestMeta({ kind: "error" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--card)]/50 backdrop-blur-sm">
      <div className="border-b border-[var(--border-2)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold">实时测试</div>
            <div className="text-[11px] text-[var(--text-2)]">填写变量并运行，验证 Prompt 效果</div>
          </div>
          <Button onClick={runTest} disabled={running} variant="grad" size="sm" className="gap-1">
            <Play size={13} /> {running ? "运行中…" : "运行测试"}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <Field id="prompt-test-input" label="测试输入">
            <Textarea id="prompt-test-input" value={testInput} onChange={(e) => setTestInput(e.target.value)} rows={2} />
          </Field>

          <Field label="AI 输出预览">
            <div className="min-h-[200px] rounded-[12px] border border-[var(--border-2)] bg-[var(--rg-hover-bg)] p-4 text-[13px] leading-[1.75]">
              {running ? (
                <GenerationProgress label="正在生成测试输出" />
              ) : testOutput ? (
                <pre className="whitespace-pre-wrap font-sans">{testOutput}</pre>
              ) : (
                <div className="text-[var(--text-3)]">点击「运行测试」生成 AI 输出预览</div>
              )}
            </div>
          </Field>

          {testMeta && (
            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <div className="rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2">
                <div className="text-[var(--text-3)]">来源</div>
                <div className="text-[13px] font-semibold">{testMeta.source === "remote" ? "真实模型网关" : testMeta.source ? "本地兜底" : "—"}</div>
              </div>
              <div className="rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2">
                <div className="text-[var(--text-3)]">耗时</div>
                <div className="text-[13px] font-semibold">{typeof testMeta.durationMs === "number" ? `${(testMeta.durationMs / 1000).toFixed(1)}s` : "—"}</div>
              </div>
              <div className="rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2">
                <div className="text-[var(--text-3)]">安全判定</div>
                <div className="text-[13px] font-semibold">{testMeta.kind === "normal" ? "常规通过" : testMeta.kind === "scaffold" ? "学术诚信引导" : testMeta.kind === "care" ? "情绪关怀" : testMeta.kind === "crisis" ? "危机干预" : "失败"}</div>
              </div>
            </div>
          )}

          {testMeta && testMeta.kind === "normal" && (
            <div className="rounded-[12px] border border-[var(--c-growth)]/30 bg-[var(--ok-bg)] px-3 py-2 text-[12px] text-[var(--ok-ink)]">
              ✓ 本次输出经服务端安全策略判定为常规内容
            </div>
          )}
          {testMeta && (testMeta.kind === "scaffold" || testMeta.kind === "care" || testMeta.kind === "crisis") && (
            <div className="rounded-[12px] border border-[var(--warn-ink)]/30 bg-[var(--warn-bg)] px-3 py-2 text-[12px] text-[var(--warn-ink)]">
              ⚠ 服务端安全策略已介入（{testMeta.kind === "crisis" ? "危机干预" : testMeta.kind === "care" ? "情绪关怀" : "学术诚信引导"}）——该提示词在此输入下会触发校内安全响应，请调整后再用。
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
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
