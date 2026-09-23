import { canAccessCourseware } from "@/lib/nav";
import { buildCoursewareDownload } from "@/lib/server/courseware";
import { getSessionUser } from "@/lib/server/session";
import { buildVisualCoursewareDownload, CoursewareVisualError } from "@/lib/server/coursewareVisuals";
import { safeCoursewareFileName } from "@/lib/server/courseware";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (!canAccessCourseware(user.role)) return Response.json({ error: { code: "FORBIDDEN", message: "当前账号不能下载教师课件。" } }, { status: 403 });
  const { id } = await params;
  const mode = new URL(request.url).searchParams.get("mode") || "editable";
  if (!["editable", "visual"].includes(mode)) return Response.json({ error: { code: "INVALID_INPUT", message: "未知下载格式。" } }, { status: 400 });
  let file;
  try {
    if (mode === "visual") {
      const result = await buildVisualCoursewareDownload(user.id, id);
      file = { ...result, fileName: `${safeCoursewareFileName(result.deck.title)}-图像成品版.pptx` };
    } else file = await buildCoursewareDownload(user.id, id);
  } catch (error) {
    if (error instanceof CoursewareVisualError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    return Response.json({ error: { code: "EXPORT_FAILED", message: "导出失败，请稍后重试。" } }, { status: 500 });
  }
  if (!file) return Response.json({ error: { code: "NOT_FOUND", message: "课件不存在或不属于当前账号。" } }, { status: 404 });
  const encoded = encodeURIComponent(file.fileName).replace(/'/g, "%27");
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "content-disposition": `attachment; filename="eduai-courseware.pptx"; filename*=UTF-8''${encoded}`,
      "content-length": String(file.bytes.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
