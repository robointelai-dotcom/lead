import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId: session.organizationId,
      createdByUserId: session.userId,
      campaignId: campaignId || null,
      templateId: templateId || null,
      status: sendMode === "scheduled" ? "SCHEDULED" : "DRAFT",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      ...rest,
    },
  });

  return NextResponse.json({ id: campaign.id });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.emailCampaign.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}
