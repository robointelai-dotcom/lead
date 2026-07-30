import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { BookmarkCheck, Search, Filter, Mail, Phone, Star, ExternalLink, Upload, Globe, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import LeadsClient from "./LeadsClient";

export const metadata = { title: "Saved Leads" };

const leadStatusColors: Record<string, string> = {
  NEW: "badge-blue",
  CONTACTED: "badge-amber",
  REPLIED: "badge-purple",
  QUALIFIED: "badge-green",
  PROPOSAL_SENT: "badge-indigo",
  WON: "badge-green",
  LOST: "badge-red",
  DO_NOT_CONTACT: "badge-red",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; campaignId?: string }>;
}) {
  const session = await requireSession();
  const sp = await searchParams;

  let query = supabase
    .from("leads")
    .select(`
      *,
      campaignLeads:campaign_leads(
        *,
        campaign:campaigns(id, name)
      ),
      tags:lead_tags(
        tag:tags(name, color)
      )
    `)
    .eq("organizationId", session.organizationId)
    .order("createdAt", { ascending: false })
    .limit(50);

  if (sp.q) {
    query = query.or(`businessName.ilike.%${sp.q}%,email.ilike.%${sp.q}%,city.ilike.%${sp.q}%`);
  }

  const { data: leadsRaw } = await query;
  const leads = (leadsRaw || []).map(l => ({
    ...l,
    campaignLeads: (l.campaignLeads || []).sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }));

  const { count: totalCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", session.organizationId);

  const { count: withEmailCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", session.organizationId)
    .not("email", "is", null);

  const { count: withPhoneCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organizationId", session.organizationId)
    .not("phone", "is", null);

  const stats = {
    total: totalCount || 0,
    withEmail: withEmailCount || 0,
    withPhone: withPhoneCount || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Leads</h1>
          <p className="text-gray-500 text-sm">{stats.total} total leads</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/import" className="btn-primary text-sm">
            <Upload className="w-4 h-4" /> Import CSV
          </Link>
          <Link href="/search" className="btn-secondary text-sm">
            <Search className="w-4 h-4" /> Search Leads
          </Link>
          <Link href="/api/leads/export" className="btn-secondary text-sm">Export CSV</Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Leads</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-500" />
            <p className="text-2xl font-bold text-gray-900">{stats.withEmail}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">With Email</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-green-500" />
            <p className="text-2xl font-bold text-gray-900">{stats.withPhone}</p>
          </div>
          <p className="text-xs text-gray-500 mt-1">With Phone</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <form method="get">
              <input
                name="q"
                type="text"
                defaultValue={sp.q || ""}
                placeholder="Search leads by name, email, city..."
                className="form-input pl-9"
              />
            </form>
          </div>
          <button className="btn-secondary">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

      <LeadsClient 
        leads={leads} 
        searchParamsQ={sp.q || ""} 
        stats={stats} 
      />
    </div>
  );
}



