import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const session = await requireSession();

  const [reportsRes, campaignsRes] = await Promise.all([
    supabase
      .from("reports")
      .select(`
        *,
        campaign:campaigns(name),
        createdBy:users(name)
      `)
      .eq("organizationId", session.organizationId)
      .order("createdAt", { ascending: false })
      .limit(10),
    supabase
      .from("campaigns")
      .select(`
        id, name, status,
        leads:campaign_leads(count)
      `)
      .eq("organizationId", session.organizationId)
      .order("name", { ascending: true }),
  ]);

  const reportsRaw = reportsRes.data || [];
  const campaignsRaw = campaignsRes.data || [];

  // Campaign performance data for chart
  const campaignData = campaignsRaw.slice(0, 8).map((c: any) => ({
    name: c.name.length > 15 ? c.name.slice(0, 15) + "…" : c.name,
    leads: c.leads?.[0]?.count || 0,
    status: c.status,
  }));

  return <ReportsClient reports={reportsRaw.map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    campaignName: r.campaign?.name || null,
    createdByName: r.createdBy?.name || null,
    generatedAt: r.generatedAt ? new Date(r.generatedAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
  }))} campaigns={campaignsRaw.map((c: any) => ({ id: c.id, name: c.name }))} campaignData={campaignData} />;
}

