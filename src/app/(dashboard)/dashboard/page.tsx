import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import DashboardClient from "./DashboardClient";

export const metadata = { title: "Dashboard" };

async function getDashboardData(organizationId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const period = now.toISOString().slice(0, 7);

  // 1. Stats and Recent Data via Supabase JS
  // Fetch campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*, _count:campaign_leads(count)")
    .eq("organization_id", organizationId);

  // Fetch leads
  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", organizationId);

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .single();

  const { data: usage } = await supabase
    .from("usage_records")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("period", period)
    .single();

  const totalCampaigns = campaigns?.length || 0;
  const activeCampaigns = campaigns?.filter(c => c.status === "ACTIVE").length || 0;
  const totalLeads = leads?.length || 0;
  const newLeadsThisMonth = leads?.filter(l => l.created_at >= startOfMonth).length || 0;
  const leadsWithEmail = leads?.filter(l => l.email).length || 0;
  const leadsWithPhone = leads?.filter(l => l.phone).length || 0;

  // Recent Campaigns
  const { data: recentCampaignsRaw } = await supabase
    .from("campaigns")
    .select(`
      id, name, status, niche,
      leads:campaign_leads(count)
    `)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(5);

  // Recent Leads (CampaignLeads)
  const { data: campaignLeads } = await supabase
    .from("campaign_leads")
    .select(`
      id, status,
      lead:leads (business_name, category, city, email, phone, quality_score),
      campaign:campaigns (name)
    `)
    .eq("campaigns.organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(8);

  const stats = {
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    newLeadsThisMonth,
    leadsWithEmail,
    leadsWithPhone,
    qualifiedLeads: 0,
    wonLeads: 0,
    emailsSent: 0,
    avgOpenRate: 0,
    conversionRate: 0,
    remainingSearches: subscription
      ? subscription.monthly_search_limit - (usage?.searches_used || 0)
      : 0,
    searchLimit: subscription?.monthly_search_limit || 0,
  };

  return {
    stats,
    recentCampaigns: (recentCampaignsRaw || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      niche: c.niche,
      leadsCount: c.leads?.[0]?.count || 0,
      assignedUser: null,
    })),
    recentLeads: (campaignLeads || []).map((cl: any) => ({
      id: cl.id,
      businessName: cl.lead?.business_name,
      category: cl.lead?.category,
      city: cl.lead?.city,
      email: cl.lead?.email,
      phone: cl.lead?.phone,
      status: cl.status,
      campaignName: cl.campaign?.name,
      qualityScore: cl.lead?.quality_score || 0,
    })),
    leadGrowthData: [],
  };
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  console.log("[dashboard] entering page rendering");
  
  try {
    const session = await requireSession();
    console.log("[dashboard] session confirmed for", session.email);

    console.log("[dashboard] starting getDashboardData...");
    const data = await getDashboardData(session.organizationId);
    console.log("[dashboard] getDashboardData completed successfully");
    
    return <DashboardClient data={data} session={session} />;
  } catch (err: any) {
    // Re-throw Next.js internal errors
    if (err.digest?.startsWith("NEXT_REDIRECT") || err.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    
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
