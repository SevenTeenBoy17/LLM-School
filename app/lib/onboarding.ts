export const ONBOARDING_VERSION = 2;
export const ONBOARDING_STEP_COUNT = 3;

export function clampOnboardingStep(step: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(ONBOARDING_STEP_COUNT - 1, Math.trunc(step)));
}
