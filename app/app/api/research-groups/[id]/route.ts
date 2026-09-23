import { GroupActionSchema, changeGroup, getGroup, GroupError } from "@/lib/server/researchGroups";
import { groupRequest } from "@/lib/server/researchGroupHttp";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return groupRequest(request, false, (user, readOnly) => getGroup(user, id, readOnly));
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return groupRequest(request, true, (user, _readOnly, body) => {
    const parsed = GroupActionSchema.safeParse(body);
    if (!parsed.success) throw new GroupError(400, "INVALID_INPUT", "请检查任务名称、日期与检查项，内容不能为空或超出限制。");
    return changeGroup(user, id, parsed.data);
  });
}
