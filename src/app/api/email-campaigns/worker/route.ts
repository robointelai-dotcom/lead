import { NextRequest, NextResponse } from "next/server";
import { processEmailCampaignLocally } from "@/lib/workers/emailCampaignWorker";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const org = url.searchParams.get("org");

  if (!id || !org) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // We intentionally do NOT await this so the request completes immediately,
  // but since it's inside an API route, Node.js will keep processing it in the background
  // on a standard VPS / Hostinger environment.
  processEmailCampaignLocally(id, org).catch(console.error);

  return NextResponse.json({ success: true, message: "Worker triggered" });
}
