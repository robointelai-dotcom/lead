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

  // Fetch recent automation jobs (SearchJobs)
  const { data: recentJobs } = await supabase
    .from("search_jobs")
    .select("*")
    .eq("organizationId", session.organizationId)
    .order("createdAt", { ascending: false })
    .limit(10);

  return (
    <AutomationsClient 
      campaigns={campaigns || []} 
      recentJobs={recentJobs || []} 
    />
  );
}
