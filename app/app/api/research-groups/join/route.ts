import { JoinGroupSchema, joinGroup, GroupError } from "@/lib/server/researchGroups";
import { groupRequest } from "@/lib/server/researchGroupHttp";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return groupRequest(request, true, (user, _readOnly, body) => {
    const parsed = JoinGroupSchema.safeParse(body);
    if (!parsed.success) throw new GroupError(400, "INVALID_INPUT", "请输入完整的48位邀请码。");
    return joinGroup(user, parsed.data.inviteCode);
  });
}
