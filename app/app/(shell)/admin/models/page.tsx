"use client";

import { useEffect, useRef, useState } from "react";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, Activity, Settings, Cpu } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { MODELS, MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { SYSTEM_HEALTH, USAGE_SHARE, QUOTA_ALERTS } from "@/lib/data/admin";
import { apiGetModelSettings, apiSaveModelSettings, type ModelSettingsDto } from "@/lib/client/adminApi";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";

export default function ModelsAdminPage() {
  const [active, setActive] = useState("chatgpt");
  const model = MODELS.find((m) => m.id === active) || MODELS[0];
  const health = SYSTEM_HEALTH.find((h) => h.name.toLowerCase() === model.id);
  const usageShare = USAGE_SHARE.find((c) => c.name.toLowerCase().includes(model.id)) || USAGE_SHARE[0];

  // 模型配置（服务端持久化）——切换模型即载入，改动即保存。
  const [settings, setSettings] = useState<ModelSettingsDto | null>(null);
  const [savedTip, setSavedTip] = useState("");
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]); // 在 effect 里同步 ref（非渲染期写）
  useEffect(() => {
    let alive = true;
    (async () => { setSavedTip(""); const s = await apiGetModelSettings(active); if (alive) setSettings(s); })();
    return () => { alive = false; };
  }, [active]);
  const save = async (patch: Partial<Omit<ModelSettingsDto, "modelId">>) => {
    const modelAtSave = active;
    const prev = settings;
    if (prev) setSettings({ ...prev, ...patch }); // 乐观
    const s = await apiSaveModelSettings(modelAtSave, patch);
    if (modelAtSave !== activeRef.current) return; // 已切到别的模型：不要把本次结果写回别的模型面板（防张冠李戴）
    if (s) { setSettings(s); setSavedTip("已保存到服务端"); }
    else { if (prev) setSettings(prev); setSavedTip("保存失败，已回滚"); } // 失败回滚，避免开关停在错误状态
  };

  return (
    <div className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><Cpu size={20} /></span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">管理与监控中心 · 模型管理</h1>
            <p className="text-[13px] text-[var(--text-2)]">配置每个模型的可见范围、配额与公平使用规则</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotYetAvailable why="非付费平台，仅管理公平使用与配额策略"><Settings size={13} /> 全局配额规则</NotYetAvailable>
          <NotYetAvailable why="接入新模型需网关侧配置 · 演示环境未开通"><Plus size={13} /> 接入新模型</NotYetAvailable>
        </div>
      </div>

      <AdminTabs />

      <Reveal className="grid gap-3 lg:grid-cols-[1fr_360px]">
        {/* Model list */}
        <div className="space-y-3">
          {MODELS.map((m) => {
            const h = SYSTEM_HEALTH.find((s) => s.name.toLowerCase() === m.id);
            return (
              // 去嵌套（内测 R2 遗留 P2）：外层不再是 role=button（ARIA 不允许可聚焦后代），
              // 选择行为收敛到模型名/设置按钮，外层卡片保持纯展示容器。
              <div
                key={m.id}
                className={`surface-card flex w-full items-center gap-4 p-4 text-left transition ${
                  active === m.id ? "ring-2 ring-[var(--c-edu)]/40" : "hover:shadow-[var(--shadow-md)]"
                }`}
              >
                <div className="grid h-14 w-14 place-items-center rounded-[20px] text-white shadow-md" style={{ backgroundImage: MODEL_GRADIENT_CSS(m) }}>
                  <ModelGlyph id={m.id} size={26} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-pressed={active === m.id}
                      onClick={(e) => { e.stopPropagation(); setActive(m.id); }}
                      className="inline-flex min-h-[52px] items-center rounded-[12px] px-2 text-[14.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)]/40"
                    >
                      {m.name}
                    </button>
                    <Badge variant={h?.state === "online" ? "green" : "gold"}>
                      ● {h?.state === "online" ? "在线" : "繁忙"} · {h?.latency}
                    </Badge>
                  </div>
                  {/* line-clamp-1 → 2，并补 title。
                      视觉门实测这里三档视口都在报「文本被裁切」，而且与 /prompts 的
                      同类命中有个关键差别：**提示词卡本身是链接，点进去有全文，截断可恢复**；
                      这里的描述**不可点、无 title，全文无处可看**——管理员读不到自己
                      正在配置的模型说明。两行覆盖绝大多数描述，剩下的靠 title 兜底。 */}
                  <div title={m.description} className="mt-1 text-[12px] text-[var(--text-2)] line-clamp-2">{m.description}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.tags.slice(0, 4).map((t) => (<Badge key={t}>{t}</Badge>))}
                  </div>
                </div>
                <div className="hidden md:block w-32 shrink-0 text-right">
                  <div className="text-[11px] text-[var(--text-3)]">今日调用</div>
                  <div className="text-num text-[18px] font-bold">{[8412, 4128, 3284, 2104, 986][MODELS.findIndex((mm) => mm.id === m.id)]?.toLocaleString() || "—"}</div>
                  <div className="mt-1 text-[11px] text-[var(--c-growth)]">↑ {[24, 18, 14, 10, 8][MODELS.findIndex((mm) => mm.id === m.id)] || 0}%</div>
                </div>
                <Button variant="outline" size="sm" className="min-h-[52px] px-4" aria-label={`设置 ${m.name}`} onClick={() => setActive(m.id)}>设置</Button>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(model) }}>
                <ModelGlyph id={model.id} size={16} />
              </div>
              {model.name} · 详情
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-[11px] text-[var(--text-3)]">运行统计为界面示例；下方「配额与对学生开放」会实时影响对话，其他开关为持久化治理策略。</div>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <Stat label="今日调用"  value="3,284" />
              <Stat label="本月用量估算" value="4,128 次" />
              <Stat label="平均延迟" value={health?.latency || "—"} />
              <Stat label="知识库命中" value="86%" />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold"><Activity size={13} /> 服务运行</div>
              <div className="rounded-[12px] bg-[var(--rg-hover-bg)] p-3 text-[12px]">
                <Row k="可见角色"   v="教师 / 学生 / 管理员" />
                <Row k="开通学院"   v="6 个" />
                <Row k="本月调用占比" v={`${usageShare.value}%`} />
                <Row k="高峰时段"   v="周五 14-16 时" />
              </div>
            </div>

            {settings && (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
                    <span>教师每日配额（次）</span><span className="text-num">{settings.quotaTeacher}</span>
                  </div>
                  <Slider className="min-h-[52px] [&_[role=slider]]:h-[52px] [&_[role=slider]]:w-[52px]" thumbLabel="教师每日配额" value={[settings.quotaTeacher]} onValueChange={(v) => setSettings((s) => s ? { ...s, quotaTeacher: v[0] } : s)} onValueCommit={(v) => save({ quotaTeacher: v[0] })} min={0} max={1000} step={10} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold">
                    <span>学生每日配额（次）</span><span className="text-num">{settings.quotaStudent}</span>
                  </div>
                  <Slider className="min-h-[52px] [&_[role=slider]]:h-[52px] [&_[role=slider]]:w-[52px]" thumbLabel="学生每日配额" value={[settings.quotaStudent]} onValueChange={(v) => setSettings((s) => s ? { ...s, quotaStudent: v[0] } : s)} onValueCommit={(v) => save({ quotaStudent: v[0] })} min={0} max={1000} step={10} />
                </div>

                <div className="space-y-1.5">
                  <RowSwitch label="启用数据隔离" checked={settings.dataIsolation} onChange={(v) => save({ dataIsolation: v })} />
                  <RowSwitch label="对学生开放" checked={settings.openToStudents} onChange={(v) => save({ openToStudents: v })} />
                  <RowSwitch label="允许文件上传" checked={settings.allowUpload} onChange={(v) => save({ allowUpload: v })} />
                  <RowSwitch label="超额自动降级" checked={settings.autoDowngrade} onChange={(v) => save({ autoDowngrade: v })} />
                </div>
                {savedTip && <div role="status" aria-live="polite" className="text-[11px] text-[var(--c-growth)]">{savedTip}</div>}
                <div className="text-[11px] text-[var(--text-3)]">额度为「公平使用」策略（非计费）。保存后对该模型的对话请求实时生效：关闭「对学生开放」将拦截学生调用，超过每日配额即当日限流；危机 / 求助等安全响应不受配额限制。</div>
              </>
            )}
          </CardContent>
        </Card>
      </Reveal>

      {/* Quota table */}
      <Card>
        <CardHeader>
          <CardTitle>配额预警 · 接近上限 <span className="ml-1 text-[11px] font-normal text-[var(--text-3)]">· 示例数据</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Reveal delay={0.08} className="grid gap-3 md:grid-cols-2">
            {QUOTA_ALERTS.map((q) => (
              <div key={q.name} className="rounded-[12px] border border-[var(--border-2)] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">{q.name}</div>
                    <div className="text-[11px] text-[var(--text-2)]">{q.type}</div>
                  </div>
                  <div className={`text-num text-[13px] font-bold ${q.percent >= 85 ? "text-[var(--c-alert)]" : q.percent >= 70 ? "text-[var(--c-gold)]" : "text-[var(--text-2)]"}`}>{q.value}</div>
                </div>
                <Progress value={q.percent} className="mt-2" />
              </div>
            ))}
          </Reveal>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-[var(--rg-hover-bg)] p-2.5">
      <div className="text-[11px] text-[var(--text-3)]">{label}</div>
      <div className="text-num text-[14px] font-bold">{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between py-1"><span className="text-[var(--text-2)]">{k}</span><span className="font-semibold">{v}</span></div>;
}
function RowSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-[var(--border-2)] px-3 py-2 text-[13px]">
      <span>{label}</span>
      <Switch
        aria-label={`${label} 开关`}
        checked={checked}
        onCheckedChange={onChange}
        className="h-[52px] w-20 [&>span]:h-11 [&>span]:w-11 [&>span[data-state=checked]]:translate-x-8"
      />
    </div>
  );
}
