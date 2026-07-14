import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import CampaignCard from "@/components/campaigns/CampaignCard";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const session = await requireSession();

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { leads: true } },
      assignedUser: { include: { user: true } },
      tags: { include: { tag: true } },
    },
  });

  const stats = {
    total: campaigns.length,
    active: campaigns.filter((c) => c.status === "ACTIVE").length,
    paused: campaigns.filter((c) => c.status === "PAUSED").length,
    draft: campaigns.filter((c) => c.status === "DRAFT").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm">{stats.total} total · {stats.active} active</p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "bg-gray-100 text-gray-700" },
          { label: "Active", value: stats.active, color: "bg-green-100 text-green-700" },
          { label: "Paused", value: stats.paused, color: "bg-amber-100 text-amber-700" },
          { label: "Draft", value: stats.draft, color: "bg-blue-100 text-blue-700" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <span className={`badge mt-1 ${s.color}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Campaigns grid */}
      {campaigns.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
              <Megaphone className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No campaigns yet</h3>
            <p className="text-gray-400 text-sm mb-6">Create your first campaign to start finding and managing leads</p>
            <Link href="/campaigns/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Create Campaign
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={{
                id: campaign.id,
                name: campaign.name,
                description: campaign.description,
                niche: campaign.niche,
                country: campaign.country,
                state: campaign.state,
                city: campaign.city,
                status: campaign.status,
                leadsCount: campaign._count.leads,
                assignedUser: campaign.assignedUser?.user?.name || null,
                tags: campaign.tags.map((t) => ({ name: t.tag.name, color: t.tag.color })),
                startDate: campaign.startDate?.toISOString() || null,
                endDate: campaign.endDate?.toISOString() || null,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
