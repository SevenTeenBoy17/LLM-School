import { NextResponse } from "next/server";
import { canAccessCourseware } from "@/lib/nav";
import { CoursewareBriefSchema } from "@/lib/courseware/core";
import {
  CoursewareOperationConflictError,
  CoursewareOperationInProgressError,
  createCoursewarePlan,
} from "@/lib/server/courseware";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { getSessionUser, isDemoSession } from "@/lib/server/session";

export const runtime = "nodejs";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (!canAccessCourseware(user.role)) return jsonNoStore({ error: { code: "FORBIDDEN", message: "当前账号不能创建教师课件。" } }, { status: 403 });
  if (await isDemoSession()) return jsonNoStore({ error: { code: "DEMO_READONLY", message: "演示身份不会写入课件。" } }, { status: 403 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return jsonNoStore({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  const limited = rateLimit(`courseware-plan:${user.id}`, 6, 60_000);
  if (!limited.ok) return rateLimitedResponse(limited.retryAfter);
  let json: unknown;
  try { json = await request.json(); } catch { return jsonNoStore({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = CoursewareBriefSchema.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: { code: "INVALID_INPUT", message: "请检查学科、年级、主题和页数。" } }, { status: 400 });
  try {
    return jsonNoStore(await createCoursewarePlan(user, parsed.data));
  } catch (error) {
    if (error instanceof CoursewareOperationConflictError) {
      return jsonNoStore({ error: { code: "IDEMPOTENCY_CONFLICT", message: "该操作标识已用于另一份生成请求，请重新发起操作。" } }, { status: 409 });
    }
    if (error instanceof CoursewareOperationInProgressError) {
      return jsonNoStore({ error: { code: "OPERATION_IN_PROGRESS", message: "同一生成任务仍在处理中，请稍后读取结果。" } }, { status: 409 });
    }
    return jsonNoStore({ error: { code: "PLAN_FAILED", message: "课件方案暂时无法生成，请稍后重试。" } }, { status: 500 });
  }
}
