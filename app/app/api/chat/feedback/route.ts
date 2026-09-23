import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { messageBelongsToUser, setFeedback } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

// 消息反馈 👍/👎（每人每条一票，可切换/撤销）。sentiment=null 撤销。
const PostBody = z.object({
  messageId: z.string().min(1).max(120),
  sentiment: z.enum(["up", "down"]).nullable(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`fb:${user.id}`, 120, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!messageBelongsToUser(user.id, parsed.data.messageId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  setFeedback(user.id, parsed.data.messageId, parsed.data.sentiment);
  return NextResponse.json({ ok: true, sentiment: parsed.data.sentiment });
}
