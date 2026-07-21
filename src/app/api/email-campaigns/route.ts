import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  campaignId: z.string().optional(),
  templateId: z.string().optional(),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  sendMode: z.enum(["immediate", "scheduled"]),
  scheduledAt: z.string().optional(),
  sendingLimit: z.number().default(50),
  delayBetweenMs: z.number().default(1000),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { sendMode, scheduledAt, campaignId, templateId, ...rest } = parsed.data;

  const { data: campaign, error } = await supabase
    .from("email_campaigns")
    .insert({
      organizationId: session.organizationId,
      createdByUserId: session.userId,
      campaignId: campaignId || null,
      templateId: templateId || null,
      status: sendMode === "scheduled" ? "SCHEDULED" : "DRAFT",
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      ...rest,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: campaign.id });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaigns, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("organizationId", session.organizationId)
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(campaigns);
}
