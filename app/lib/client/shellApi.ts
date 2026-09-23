// 客户端外壳 API（Phase D）：通知 / 全局搜索 / 偏好 / 个人资料 / 退出登录。
export interface NotificationItem {
  id: string; kind: string; title: string; body: string; read: boolean; createdAt: number;
}
export interface SearchHit {
  kind: "session" | "prompt" | "agent"; id: string; title: string; sub: string;
}
export interface UserPrefsDto {
  density: "comfortable" | "compact"; fontScale: number; reduceMotion: boolean;
  showPeerComparison: boolean; defaultModel: string;
  assistantRole: "teacher" | "student" | "research" | "admin"; bio: string;
  socratic: boolean;
  onboardingVersion: number;
  onboardingStep: number;
  onboardingCompletedAt: number | null;
}
export type UserPrefsPatch = Partial<Omit<UserPrefsDto, "onboardingCompletedAt">>;

export async function apiListNotifications(): Promise<{ notifications: NotificationItem[]; unread: number }> {
  const res = await fetch("/api/notifications", { cache: "no-store" });
  if (!res.ok) return { notifications: [], unread: 0 };
  return (await res.json()) as { notifications: NotificationItem[]; unread: number };
}
export async function apiMarkNotification(arg: { id?: string; all?: boolean }): Promise<number> {
  const res = await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(arg) });
  if (!res.ok) return -1;
  return ((await res.json()) as { unread: number }).unread;
}
export async function apiSearch(q: string): Promise<SearchHit[]> {
  if (!q.trim()) return [];
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as { results: SearchHit[] }).results;
}
export async function apiGetPrefs(): Promise<UserPrefsDto | null> {
  try {
    const res = await fetch("/api/user/prefs", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { prefs: UserPrefsDto }).prefs;
  } catch {
    return null;
  }
}
export async function apiSavePrefs(patch: UserPrefsPatch): Promise<UserPrefsDto | null> {
  try {
    const res = await fetch("/api/user/prefs", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) return null;
    return ((await res.json()) as { prefs: UserPrefsDto }).prefs;
  } catch {
    return null;
  }
}
export async function apiSaveAccount(patch: { name?: string; bio?: string }): Promise<{ name: string; bio: string } | null> {
  const res = await fetch("/api/profile/account", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: { name: string }; bio: string };
  return { name: data.user.name, bio: data.bio };
}
export async function apiChangePassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/profile/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ oldPassword, newPassword }) });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, error: data.error };
}
export async function apiLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}
