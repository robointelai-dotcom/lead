import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, Pause, Play, Archive, Users, Mail, Target, Phone, BarChart3, CheckCircle, Megaphone } from "lucide-react";
import { formatDate, formatPercent, formatNumber } from "@/lib/utils";
import CampaignHeaderActions from "@/components/campaigns/CampaignHeaderActions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("name")
    .eq("id", id)
    .single();
    
  return { title: campaign?.name || "Campaign" };
}

async function getCampaign(id: string, organizationId: string) {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select(`
      *,
      assignedUser:organization_members(
        *,
        user:users(*)
      ),
      tags:campaign_tags(
        *,
        tag:tags(*)
      ),
      leads:campaign_leads(
        *,
        lead:leads(*)
      )
    `)
    .eq("id", id)
    .eq("organizationId", organizationId)
    .single();

  if (!campaign) notFound();

  // Sort leads by createdAt desc and take 10 for the UI
  const recentLeads = (campaign.leads || [])
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  // Get total count separately
  const { count: totalLeads } = await supabase
    .from("campaign_leads")
    .select("*", { count: "exact", head: true })
    .eq("campaignId", id);

  const leadStats = {
    total: totalLeads || 0,
    withEmail: recentLeads.filter((l: any) => l.lead?.email).length,
    withPhone: recentLeads.filter((l: any) => l.lead?.phone).length,
    contacted: recentLeads.filter((l: any) => ["CONTACTED", "REPLIED", "QUALIFIED", "PROPOSAL_SENT", "WON"].includes(l.status)).length,
    qualified: recentLeads.filter((l: any) => l.status === "QUALIFIED").length,
    won: recentLeads.filter((l: any) => l.status === "WON").length,
  };

  return { 
    campaign: {
      ...campaign,
      leads: recentLeads
    }, 
    leadStats 
  };
}

const statusColors: Record<string, string> = {
  ACTIVE: "badge-green",
  DRAFT: "badge-gray",
  PAUSED: "badge-amber",
  ARCHIVED: "badge-gray",
  COMPLETED: "badge-blue",
};

const leadStatusColors: Record<string, string> = {
  NEW: "badge-blue",
  CONTACTED: "badge-amber",
  REPLIED: "badge-purple",
  QUALIFIED: "badge-green",
  PROPOSAL_SENT: "badge-indigo",
  WON: "badge-green",
  LOST: "badge-red",
  DO_NOT_CONTACT: "badge-red",
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const { campaign, leadStats } = await getCampaign(id, session.organizationId);

  const kpis = [
    { label: "Total Leads", value: formatNumber(leadStats.total), icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "With Email", value: formatNumber(leadStats.withEmail), icon: Mail, color: "bg-purple-50 text-purple-600" },
    { label: "With Phone", value: formatNumber(leadStats.withPhone), icon: Phone, color: "bg-green-50 text-green-600" },
    { label: "Contacted", value: formatNumber(leadStats.contacted), icon: CheckCircle, color: "bg-amber-50 text-amber-600" },
    { label: "Qualified", value: formatNumber(leadStats.qualified), icon: Target, color: "bg-indigo-50 text-indigo-600" },
    { label: "Won", value: formatNumber(leadStats.won), icon: BarChart3, color: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <span className={`badge ${statusColors[campaign.status]}`}>{campaign.status}</span>
          </div>
          {campaign.description && <p className="text-gray-500 text-sm mt-0.5">{campaign.description}</p>}
        </div>
        <CampaignHeaderActions campaignId={id} campaignName={campaign.name} />
      </div>

      {/* Campaign info */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="stat-card">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${kpi.color}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* Leads table */}
          <div className="card">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Recent Leads</h3>
              <Link href={`/leads?campaignId=${id}`} className="text-amber-600 text-sm font-medium">View all</Link>
            </div>
            {campaign.leads.length === 0 ? (
              <div className="empty-state">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No leads yet</p>
                <Link href={`/search?campaignId=${id}`} className="btn-primary mt-3 text-sm">Search Leads</Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Contact</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.leads.map((cl: any) => (
                      <tr key={cl.id}>
                        <td>
                          <div>
                            <p className="font-medium text-gray-900">{cl.lead?.businessName}</p>
                            <p className="text-xs text-gray-400">{cl.lead?.category}</p>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {cl.lead?.email && <p className="text-xs text-blue-600">{cl.lead?.email}</p>}
                            {cl.lead?.phone && <p className="text-xs text-gray-500">{cl.lead?.phone}</p>}
                          </div>
                        </td>
                        <td className="text-gray-500 text-xs">
                          {cl.lead ? [cl.lead.city, cl.lead.state].filter(Boolean).join(", ") : ""}
                        </td>
                        <td>
                          <span className={`badge ${leadStatusColors[cl.status] || "badge-gray"}`}>{cl.status.replace("_", " ")}</span>
                        </td>
                        <td>
                          <span className="text-sm font-semibold text-gray-700">{cl.lead?.qualityScore}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Campaign Details</h3>
            <dl className="space-y-3">
              {campaign.niche && (
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase">Niche</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{campaign.niche}</dd>
                </div>
              )}
              {campaign.city && (
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase">Location</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">
                    {[campaign.city, campaign.state, campaign.country].filter(Boolean).join(", ")}
                  </dd>
                </div>
              )}
              {campaign.goal && (
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase">Goal</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{campaign.goal}</dd>
                </div>
              )}
              {campaign.assignedUser && (
                <div>
                  <dt className="text-xs font-medium text-gray-400 uppercase">Assigned To</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{campaign.assignedUser.user?.name || campaign.assignedUser.user?.email}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase">Start Date</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatDate(campaign.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-400 uppercase">End Date</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{formatDate(campaign.endDate)}</dd>
              </div>
            </dl>
          </div>

          {(campaign.tags || []).length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {campaign.tags.map((ct: any) => (
                  <span
                    key={ct.tag?.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: ct.tag?.color + "20", color: ct.tag?.color }}
                  >
                    {ct.tag?.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link href={`/search?campaignId=${id}`} className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700">
                <Target className="w-4 h-4" /> Search Leads
              </Link>
              <Link href={`/email-campaigns/new?campaignId=${id}`} className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700">
                <Mail className="w-4 h-4" /> Email Campaign
              </Link>
              <Link href={`/reports/new?campaignId=${id}`} className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700">
                <BarChart3 className="w-4 h-4" /> Generate Report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
