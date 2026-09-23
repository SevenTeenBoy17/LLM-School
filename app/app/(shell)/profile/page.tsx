"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { User, Shield, Settings as SettingsIcon, Activity, Key, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { MODELS, MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { useUserStore } from "@/lib/store/useUserStore";
import { useModelStore } from "@/lib/store/useModelStore";
import { usePrefsStore, type Density } from "@/lib/store/usePrefsStore";
import { apiGetPrefs, apiSavePrefs, apiSaveAccount, apiChangePassword, type UserPrefsDto } from "@/lib/client/shellApi";
import type { ModelProvider } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/nav";
import { STAGE_LABEL } from "@/lib/voice";
import { Reveal } from "@/components/common/EduArt";
import { ProfileDevicesCard, ProfileApiTokensCard, ProfileActivityCard } from "@/components/profile/ProfileStaticPanels";

const MODEL_IDS = new Set(MODELS.map((m) => m.id));
type ProfileTab = "account" | "prefs" | "security" | "api" | "activity";
const PROFILE_TABS = new Set<ProfileTab>(["account", "prefs", "security", "api", "activity"]);
const readProfileTab = (value: string | null): ProfileTab => PROFILE_TABS.has(value as ProfileTab) ? (value as ProfileTab) : "account";

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex-1 p-7 text-[13px] text-[var(--text-2)]">加载个人中心…</div>}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUserStore();
  const setUser = useUserStore((s) => s.setUser);
  const current = useModelStore((s) => s.current);
  const setCurrent = useModelStore((s) => s.setCurrent);
  const prefs = usePrefsStore();
  const [name, setName] = useState(user.name);
  const [email] = useState("未绑定");
  const [phone] = useState("未绑定");
  const [bio, setBio] = useState("");
  const [bioReady, setBioReady] = useState(false); // 首屏拉取成功或用户已编辑，才允许把 bio 回写（防未加载时用空串覆盖服务端已存简介）
  const [savingAccount, setSavingAccount] = useState(false);
  const activeTab = readProfileTab(searchParams.get("tab"));
  const [prefStatus, setPrefStatus] = useState("");
  // 改密表单
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const syncUiPrefs = (p: UserPrefsDto) => {
    prefs.setDensity(p.density);
    prefs.setFontScale(p.fontScale);
    prefs.setReduceMotion(p.reduceMotion);
    prefs.setShowPeerComparison(p.showPeerComparison);
    prefs.setAssistantRole(p.assistantRole);
    if (MODEL_IDS.has(p.defaultModel as ModelProvider)) setCurrent(p.defaultModel as ModelProvider);
  };

  // 首屏：服务端偏好为权威 → 同步进本地 store + 表单。
  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await apiGetPrefs();
      if (!alive || !p) return;
      syncUiPrefs(p);
      setBio(p.bio);
      setBioReady(true);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = (tab: string) => {
    const next = readProfileTab(tab);
    router.replace(next === "account" ? "/profile" : `/profile?tab=${next}`, { scroll: false });
  };

  // 偏好改动：写本地 store（即时反馈）+ 推送服务端（权威）。
  const savePref = async (patch: Partial<UserPrefsDto>) => {
    setPrefStatus("保存中…");
    const saved = await apiSavePrefs(patch);
    if (!saved) {
      const fresh = await apiGetPrefs();
      if (fresh) syncUiPrefs(fresh);
      setPrefStatus("保存失败，已恢复服务端设置");
      toast.error("偏好保存失败，已恢复服务端设置");
      return;
    }
    syncUiPrefs(saved);
    setPrefStatus("已保存到服务端");
  };

  const saveAccount = async () => {
    setSavingAccount(true);
    // 仅当 bio 已从服务端加载或被用户编辑过，才回写——否则省略 bio，避免用未加载的空串覆盖已存简介。
    const payload: { name: string; bio?: string } = { name: name.trim() };
    if (bioReady) payload.bio = bio;
    const res = await apiSaveAccount(payload);
    setSavingAccount(false);
    if (!res) { toast.error("保存失败，请稍后重试"); return; }
    setUser({ name: res.name, role: user.role, stage: user.stage, department: user.department, avatarLetter: res.name.charAt(0) });
    setBio(res.bio);
    setBioReady(true);
    toast.success("已保存基本信息");
  };

  const changePwd = async () => {
    if (newPwd !== confirmPwd) { toast.error("两次输入的新密码不一致"); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPwd)) { toast.error("新密码需至少 8 位，含大小写字母与数字"); return; }
    setPwdBusy(true);
    const res = await apiChangePassword(oldPwd, newPwd);
    setPwdBusy(false);
    if (res.ok) { toast.success("密码已更新"); setOldPwd(""); setNewPwd(""); setConfirmPwd(""); }
    else if (res.error === "wrong_password") toast.error("当前密码不正确");
    else if (res.error === "weak_password") toast.error("新密码强度不足");
    else toast.error("更新失败，请稍后重试");
  };

  const sendPromptToChat = (text: string) => router.push(`/chat?seed=${encodeURIComponent(text)}`);

  return (
    <div className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      {/* Header */}
      <Reveal className="surface-card-lg relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-[280px] w-[280px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--accent-focus) 40%, transparent), transparent)" }} />
        <div className="relative flex flex-wrap items-start gap-5">
          <div className="grid h-20 w-20 place-items-center rounded-[20px] text-white text-[24px] font-bold shadow-lg"
            /* 与侧边栏头像是同一个视觉元件，上一批只改了侧边栏那一处——
               色门按**文件**排名，本文件只有 3 个 hex 排在末尾，于是「同一缺陷散落多文件」
               这件事没被指标聚到一起。两处现在都走 --accent-focus + 白字。
               （此处 24px 粗体属 WCAG「大字」，旧配色 4.36:1 尚且够用，
                 所以这一处修的是**一致性**不是无障碍。） */
            style={{ background: "var(--accent-focus)", color: "white" }}>
            {user.avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-tight">{user.name}</h1>
              <Badge variant="primary">{ROLE_LABEL[user.role]}</Badge>
              <Badge variant="green">已实名</Badge>
            </div>
            <div className="mt-1 text-[13px] text-[var(--text-2)]">{user.department}</div>
            <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-[var(--text-2)]">
              <span className="inline-flex items-center gap-1.5"><Icons.Mail size={12} /> {email}</span>
              <span className="inline-flex items-center gap-1.5"><Icons.Phone size={12} /> {phone}</span>
              <span className="inline-flex items-center gap-1.5"><Icons.Calendar size={12} /> 加入于 2018-09</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button variant="grad" size="sm" className="min-h-[var(--hit-min)] gap-1.5" disabled={savingAccount} onClick={saveAccount}><Save size={13} /> {savingAccount ? "保存中…" : "保存修改"}</Button>
            <span className="text-[11px] text-[var(--text-3)]">姓名与简介可编辑并保存到校内账号</span>
          </div>
        </div>
      </Reveal>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger className="min-h-[var(--hit-min)]" value="account"><User size={14} className="mr-1.5" /> 账户资料</TabsTrigger>
          <TabsTrigger className="min-h-[var(--hit-min)]" value="prefs"><SettingsIcon size={14} className="mr-1.5" /> 偏好设置</TabsTrigger>
          <TabsTrigger className="min-h-[var(--hit-min)]" value="security"><Shield size={14} className="mr-1.5" /> 安全</TabsTrigger>
          <TabsTrigger className="min-h-[var(--hit-min)]" value="api"><Key size={14} className="mr-1.5" /> API Token</TabsTrigger>
          <TabsTrigger className="min-h-[var(--hit-min)]" value="activity"><Activity size={14} className="mr-1.5" /> 活动记录</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>基本信息</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field id="profile-name" label="姓名"><Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field id="profile-email" label="邮箱"><Input id="profile-email" value={email} disabled /></Field>
                <Field id="profile-phone" label="手机号"><Input id="profile-phone" value={phone} disabled /></Field>
                <Field id="profile-bio" label="个性简介">
                  <Input id="profile-bio" value={bio} onChange={(e) => { setBio(e.target.value); setBioReady(true); }} placeholder="一句话介绍自己（保存到服务端）" />
                </Field>
                <Button variant="grad" size="sm" className="min-h-[var(--hit-min)] gap-1.5" disabled={savingAccount} onClick={saveAccount}><Save size={13} /> {savingAccount ? "保存中…" : "保存基本信息"}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>所属与角色</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field id="profile-college" label="所属学院"><Input id="profile-college" value="计算机学院" disabled /></Field>
                <Field id="profile-staff-id" label="工号">
                  <Input id="profile-staff-id" value="T2018042" disabled />
                </Field>
                <Field id="profile-role" label="角色">
                  <Input id="profile-role" value={ROLE_LABEL[user.role]} disabled />
                </Field>
                <Field id="profile-stage" label="学段（影响学生端语气与防代写分级）">
                  <Input id="profile-stage" value={STAGE_LABEL[user.stage]} disabled />
                </Field>
                <p className="text-[11px] text-[var(--text-3)]">角色与学段由校内账号体系（服务端会话）统一管理，不可在前端自行更改；演示切换身份请用左下角「切换身份」。</p>
                <Field id="profile-teaching-group" label="教研组"><Input id="profile-teaching-group" value="信息科技教研组 · 副组长" disabled /></Field>
              </CardContent>
            </Card>
          </Reveal>
        </TabsContent>

        <TabsContent value="prefs">
          <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>外观与体验</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {prefStatus && <div role="status" aria-live="polite" className="rounded-[12px] bg-[var(--info-bg)] px-3 py-2 text-[12px] text-[var(--info-ink)]">{prefStatus}</div>}
                <RowSwitch
                  label="跟随系统暗色模式"
                  desc="深色环境下自动切换为暗色界面（实验性）"
                />
                <Field id="profile-density" label="界面密度">
                  <Select value={prefs.density} onValueChange={(v) => { prefs.setDensity(v as Density); void savePref({ density: v as Density }); }}>
                    <SelectTrigger id="profile-density"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">舒适</SelectItem>
                      <SelectItem value="compact">紧凑</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[13px]">
                    <Label>字号缩放</Label>
                    <span className="text-num font-semibold">{Math.round(prefs.fontScale * 100)}%</span>
                  </div>
                  <Slider
                    thumbLabel="字号缩放"
                    value={[prefs.fontScale]}
                    onValueChange={(v) => prefs.setFontScale(v[0])}
                    onValueCommit={(v) => { void savePref({ fontScale: v[0] }); }}
                    min={0.85} max={1.3} step={0.05}
                  />
                </div>
                <RowSwitch
                  label="减少动效"
                  desc="跟随系统偏好关闭粒子、卡片浮入等装饰动画"
                  checked={prefs.reduceMotion}
                  onChange={(v) => { prefs.setReduceMotion(v); void savePref({ reduceMotion: v }); }}
                />
                <RowSwitch
                  label="显示班级匿名对比"
                  desc="默认关闭。开启后仅显示「你已超过班里多数同学」这类匿名、单向的鼓励，绝不展示姓名 / 名次 / 末位"
                  checked={prefs.showPeerComparison}
                  onChange={(v) => { prefs.setShowPeerComparison(v); void savePref({ showPeerComparison: v }); }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>默认模型与助手角色</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="mb-2 block">默认模型</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { setCurrent(m.id); void savePref({ defaultModel: m.id }); }}
                        className={`flex items-center gap-2 rounded-[12px] border bg-[var(--card)] p-2.5 text-left transition ${
                          m.id === current ? "border-[var(--c-edu)] ring-2 ring-[var(--c-edu)]/20" : "border-[var(--border-2)] hover:border-[var(--c-edu)]/40"
                        }`}
                      >
                        <div className="grid h-9 w-9 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(m) }}>
                          <ModelGlyph id={m.id} size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold">{m.name}</div>
                          <div className="text-[11px] text-[var(--text-2)]">{m.contextWindow}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <Field id="profile-assistant-role" label="默认助手角色">
                  <Select value={prefs.assistantRole} onValueChange={(v) => { prefs.setAssistantRole(v as typeof prefs.assistantRole); void savePref({ assistantRole: v as typeof prefs.assistantRole }); }}>
                    <SelectTrigger id="profile-assistant-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">教师助手</SelectItem>
                      <SelectItem value="student">学生助手</SelectItem>
                      <SelectItem value="research">科研助手</SelectItem>
                      <SelectItem value="admin">行政助手</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>常用提示词</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {["📘 生成本节课的教学大纲", "📝 论文摘要中英文润色", "🧪 实验数据可视化", "🎓 设计高互动课堂", "📊 学生作业常见错误分析", "🖼️ 教材风格章节封面"].map((t, i) => (
                    <button key={i} type="button" onClick={() => sendPromptToChat(t.replace(/^\S+\s/, ""))} className="rounded-full bg-[var(--rg-selected-bg)] px-3 py-1.5 text-[12px] text-[var(--info-ink)] hover:bg-[var(--rg-control-hover)]">{t}</button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--text-3)]">点击任一常用提示词，将带到对话页并预填输入框。</p>
              </CardContent>
            </Card>
          </Reveal>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>登录与密码</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field id="profile-current-password" label="当前密码"><Input id="profile-current-password" type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="输入当前密码" /></Field>
                <Field id="profile-new-password" label="新密码"><Input id="profile-new-password" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="至少 8 位，含大小写与数字" /></Field>
                <Field id="profile-confirm-password" label="确认新密码"><Input id="profile-confirm-password" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="再次输入新密码" /></Field>
                <Button variant="grad" size="sm" className="min-h-[var(--hit-min)] gap-1.5" disabled={pwdBusy || !oldPwd || !newPwd} onClick={changePwd}><Lock size={13} /> {pwdBusy ? "更新中…" : "更新密码"}</Button>
                <hr className="my-3 border-[var(--border-2)]" />
                {/* 诚实禁用：2FA / 异地登录提醒需短信/邮件基建，演示环境未开通 */}
                <RowDisabled label="启用 2FA 双因子认证" desc="需短信验证码基建 · 演示环境未开通" />
                <RowDisabled label="异地登录提醒" desc="需邮件推送基建 · 演示环境未开通" />
              </CardContent>
            </Card>

            <ProfileDevicesCard />
          </div>
        </TabsContent>

        <TabsContent value="api">
          <ProfileApiTokensCard />
        </TabsContent>

        <TabsContent value="activity">
          <ProfileActivityCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

function RowSwitch({ label, desc, checked, onChange, defaultOn }: { label: string; desc?: string; checked?: boolean; onChange?: (v: boolean) => void; defaultOn?: boolean }) {
  return (
    <div className="flex items-start justify-between rounded-[12px] border border-[var(--border-2)] p-3">
      <div>
        <div className="text-[13px] font-semibold">{label}</div>
        {desc && <div className="text-[12px] text-[var(--text-2)]">{desc}</div>}
      </div>
      {checked === undefined
        ? <Switch className="h-10 w-16 [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-7" aria-label={`${label} 开关`} defaultChecked={defaultOn} />
        : <Switch className="h-10 w-16 [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-7" aria-label={`${label} 开关`} checked={checked} onCheckedChange={onChange} />}
    </div>
  );
}

// 诚实禁用行：开关置灰不可用，说明为何未开通（不假装有此功能）。
function RowDisabled({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-start justify-between rounded-[12px] border border-dashed border-[var(--border-2)] p-3 opacity-70">
      <div>
        <div className="text-[13px] font-semibold">{label}</div>
        <div className="text-[12px] text-[var(--text-2)]">{desc}</div>
      </div>
      <Switch className="h-10 w-16 [&>span]:h-7 [&>span]:w-7 data-[state=checked]:[&>span]:translate-x-7" aria-label={`${label}（未开通）`} checked={false} disabled />
    </div>
  );
}
