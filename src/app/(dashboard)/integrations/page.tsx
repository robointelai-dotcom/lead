import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import IntegrationsClient from "./IntegrationsClient";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const session = await requireSession();

  const { data: integrations = [] } = await supabase
    .from("integrations")
    .select("provider, isActive")
    .eq("organizationId", session.organizationId);

  return <IntegrationsClient existingIntegrations={integrations || []} />;
}
