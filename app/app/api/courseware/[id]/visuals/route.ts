import { canAccessCourseware } from "@/lib/nav";
import { getSessionUser } from "@/lib/server/session";
import { CoursewareVisualError, listCoursewareVisuals } from "@/lib/server/coursewareVisuals";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (!canAccessCourseware(user.role)) return Response.json({ error: { code: "FORBIDDEN", message: "当前账号不能访问教师课件。" } }, { status: 403 });
  try {
    return Response.json({ items: listCoursewareVisuals(user.id, (await params).id) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error instanceof CoursewareVisualError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    return Response.json({ error: { code: "READ_FAILED", message: "暂时无法读取成品状态。" } }, { status: 500 });
  }
}
