"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as motion from "motion/react-client";
import { AnimatePresence, MotionConfig } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Compass,
  Lightbulb,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useUserStore } from "@/lib/store/useUserStore";
import { usePrefsStore } from "@/lib/store/usePrefsStore";
import { useMotionPref } from "@/lib/hooks/useReducedMotion";
import { homeFor, ROLE_LABEL } from "@/lib/nav";
import { apiGetPrefs, apiSavePrefs } from "@/lib/client/shellApi";
import { ONBOARDING_STEP_COUNT, ONBOARDING_VERSION, clampOnboardingStep } from "@/lib/onboarding";

const HOME_LABEL: Record<string, string> = {
  "/student/home": "学生首页",
  "/explore": "学习探索",
  "/dashboard": "首页",
  "/chat": "AI 对话",
  "/admin/analytics": "数据看板",
  "/learn": "我的学习",
};

type SaveKind = "step" | "complete" | null;

export function OnboardingGuide() {
  const router = useRouter();
  const pathname = usePathname();
  const name = useUserStore((s) => s.name);
  const role = useUserStore((s) => s.role);
  const onboarded = usePrefsStore((s) => s.onboarded);
  const setOnboarded = usePrefsStore((s) => s.setOnboarded);
  const motionPref = useMotionPref();

  const [mounted, setMounted] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [serverCompleted, setServerCompleted] = useState(false);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState<SaveKind>(null);
  const [syncError, setSyncError] = useState("");
  const ctaRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Client-only hydration gate: persisted Zustand state is unavailable during SSR.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const home = homeFor(role);
  const homeLabel = HOME_LABEL[home] ?? "平台";
  const canShowOnThisRoute = pathname === home && pathname !== "/chat";

  const steps = useMemo(() => [
    {
      icon: Sparkles,
      tone: "blue",
      eyebrow: "认识你的学习伙伴",
      title: `你好，${name.length > 3 ? name.slice(-2) : name}！我是你的 EduAI 学伴`,
      body: "我可以陪你拆问题、找证据、练表达，但不会替你完成应该亲自思考的部分。",
      points: ["用自己的话说出目标", "从一个具体问题开始"],
    },
    {
      icon: Lightbulb,
      tone: "orange",
      eyebrow: "先想，再问，再验证",
      title: "把 AI 当作思考搭档，而不是答案机器",
      body: "你可以要求我给线索、检查步骤或出一道同类题。重要结论要回到教材、老师与原始资料核对。",
      points: ["说清楚你已经尝试了什么", "对回答追问依据与局限"],
    },
    {
      icon: ShieldCheck,
      tone: "mint",
      eyebrow: "校内安全边界",
      title: "你的学习过程有保护，也有清楚边界",
      body: "对话保存在校内平台，不用于同伴排名。请不要输入涉密信息，遇到不舒服或危险内容时使用安全求助。",
      points: ["附件先经过校内安全检查", "AI 可能出错，关键内容人工复核"],
    },
  ], [name]);

  useEffect(() => {
    if (!mounted || remoteReady) return;
    let alive = true;
    void (async () => {
      const prefs = await apiGetPrefs();
      if (!alive) return;
      if (!prefs) {
        setSyncError("暂时无法连接校内偏好服务。你仍可浏览引导，完成时会再次尝试同步。");
        setRemoteReady(true);
        return;
      }

      const completed = prefs.onboardingVersion >= ONBOARDING_VERSION && prefs.onboardingCompletedAt !== null;
      setServerCompleted(completed);
      setStep(clampOnboardingStep(prefs.onboardingStep));
      if (completed !== onboarded) setOnboarded(completed);
      setRemoteReady(true);
    })();
    return () => { alive = false; };
  }, [mounted, onboarded, remoteReady, setOnboarded]);

  const persistStep = useCallback(async (nextStep: number) => {
    if (saving) return false;
    setSaving("step");
    setSyncError("");
    const saved = await apiSavePrefs({ onboardingStep: clampOnboardingStep(nextStep) });
    setSaving(null);
    if (!saved) {
      setSyncError("这一步还没有同步到校内服务，请检查网络后重试。");
      return false;
    }
    if (saved.onboardingVersion >= ONBOARDING_VERSION && saved.onboardingCompletedAt !== null) {
      setServerCompleted(true);
      setOnboarded(true);
      return true;
    }
    setStep(clampOnboardingStep(saved.onboardingStep));
    return true;
  }, [saving, setOnboarded]);

  const dismiss = useCallback(() => {
    if (!saving) setDismissed(true);
  }, [saving]);

  const complete = useCallback(async (navigateHome: boolean) => {
    if (saving) return;
    setSaving("complete");
    setSyncError("");
    const saved = await apiSavePrefs({
      onboardingVersion: ONBOARDING_VERSION,
      onboardingStep: ONBOARDING_STEP_COUNT - 1,
    });
    if (!saved || saved.onboardingVersion < ONBOARDING_VERSION || !saved.onboardingCompletedAt) {
      setSaving(null);
      setSyncError("完成状态尚未被校内服务确认，请重试。引导不会假装保存成功。");
      return;
    }
    setServerCompleted(true);
    setOnboarded(true);
    setDismissed(true);
    setSaving(null);
    if (navigateHome) router.push(home);
  }, [home, router, saving, setOnboarded]);

  const visible = mounted && remoteReady && !serverCompleted && !dismissed && canShowOnThisRoute;

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ctaRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss, visible]);

  if (!visible) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const displayName = role === "student" ? "学习引导" : "平台导览";

  return (
    <MotionConfig reducedMotion={motionPref}>
      <div
        ref={dialogRef}
        className="onboarding-experience fixed inset-0 z-[var(--z-app-modal)] flex items-center justify-center p-3 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onb-title"
        aria-describedby="onb-body"
        aria-busy={saving !== null}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-[rgba(17,32,55,0.5)] backdrop-blur-sm"
          onClick={dismiss}
        />
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="edu-onboarding-shell relative grid max-h-[calc(100dvh-1.5rem)] w-full max-w-[900px] overflow-x-hidden overflow-y-auto rounded-[20px] md:grid-cols-[42%_58%]"
        >
          <button
            type="button"
            onClick={dismiss}
            disabled={saving !== null}
            aria-label="关闭引导，稍后再看"
            title="稍后再看"
            className="edu-3d-control absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-[12px] text-[var(--text-2)] disabled:cursor-wait disabled:opacity-60"
          >
            {saving === "complete" ? <Loader2 size={17} className="animate-spin" /> : <X size={17} />}
          </button>

          <div className="edu-onboarding-visual relative min-h-[220px] md:min-h-[560px]">
            <Image
              src="/art/edu-glass/prism-learning-workbench-v1.webp"
              alt="打开的书、玻璃棱镜和学习工具组成的学习台"
              fill
              priority
              sizes="(max-width: 767px) 100vw, 378px"
              className="object-cover object-center"
            />
            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-[20px] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_8px_24px_rgba(34,65,102,0.14)]">
              <div className="edu-onboarding-caption-title flex items-center gap-2 text-[12px] font-semibold">
                <BookOpenCheck size={16} /> {displayName}
              </div>
              <p className="edu-onboarding-caption-body mt-1 text-[11px] leading-relaxed">三步了解怎么问、怎么核对，以及什么时候寻求真人支持 · 插图由 AI 生成</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col bg-[rgba(252,254,255,0.98)] px-5 pb-5 pt-16 sm:px-8 md:min-h-[560px] md:px-9 md:pb-7 md:pt-8">
            <div className="flex items-center gap-2" aria-label={`第 ${step + 1} 步，共 ${steps.length} 步`}>
              {steps.map((item, index) => (
                <div
                  key={item.eyebrow}
                  data-current={index === step ? "true" : "false"}
                  className="edu-onboarding-step flex min-w-0 flex-1 items-center gap-2 rounded-[12px] px-2 py-2"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[12px] bg-white text-[11px] font-bold text-[var(--edu-blue)] shadow-sm">
                    {index < step ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="hidden truncate text-[11px] font-semibold text-[var(--text-2)] sm:block">{item.eyebrow}</span>
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col justify-center py-7"
              >
                <div className="edu-chat-avatar edu-tone-icon grid h-14 w-14 place-items-center rounded-[12px] text-white" data-tone={current.tone}>
                  <Icon size={25} />
                </div>
                <p className="mt-5 text-[11px] font-semibold text-[var(--edu-blue)]">{current.eyebrow}</p>
                <h2 id="onb-title" className="mt-2 max-w-[440px] text-[20px] font-bold leading-[1.45] text-[var(--text)]">
                  {current.title}
                </h2>
                <p id="onb-body" className="mt-3 max-w-[450px] text-[14px] leading-[1.8] text-[var(--text-2)]">
                  {current.body}
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {current.points.map((point) => (
                    <div key={point} className="edu-glass-inset flex min-h-[48px] items-center gap-2 rounded-[12px] px-3 py-2 text-[12px] font-semibold text-[var(--text-2)]">
                      <Check size={15} className="shrink-0 text-[var(--edu-mint)]" /> {point}
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {syncError && (
              <div role="alert" className="mb-3 rounded-[12px] border border-[var(--warn)] bg-[var(--warn-bg)] px-3 py-2 text-[12px] leading-relaxed text-[var(--warn-ink)]">
                {syncError}
              </div>
            )}

            <div className="flex items-center justify-start gap-3 sm:justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => void persistStep(step - 1)}
                  disabled={saving !== null}
                  className="edu-3d-control inline-flex min-h-[48px] items-center gap-1.5 rounded-[12px] px-4 text-[13px] font-semibold text-[var(--text-2)] disabled:cursor-wait disabled:opacity-60"
                >
                  <ArrowLeft size={15} /> 上一步
                </button>
              ) : (
                <button
                  type="button"
                  onClick={dismiss}
                  disabled={saving !== null}
                  className="min-h-[48px] rounded-[12px] px-3 text-[13px] text-[var(--text-3)] hover:text-[var(--text-2)] disabled:cursor-wait disabled:opacity-60"
                >
                  稍后再看
                </button>
              )}
              <button
                ref={ctaRef}
                type="button"
                onClick={() => isLast ? void complete(true) : void persistStep(step + 1)}
                disabled={saving !== null}
                className="edu-3d-control edu-3d-primary inline-flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold disabled:cursor-wait disabled:opacity-65"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : isLast ? <Compass size={16} /> : <ArrowRight size={16} />}
                {saving ? "正在同步" : isLast ? `进入${homeLabel}` : "保存并继续"}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-2)] pt-3 text-[11px] text-[var(--text-3)]">
              <span>当前身份：{ROLE_LABEL[role]}</span>
              <span
                aria-live="polite"
                className={`inline-flex items-center gap-1 ${syncError ? "text-[var(--warn-ink)]" : saving ? "text-[var(--edu-blue)]" : "text-[var(--ok-ink)]"}`}
              >
                {syncError ? <TriangleAlert size={12} /> : saving ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                {syncError ? "同步待恢复" : saving ? "正在同步状态" : "校内状态已同步"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
