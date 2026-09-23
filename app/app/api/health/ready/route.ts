import { NextResponse } from "next/server";
import { databaseReadiness } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const database = databaseReadiness();
    return NextResponse.json({ ok: true, service: "eduai-prism", database }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[health] database readiness failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, service: "eduai-prism" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
