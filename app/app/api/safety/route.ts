import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { addTicket } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

const Body = z.object({ type: z.enum(["help", "report"]), detail: z.string().max(500).optional() });

/** 安全求助/举报落库为工单（真实回执，不谎称"已送达大人"）。 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`safety:${user.id}`, 8, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const ticket = addTicket({ userId: user.id, type: parsed.data.type, detail: parsed.data.detail });
  const message = parsed.data.type === "help"
    ? "你的求助已记录，并转交校内安全 / 心理团队，请留意老师联系；如有紧急情况，请立刻拨打热线或告诉身边信任的大人。"
    : "你的举报已记录，将转交校内安全团队核实，完全保密。";
  return NextResponse.json({ ticketId: ticket.id, status: ticket.status, message });
}
