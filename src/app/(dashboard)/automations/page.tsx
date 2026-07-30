import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import AutomationsClient from "./AutomationsClient";

export const metadata = { title: "Automations" };

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const session = await requireSession();

  // Fetch active campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organizationId", session.organizationId)
    .in("status", ["ACTIVE", "DRAFT"])
    .order("name", { ascending: true });

  // Fetch recent automation jobs
  const { data: recentJobs } = await supabase
    .from("search_jobs")
    .select("*")
    .eq("organizationId", session.organizationId)
    .order("createdAt", { ascending: false })
    .limit(15);

  // Fetch recent email outreach logs
  // Need to join with leads to get business name if possible, or just display raw data
  const { data: rawEmailLogs } = await supabase
    .from("email_messages")
    .select(`
      *,
      lead:leads (
        businessName
      )
    `)
    // We only fetch messages for leads in this org implicitly via RLS, or we can filter by campaignId. 
    // Since we don't have orgId on email_messages directly, we rely on the implicit fetch or just fetch all since it's an admin view.
    // Actually, RLS might not protect it if orgId isn't on it. Wait, lead has organizationId.
    // Let's filter by leads!inner(organizationId)
    .eq("leads.organizationId", session.organizationId)
    .order("createdAt", { ascending: false })
    .limit(50);
    
  // However, Supabase syntax for inner join filtering:
  const { data: emailLogs } = await supabase
    .from("email_messages")
    .select("*, lead:leads!inner(businessName, organizationId)")
    .eq("leads.organizationId", session.organizationId)
    .order("createdAt", { ascending: false })
    .limit(50);

  return (
    <AutomationsClient 
      campaigns={campaigns || []} 
      recentJobs={recentJobs || []} 
      emailLogs={emailLogs || []}
    />
  );
}
