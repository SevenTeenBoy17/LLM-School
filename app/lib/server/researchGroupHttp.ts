import "server-only";
import { getSessionUser, isDemoSession, type SessionUser } from "./session";
import { validateJsonMutationRequest } from "./requestGuard";
import { rateLimit } from "./rateLimit";
import { canUseGroups, GroupError } from "./researchGroups";

export function groupJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, private", "Vary": "Cookie" } });
}
export async function groupRequest(request: Request, mutation: boolean, action: (user: SessionUser, readOnly: boolean, body: unknown) => unknown) {
  try {
    const user = await getSessionUser();
    if (!user) throw new GroupError(401, "AUTH_REQUIRED", "请重新登录。");
    if (!canUseGroups(user.role)) throw new GroupError(403, "FORBIDDEN", "当前账号不能访问教师教研组。");
    const readOnly = await isDemoSession();
    let body: unknown;
    if (mutation) {
      if (readOnly) throw new GroupError(403, "DEMO_READONLY", "演示身份只读，请使用教师本人的账号操作。");
      const guard = validateJsonMutationRequest(request);
      if (!guard.ok) throw new GroupError(guard.status, guard.code, guard.message);
      const limited = rateLimit(`research-groups:${user.id}`, 60, 60_000);
      if (!limited.ok) throw new GroupError(429, "RATE_LIMITED", `操作较频繁，请 ${limited.retryAfter} 秒后再试。`);
      // Enforce the bound while reading, including bodies without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) throw new GroupError(400, "INVALID_INPUT", "请求内容为空。");
      let length = 0; const chunks: Uint8Array[] = [];
      try {
        while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 16384) { await reader.cancel(); throw new GroupError(413, "BODY_TOO_LARGE", "内容过长，请缩短后重试。"); } chunks.push(value); }
        const raw = Buffer.concat(chunks).toString("utf8");
        try { body = JSON.parse(raw); } catch { throw new GroupError(400, "INVALID_INPUT", "请求内容无法读取。"); }
      } finally { reader.releaseLock(); }
    }
    return groupJson(await action(user, readOnly, body));
  } catch (error) {
    if (error instanceof GroupError) return groupJson({ error: { code: error.code, message: error.message } }, error.status);
    return groupJson({ error: { code: "GROUP_UNAVAILABLE", message: "教研组服务暂时不可用，未确认的修改请保留后重试。" } }, 503);
  }
}
