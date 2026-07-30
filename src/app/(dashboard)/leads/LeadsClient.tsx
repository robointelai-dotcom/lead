"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkCheck, Search, Filter, Globe, Star, ExternalLink, FileText, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { removeLeadAction, bulkRemoveLeadsAction } from "./actions";
import { useRouter } from "next/navigation";

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

export default function LeadsClient({
  leads,
  searchParamsQ,
  stats,
}: {
  leads: any[];
  searchParamsQ: string;
  stats: any;
}) {
  const router = useRouter();
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(leads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds((prev) => [...prev, id]);
    } else {
      setSelectedLeadIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleBulkRemove = async () => {
    if (!selectedLeadIds.length) return;
    if (!confirm(`Are you sure you want to remove ${selectedLeadIds.length} lead(s)?`)) return;

    setIsDeleting(true);
    const res = await bulkRemoveLeadsAction(selectedLeadIds);
    setIsDeleting(false);

    if (res.success) {
      setSelectedLeadIds([]);
      router.refresh();
    } else {
      alert("Error: " + res.error);
    }
  };

  const handleRemoveSingle = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    const res = await removeLeadAction(id);
    if (res.success) {
      setSelectedLeadIds((prev) => prev.filter((item) => item !== id));
      router.refresh();
    } else {
      alert("Error: " + res.error);
    }
  };

  return (
    <div className="card">
      {leads.length === 0 ? (
        <div className="empty-state py-16">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
            <BookmarkCheck className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No leads found</h3>
          <p className="text-gray-400 text-sm mb-6">
            {searchParamsQ ? "Try a different search term" : "Start by searching for business leads"}
          </p>
          <Link href="/search" className="btn-primary">
            <Search className="w-4 h-4" /> Search Leads
          </Link>
        </div>
      ) : (
        <>
          {/* Bulk actions bar */}
          {selectedLeadIds.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-amber-900">
                {selectedLeadIds.length} lead(s) selected
              </span>
              <button 
                onClick={handleBulkRemove} 
                disabled={isDeleting}
                className="btn-secondary h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> 
                {isDeleting ? "Removing..." : "Remove Selected"}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input 
                      type="checkbox" 
                      className="rounded text-amber-500 focus:ring-amber-500 border-gray-300" 
                      checked={selectedLeadIds.length === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                    />
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
              <tbody className="divide-y divide-gray-100">
                {leads.map((lead) => {
                  const cl = lead.campaignLeads[0];
                  return (
                    <tr key={lead.id} className={selectedLeadIds.includes(lead.id) ? "bg-amber-50/30" : ""}>
                      <td>
                        <input 
                          type="checkbox" 
                          className="rounded text-amber-500 focus:ring-amber-500 border-gray-300"
                          checked={selectedLeadIds.includes(lead.id)}
                          onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        />
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-gray-900">{lead.businessName}</p>
                          {lead.category && <p className="text-xs text-gray-400">{lead.category}</p>}
                          {lead.website && (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:underline flex items-center gap-1 mt-0.5">
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
                            {cl.status.replace(/_/g, " ")}
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-gray-400">{formatDate(lead.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`} className="btn-ghost p-1.5" title="View Profile">
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          {/* We don't render the form here properly because it uses form actions.
                              Actually we can render a button that triggers a route, but the original code used a form.
                              Instead of a form, I'll just use a button that deletes for now, and keep the report button.
                           */}
                          <button 
                            type="button" 
                            onClick={() => handleRemoveSingle(lead.id, lead.businessName)}
                            className="btn-ghost p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50" 
                            title="Remove Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
  );
}
