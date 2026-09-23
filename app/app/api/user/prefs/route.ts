import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { getUserPrefs, setUserPrefs, getClassPolicy, type UserPrefs } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { ONBOARDING_STEP_COUNT, ONBOARDING_VERSION, clampOnboardingStep } from "@/lib/onboarding";

// GET /api/user/prefs —— 当前用户偏好（服务端权威）。
// M1/B1：学生同时回读班级苏格拉底锁定态（锁定时 UI 开关禁用且可解释）。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const socraticLocked = user.role === "student" ? getClassPolicy(user.classId).socraticLock : false;
  return NextResponse.json({ prefs: getUserPrefs(user.id), socraticLocked });
}

const PutBody = z.object({
  density: z.enum(["comfortable", "compact"]).optional(),
  fontScale: z.number().min(0.7).max(1.5).optional(),
  reduceMotion: z.boolean().optional(),
  showPeerComparison: z.boolean().optional(),
  defaultModel: z.string().max(64).optional(),
  assistantRole: z.enum(["teacher", "student", "research", "admin"]).optional(),
  bio: z.string().max(200).optional(),
  socratic: z.boolean().optional(), // M1/B1 学生自选引导模式（锁定时此偏好仍可存，生效判定在服务端）
  onboardingVersion: z.number().int().min(0).max(ONBOARDING_VERSION).optional(),
  onboardingStep: z.number().int().min(0).max(ONBOARDING_STEP_COUNT - 1).optional(),
}).strict();

// PUT —— 部分更新偏好（服务端为准，客户端 zustand 仅镜像缓存）。
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`prefs:${user.id}`, 60, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const current = getUserPrefs(user.id);
  const patch: Partial<UserPrefs> = { ...parsed.data };

  if (parsed.data.onboardingStep !== undefined) {
    patch.onboardingStep = clampOnboardingStep(parsed.data.onboardingStep);
  }

  if (parsed.data.onboardingVersion !== undefined) {
    patch.onboardingVersion = Math.max(current.onboardingVersion, parsed.data.onboardingVersion);
  }

  const effectiveVersion = patch.onboardingVersion ?? current.onboardingVersion;
  if (effectiveVersion >= ONBOARDING_VERSION) {
    patch.onboardingVersion = ONBOARDING_VERSION;
    patch.onboardingStep = ONBOARDING_STEP_COUNT - 1;
    patch.onboardingCompletedAt = current.onboardingCompletedAt ?? Date.now();
  }

  return NextResponse.json({ prefs: setUserPrefs(user.id, patch) });
}
