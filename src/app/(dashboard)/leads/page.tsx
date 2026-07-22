import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { BookmarkCheck, Search, Filter, Mail, Phone, Star, ExternalLink, Upload, Globe } from "lucide-react";
import { formatDate } from "@/lib/utils";

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

      {/* Leads table */}
      <div className="card">
        {leads.length === 0 ? (
          <div className="empty-state py-16">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
              <BookmarkCheck className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No leads found</h3>
            <p className="text-gray-400 text-sm mb-6">
              {sp.q ? "Try a different search term" : "Start by searching for business leads"}
            </p>
            <Link href="/search" className="btn-primary">
              <Search className="w-4 h-4" /> Search Leads
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input type="checkbox" className="rounded" />
                    </th>
                    <th>Business</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th>Rating</th>
                    <th>Score</th>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const cl = lead.campaignLeads[0];
                    return (
                      <tr key={lead.id}>
                        <td><input type="checkbox" className="rounded" /></td>
                        <td>
                          <div>
                            <p className="font-semibold text-gray-900">{lead.businessName}</p>
                            {lead.category && <p className="text-xs text-gray-400">{lead.category}</p>}
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 flex items-center gap-1">
                                <Globe className="w-3 h-3" /> Website
                              </a>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="space-y-0.5">
                            {lead.email && <p className="text-xs text-blue-600 truncate max-w-[180px]">{lead.email}</p>}
                            {lead.phone && <p className="text-xs text-gray-500">{lead.phone}</p>}
                          </div>
                        </td>
                        <td className="text-xs text-gray-500">
                          {[lead.city, lead.state].filter(Boolean).join(", ")}
                        </td>
                        <td>
                          {lead.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span className="text-sm font-medium">{lead.rating}</span>
                              {lead.reviewCount && <span className="text-xs text-gray-400">({lead.reviewCount})</span>}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${lead.qualityScore}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{lead.qualityScore}</span>
                          </div>
                        </td>
                        <td>
                          {cl && cl.campaign && (
                            <Link href={`/campaigns/${cl.campaign.id}`} className="text-xs text-amber-600 hover:text-amber-700 font-medium">
                              {cl.campaign.name}
                            </Link>
                          )}
                        </td>
                        <td>
                          {cl && (
                            <span className={`badge ${leadStatusColors[cl.status] || "badge-gray"}`}>
                              {cl.status.replace("_", " ")}
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-gray-400">{formatDate(lead.createdAt)}</td>
                        <td>
                          <Link href={`/leads/${lead.id}`} className="btn-ghost p-1.5">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 text-sm text-gray-400">
              Showing {leads.length} of {stats.total} leads
            </div>
          </>
        )}
      </div>
    </div>
  );
}



