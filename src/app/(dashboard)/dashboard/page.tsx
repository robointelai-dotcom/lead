import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Dashboard" };

async function getDashboardData(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const period = now.toISOString().slice(0, 7);

  const [
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    newLeadsThisMonth,
    leadsWithEmail,
    leadsWithPhone,
    subscription,
    usage,
    recentCampaigns,
    campaignLeads,
  ] = await Promise.all([
    prisma.campaign.count({ where: { organizationId } }),
    prisma.campaign.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.lead.count({ where: { organizationId } }),
    prisma.lead.count({ where: { organizationId, createdAt: { gte: startOfMonth } } }),
    prisma.lead.count({ where: { organizationId, email: { not: null } } }),
    prisma.lead.count({ where: { organizationId, phone: { not: null } } }),
    prisma.subscription.findUnique({ where: { organizationId } }),
    prisma.usageRecord.findUnique({ where: { organizationId_period: { organizationId, period } } }),
    prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        _count: { select: { leads: true } },
        assignedUser: { include: { user: true } },
      },
    }),
    prisma.campaignLead.findMany({
      where: { campaign: { organizationId } },
      include: {
        lead: true,
        campaign: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const qualifiedLeads = await prisma.campaignLead.count({
    where: { campaign: { organizationId }, status: "QUALIFIED" },
  });

  const wonLeads = await prisma.campaignLead.count({
    where: { campaign: { organizationId }, status: "WON" },
  });

  const totalCampaignLeads = await prisma.campaignLead.count({
    where: { campaign: { organizationId } },
  });

  const emailsSent = await prisma.emailCampaign.aggregate({
    where: { organizationId },
    _sum: { totalSent: true },
  });

  const emailsOpened = await prisma.emailCampaign.aggregate({
    where: { organizationId },
    _sum: { totalOpened: true },
  });

  const avgOpenRate = emailsSent._sum.totalSent
    ? ((emailsOpened._sum.totalOpened || 0) / (emailsSent._sum.totalSent || 1)) * 100
    : 0;

  const conversionRate = totalCampaignLeads > 0 ? (wonLeads / totalCampaignLeads) * 100 : 0;

  // Lead growth data (last 6 months)
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      start: d,
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    });
  }

  const leadGrowthData = await Promise.all(
    months.map(async (m) => ({
      month: m.label,
      leads: await prisma.lead.count({
        where: { organizationId, createdAt: { gte: m.start, lte: m.end } },
      }),
    }))
  );

  return {
    stats: {
      totalCampaigns,
      activeCampaigns,
      totalLeads,
      newLeadsThisMonth,
      leadsWithEmail,
      leadsWithPhone,
      qualifiedLeads,
      wonLeads,
      emailsSent: emailsSent._sum.totalSent || 0,
      avgOpenRate,
      conversionRate,
      remainingSearches: subscription
        ? subscription.monthlySearchLimit - (usage?.searchesUsed || 0)
        : 0,
      searchLimit: subscription?.monthlySearchLimit || 0,
    },
    recentCampaigns: recentCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      niche: c.niche,
      leadsCount: c._count.leads,
      assignedUser: c.assignedUser?.user?.name || null,
    })),
    recentLeads: campaignLeads.map((cl) => ({
      id: cl.id,
      businessName: cl.lead.businessName,
      category: cl.lead.category,
      city: cl.lead.city,
      email: cl.lead.email,
      phone: cl.lead.phone,
      status: cl.status,
      campaignName: cl.campaign.name,
      qualityScore: cl.lead.qualityScore,
    })),
    leadGrowthData,
  };
}

export default async function DashboardPage() {
  console.log("[dashboard] entering page rendering");
  const session = await requireSession();
  console.log("[dashboard] session confirmed for", session.email);
  
  try {
    console.log("[dashboard] starting getDashboardData...");
    const data = await getDashboardData(session.organizationId);
    console.log("[dashboard] getDashboardData completed successfully");
    
    return <DashboardClient data={data} session={session} />;
  } catch (err: any) {
    console.error("[dashboard] crash in getDashboardData:", err);
    
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Dashboard Loading Error</h1>
        <div className="bg-red-50 p-6 border border-red-200 rounded-xl">
          <p className="text-red-800 font-semibold mb-2">The server encountered an error while fetching your dashboard data:</p>
          <pre className="text-xs bg-white p-4 rounded border border-red-100 overflow-auto max-h-60">
            {err.message || String(err)}
            {"\n\nStack:\n"}
            {err.stack}
          </pre>
          <p className="mt-4 text-sm text-red-600">
            This is usually caused by a database connection timeout or missing tables. 
            Please check your Hostinger runtime logs for more details.
          </p>
        </div>
      </div>
    );
  }
}
