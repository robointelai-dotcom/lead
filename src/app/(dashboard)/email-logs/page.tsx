import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import EmailLogsClient from "./EmailLogsClient";

export const metadata = { title: "Send Logs" };

export const dynamic = "force-dynamic";

export default async function EmailLogsPage() {
  const session = await requireSession();

  // Fetch recent email outreach logs
  const { data: messages } = await supabase
    .from("email_messages")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(100);

  let emailLogs = messages || [];

  if (emailLogs.length > 0) {
    const leadIds = [...new Set(emailLogs.map((m: any) => m.leadId).filter(Boolean))];
    
    if (leadIds.length > 0) {
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, businessName, organizationId")
        .in("id", leadIds)
        .eq("organizationId", session.organizationId);

      const leadsMap = new Map((leadsData || []).map((l: any) => [l.id, l]));
      
      // Filter logs to only those that belong to the user's organization leads
      emailLogs = emailLogs.filter((log: any) => leadsMap.has(log.leadId)).map((log: any) => ({
        ...log,
        lead: leadsMap.get(log.leadId)
      }));
    }
  }

  return (
    <EmailLogsClient 
      emailLogs={emailLogs}
    />
  );
}
