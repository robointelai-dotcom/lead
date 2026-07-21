import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import SearchLeadsClient from "./SearchLeadsClient";

export const metadata = { title: "Search Leads" };

export default async function SearchLeadsPage() {
  const session = await requireSession();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organizationId", session.organizationId)
    .in("status", ["ACTIVE", "DRAFT"])
    .order("name", { ascending: true });

  return <SearchLeadsClient campaigns={campaigns || []} />;
}

