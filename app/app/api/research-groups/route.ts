import { CreateGroupSchema, createGroup, GroupError, listGroups } from "@/lib/server/researchGroups";
import { groupRequest } from "@/lib/server/researchGroupHttp";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return groupRequest(request, false, (user, readOnly) => listGroups(user, readOnly));
}
export async function POST(request: Request) {
  return groupRequest(request, true, (user, _readOnly, body) => {
    const parsed = CreateGroupSchema.safeParse(body);
    if (!parsed.success) throw new GroupError(400, "INVALID_INPUT", "请填写教研组名称（最多60字）和学科（最多40字）。");
    return createGroup(user, parsed.data);
  });
}
