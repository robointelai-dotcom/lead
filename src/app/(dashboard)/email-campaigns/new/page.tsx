import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NewEmailCampaignClient from "./NewEmailCampaignClient";

export const metadata = { title: "New Email Campaign" };

export const dynamic = "force-dynamic";

export default async function NewEmailCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  const [campaigns, templates] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
    }),
    prisma.emailTemplate.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      select: { id: true, name: true, subject: true, htmlContent: true },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/email-campaigns" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Email Campaign</h1>
          <p className="text-gray-500 text-sm">Send personalized outreach to your leads</p>
        </div>
      </div>
      <NewEmailCampaignClient
        campaigns={campaigns}
        templates={templates}
        defaultCampaignId={sp.campaignId}
      />
    </div>
  );
}
