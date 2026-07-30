import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import EmailLogsClient from "./EmailLogsClient";

export const metadata = { title: "Send Logs" };

export const dynamic = "force-dynamic";

export default async function EmailLogsPage() {
  const session = await requireSession();

  // Fetch recent email outreach logs
  const { data: emailLogs } = await supabase
    .from("email_messages")
    .select("*, lead:leads!inner(businessName, organizationId)")
    .eq("leads.organizationId", session.organizationId)
    .order("createdAt", { ascending: false })
    .limit(100);

  return (
    <EmailLogsClient 
      emailLogs={emailLogs || []}
    />
  );
}
