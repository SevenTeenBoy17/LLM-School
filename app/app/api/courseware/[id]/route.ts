import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessCourseware } from "@/lib/nav";
import { CoursewarePlanSchema } from "@/lib/courseware/core";
import {
  CoursewareOperationConflictError,
  CoursewareOperationInProgressError,
  CoursewareVersionConflictError,
  getCoursewareDeck,
  saveCoursewarePlan,
} from "@/lib/server/courseware";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { getSessionUser, isDemoSession } from "@/lib/server/session";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const SaveBody = z.object({
  operationId: z.string().regex(/^[A-Za-z0-9._:-]{8,80}$/),
  stateVersion: z.number().int().min(1),
  plan: CoursewarePlanSchema,
}).strict();

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(_request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (!canAccessCourseware(user.role)) return jsonNoStore({ error: { code: "FORBIDDEN", message: "当前账号不能访问教师课件。" } }, { status: 403 });
  const { id } = await params;
  const deck = getCoursewareDeck(user.id, id);
  return deck
    ? jsonNoStore({ schemaVersion: "courseware.v1", deck })
    : jsonNoStore({ error: { code: "NOT_FOUND", message: "课件不存在或不属于当前账号。" } }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (!canAccessCourseware(user.role)) return jsonNoStore({ error: { code: "FORBIDDEN", message: "当前账号不能修改教师课件。" } }, { status: 403 });
  if (await isDemoSession()) return jsonNoStore({ error: { code: "DEMO_READONLY", message: "演示身份不会写入课件。" } }, { status: 403 });
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return jsonNoStore({ error: { code: guard.code, message: guard.message } }, { status: guard.status });
  let json: unknown;
  try { json = await request.json(); } catch { return jsonNoStore({ error: { code: "INVALID_INPUT", message: "请求内容无法读取。" } }, { status: 400 }); }
  const parsed = SaveBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: { code: "INVALID_INPUT", message: "课件方案格式不完整。" } }, { status: 400 });
  const { id } = await params;
  try {
    return jsonNoStore(saveCoursewarePlan(user, { id, ...parsed.data }));
  } catch (error) {
    if (error instanceof CoursewareOperationConflictError) {
      return jsonNoStore({ error: { code: "IDEMPOTENCY_CONFLICT", message: "该操作标识已用于另一份保存请求，请重新发起操作。" } }, { status: 409 });
    }
    if (error instanceof CoursewareOperationInProgressError) {
      return jsonNoStore({ error: { code: "OPERATION_IN_PROGRESS", message: "同一保存任务仍在处理中。" } }, { status: 409 });
    }
    if (error instanceof CoursewareVersionConflictError) {
      return jsonNoStore({
        error: { code: "VERSION_CONFLICT", message: "课件已在其他窗口更新，请以服务端版本为准后重新修改。" },
        stateVersion: error.current.stateVersion,
        authoritativeEntity: error.current,
      }, { status: 409 });
    }
    if (error instanceof Error && error.message === "courseware_not_found") {
      return jsonNoStore({ error: { code: "NOT_FOUND", message: "课件不存在或不属于当前账号。" } }, { status: 404 });
    }
    return jsonNoStore({ error: { code: "SAVE_FAILED", message: "课件暂时无法保存，请检查内容后重试。" } }, { status: 400 });
  }
}
