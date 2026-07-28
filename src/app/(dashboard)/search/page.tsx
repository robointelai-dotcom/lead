import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import SearchLeadsWorkerClient from "./SearchLeadsWorkerClient";

export const metadata = { title: "Search Leads" };

export default async function SearchLeadsPage() {
  const session = await requireSession();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organizationId", session.organizationId)
    .in("status", ["ACTIVE", "DRAFT"])
    .order("name", { ascending: true });

  const { data: gmass } = await supabase
    .from("integrations")
    .select("credentials")
    .eq("organizationId", session.organizationId)
    .eq("provider", "gmass")
    .eq("isActive", true)
    .maybeSingle();

  const defaultGmassTemplate = (gmass?.credentials as any)?.gmassTemplate || "";

  return <SearchLeadsWorkerClient campaigns={campaigns || []} defaultGmassTemplate={defaultGmassTemplate} />;
}
