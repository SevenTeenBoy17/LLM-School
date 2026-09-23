"use client";

/**
 * /admin/guardian —— 守护设置（M3/B2）。管理员配置学生端守护策略（服务端权威，audit 留痕）；
 * 学生端 GuardianShell 60s 轮询生效。curfewStart === curfewEnd 表示停用宵禁（页面明示该语义）。
 */
import { useEffect, useState } from "react";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GUARDIAN_DEFAULTS, type GuardianConfig } from "@/lib/guardian";

export default function AdminGuardianPage() {
  const [cfg, setCfg] = useState<GuardianConfig>(GUARDIAN_DEFAULTS);
  const [source, setSource] = useState<"class" | "global" | "default" | "loading">("loading");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/guardian", { cache: "no-store" });
        if (!r.ok) { setSource("default"); return; }
        const j = await r.json();
        setCfg({ limitMin: j.guardian.limitMin, curfewStart: j.guardian.curfewStart, curfewEnd: j.guardian.curfewEnd });
        setSource(j.guardian.source);
      } catch { setSource("default"); }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const save = async () => {
    setSaving(true); setNotice("");
    try {
      const r = await fetch("/api/guardian", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      if (r.ok) { setSource("global"); setNotice("已保存——学生端最迟 60 秒内生效（班级若有自定义策略，以班级为准）。"); }
      else setNotice("保存失败：参数无效或权限不足。");
    } catch { setNotice("网络异常，稍后再试。"); }
    setSaving(false);
  };

  const num = (v: string, lo: number, hi: number, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
  };

  return (
    <div data-register="console" className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden">
      <div className="mx-auto max-w-[640px] space-y-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[var(--c-edu)]"><ShieldCheck size={20} /></span>
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">守护设置</h1>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">学生端使用时长提醒与夜间休息时段（服务端权威，全校生效）。</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>当前策略</CardTitle>
            <Badge variant={source === "global" || source === "class" ? "green" : undefined}>
              {source === "loading" ? "载入中…" : source === "global" ? "全校策略已配置" : source === "class" ? "当前生效为班级策略" : "默认策略（未配置）"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block">
              <span className="text-[13px] font-semibold text-[var(--text)]">休息提醒阈值（分钟，10–120）</span>
              <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">学生每累计使用此时长，弹出 60 秒强制休息卡。</span>
              <input type="number" min={10} max={120} value={cfg.limitMin}
                onChange={(e) => setCfg((c) => ({ ...c, limitMin: num(e.target.value, 10, 120, c.limitMin) }))}
                className="mt-2 h-10 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--text)]">宵禁开始（0–23 时）</span>
                <input type="number" min={0} max={23} value={cfg.curfewStart}
                  onChange={(e) => setCfg((c) => ({ ...c, curfewStart: num(e.target.value, 0, 23, c.curfewStart) }))}
                  className="mt-2 h-10 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]" />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--text)]">宵禁结束（0–23 时）</span>
                <input type="number" min={0} max={23} value={cfg.curfewEnd}
                  onChange={(e) => setCfg((c) => ({ ...c, curfewEnd: num(e.target.value, 0, 23, c.curfewEnd) }))}
                  className="mt-2 h-10 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]" />
              </label>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--text-3)]">
              说明：开始 &gt; 结束表示跨零点窗口（如 22 → 6 即 22:00–次日 6:00）；开始 = 结束表示停用宵禁。
              本页设置为**全校策略**；班主任可在「班级学情」页为本班单独微调，**班级策略优先于全校策略**。
              危机「安全求助」入口在任何时段（含宵禁）都保持可用，不受本设置影响。
            </p>
            <div className="flex items-center gap-3">
              <Button variant="grad" size="sm" className="min-h-[40px] gap-1.5" disabled={saving || source === "loading"} onClick={save}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 保存并生效
              </Button>
              {notice && <span role="status" className="text-[12px] text-[var(--text-2)]">{notice}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
