import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GMassExportClient from "./GMassExportClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("name")
    .eq("id", id)
    .single();
    
  return { title: `GMass Export - ${campaign?.name || "Campaign"}` };
}

export default async function GMassExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(`
      id, name,
      leads:campaign_leads(
        lead:leads(
          id, businessName, email, phone, city, category, rating, website
        )
      )
    `)
    .eq("id", id)
    .eq("organizationId", session.organizationId)
    .single();

  if (!campaign) notFound();

  // Extract valid leads (with email)
  const validLeads = (campaign.leads || [])
    .map((cl: any) => cl.lead)
    .filter((l: any) => l && l.email);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/campaigns/${id}`} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GMass Integration & AI Prompt Manager</h1>
          <p className="text-gray-500 text-sm">Generate AI-personalized emails for GMass and automatically attach the AI Growth Readiness Report PDF link for {campaign.name}</p>
        </div>
      </div>

      <div className="card p-6">
        <GMassExportClient campaign={campaign} leads={validLeads} hostUrl={process.env.NEXT_PUBLIC_APP_URL || "https://yourdomain.com"} />
      </div>
    </div>
  );
}
