import { z } from "zod";
import { canAccessCourseware } from "@/lib/nav";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { CoursewareVisualError, generateCoursewareVisual, readCoursewareVisual } from "@/lib/server/coursewareVisuals";

export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string; slideId: string }> };
const Body = z.object({ stateVersion: z.number().int().positive() }).strict();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
function failure(error: unknown) {
  return error instanceof CoursewareVisualError ? json({ error: { code: error.code, message: error.message } }, error.status)
    : json({ error: { code: "VISUAL_FAILED", message: "课件图像暂时不可用，请重试。" } }, 500);
}
export async function GET(request: Request, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, 401);
  if (!canAccessCourseware(user.role)) return json({ error: { code: "FORBIDDEN", message: "当前账号不能访问教师课件。" } }, 403);
  const { id, slideId } = await params;
  try {
    const bytes = readCoursewareVisual(user.id, id, slideId, new URL(request.url).searchParams.get("v"));
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "image/png", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: Context) {
  const user = await getSessionUser();
  if (!user) return json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, 401);
  if (!canAccessCourseware(user.role)) return json({ error: { code: "FORBIDDEN", message: "当前账号不能生成教师课件。" } }, 403);
  if (await isDemoSession()) return json({ error: { code: "DEMO_READONLY", message: "演示身份不会生成课件图像。" } }, 403);
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return json({ error: { code: guard.code, message: guard.message } }, guard.status);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: { code: "INVALID_INPUT", message: "请提供已保存的方案版本。" } }, 400);
  const { id, slideId } = await params;
  try { return json({ items: await generateCoursewareVisual(user.id, id, slideId, body.data.stateVersion) }); }
  catch (error) { return failure(error); }
}
