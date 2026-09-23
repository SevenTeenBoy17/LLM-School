import { z } from "zod";

const sessionSchema = z.object({ user: z.object({ id: z.string().min(1), sessionVersion: z.number().int().positive() }).nullable() });
export const IDENTITY_UNAVAILABLE = "暂时无法核对登录身份。研究草稿仍被隔离保留，请重试；不会发送材料。";

export async function checkPaperIdentity(ownerId: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/me", { cache: "no-store", signal });
    if (response.status === 401) return false;
    if (!response.ok) throw new Error(IDENTITY_UNAVAILABLE);
    const data = sessionSchema.safeParse(await response.json());
    if (!data.success) throw new Error(IDENTITY_UNAVAILABLE);
    return !!data.data.user && `${data.data.user.id}:${data.data.user.sessionVersion}` === ownerId;
  } catch { throw new Error(IDENTITY_UNAVAILABLE); }
}
