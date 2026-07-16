"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { Search, Loader2, Mail, Phone, Globe, CheckCircle2, AlertTriangle } from "lucide-react";
import { searchGooglePlacesAction, saveLeadAction, findEmailAction, type SearchActionState } from "./actions";
import type { BusinessLead } from "@/lib/lead-provider";

interface Campaign {
  id: string;
  name: string;
}

const initialState: SearchActionState = { success: false };

type SearchLead = BusinessLead & {
  name?: string;
  types?: string[];
  formatted_phone_number?: string;
  formatted_address?: string;
};

function normalizeSearchLeadSources(results: SearchLead[]): SearchLead[] {
  return results.map((lead) => {
    if (!lead.email || (lead.emailSources && lead.emailSources.length > 0)) return lead;
    return { ...lead, emailSources: ["Google Map"] };
  });
}

const NICHES = [
  "Restaurant", "Dentist", "Plumber", "Hair Salon", "Gym", "Lawyer", "Auto Repair",
  "Real Estate", "Bakery", "Coffee Shop", "Electrician", "HVAC", "Chiropractor",
  "Accountant", "Insurance", "Marketing Agency", "Web Design", "Photography",
];

function EmailBadge({ src }: { src: string }) {
  const label =
    src === "Gemini AI" || src === "AI Find" || src === "Power AI" ? "Power AI" :
    src === "GPT AI" || src === "Critical AI" ? "Critical AI" : 
    src === "Database" ? "Saved" : src;

  const cls =
    label === "Power AI"
      ? "bg-purple-50 text-purple-700 border-purple-200"
      : label === "Critical AI"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : label === "Web Scrape"
      ? "bg-blue-50 text-blue-600 border-blue-100"
      : label === "Saved"
      ? "bg-gray-50 text-gray-600 border-gray-200"
      : "bg-green-50 text-green-600 border-green-100";

  const icon = label === "Power AI" ? "⚡" : label === "Critical AI" ? "🔥" : label === "Saved" ? "📂" : null;

  return (
    <span className={`ml-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-semibold border ${cls}`}>
      {icon && <span>{icon}</span>}{label}
    </span>
  );
}

export default function SearchLeadsClient({
  campaigns,
}: {
  campaigns: Campaign[];
}) {
  const [state, action, isPending] = useActionState(searchGooglePlacesAction, initialState);
  const [saveCampaignId, setSaveCampaignId] = useState<string>("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [allResults, setAllResults] = useState<SearchLead[]>([]);
  const [findingAiIds, setFindingAiIds] = useState<Set<string>>(new Set());
  const [hasRunAiFor, setHasRunAiFor] = useState<Set<string>>(new Set());
  const isProcessingEmailBatch = useRef(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (state.success && state.results) {
      const results = normalizeSearchLeadSources(state.results as SearchLead[]);
      queueMicrotask(() => {
        if (state.searchParams?.pageToken) {
          setAllResults((prev) => [...prev, ...results]);
        } else {
          setAllResults(results);
          setSavedIds(new Set());
          setSavingIds(new Set());
          setHasRunAiFor(new Set()); // reset when new search
        }
      });
    }
  }, [state]);

  // Background Automatic AI Finder
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingEmailBatch.current) return;

      // Find leads that have NO email, and we haven't already run AI for them
      const toProcess = allResults.filter(r => !r.email && !hasRunAiFor.has(r.sourceId));
      if (toProcess.length === 0) return;

      // Process more concurrently for lightning speed
      const batch = toProcess.slice(0, 15);
      const batchIds = batch.map(b => b.sourceId);
      const emailUpdates: Array<{ sourceId: string; email: string; source: string }> = [];

      isProcessingEmailBatch.current = true;
      setFindingAiIds(prev => new Set([...prev, ...batchIds]));
      setHasRunAiFor(prev => new Set([...prev, ...batchIds]));

      await Promise.allSettled(batch.map(async (biz) => {
        try {
          const res = await findEmailAction(JSON.stringify(biz));
          if (res.success && res.email) {
            emailUpdates.push({ sourceId: biz.sourceId, email: res.email, source: res.source });
          } else if (!res.success && res.error && (res.error.includes("API Key") || res.error.includes("Billing") || res.error.includes("Quota"))) {
            setAiError(res.error);
          }
        } catch (e) {
          console.error("AI background error for", biz.businessName, e);
        }
      }));

      if (emailUpdates.length > 0) {
        const updatesById = new Map(emailUpdates.map(update => [update.sourceId, update]));
        setAllResults(prev => prev.map(r => {
          const update = updatesById.get(r.sourceId);
          return update ? { ...r, email: update.email, emailSources: [update.source] } : r;
        }));
      }

      setFindingAiIds(prev => {
        const next = new Set(prev);
        batchIds.forEach(id => next.delete(id));
        return next;
      });
      isProcessingEmailBatch.current = false;
    };

    if (allResults.length === 0 || isProcessingEmailBatch.current) return;

    const timer = window.setTimeout(() => {
      void processQueue();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [allResults, hasRunAiFor]);

  const handleSaveResult = async (biz: SearchLead) => {
    if (!saveCampaignId) {
      alert("Please select a campaign to save leads to.");
      return;
    }
    setSavingIds((prev) => new Set(prev).add(biz.sourceId));
    try {
      const res = await saveLeadAction(JSON.stringify(biz), saveCampaignId);
      if (res.success) {
        setSavedIds((prev) => new Set(prev).add(biz.sourceId));
      } else {
        alert("Failed to save lead: " + res.error);
      }
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(biz.sourceId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Google Places Search</h1>
        <p className="text-gray-500 text-sm">
          Find live business leads directly from Google Maps — emails auto-discovered by ⚡ Power AI &amp; 🔥 Critical AI
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-5">Search Parameters</h2>
        <form action={action} className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="form-label">Niche / Business Category</label>
              <select name="niche" className="form-input">
                <option value="">Any niche</option>
                {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="form-label">Country</label>
              <select name="country" className="form-input" defaultValue="United States">
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="form-label">Max Results</label>
              <select name="maxResults" className="form-input" defaultValue="20">
                <option value="20">20 Leads (Fastest)</option>
                <option value="60">60 Leads</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="form-label">State / Province</label>
              <input name="state" type="text" className="form-input" placeholder="e.g. NY" />
            </div>

            <div className="col-span-2">
              <label className="form-label">City</label>
              <input name="city" type="text" className="form-input" placeholder="e.g. New York" />
            </div>
          </div>

          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{state.error}</div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={isPending} className="btn-primary w-full md:w-auto px-8">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {isPending ? "Searching Places..." : "Search Places"}
            </button>
          </div>
        </form>
      </div>

      {/* Results List */}
      {state.success && allResults.length > 0 && (
        <div className="card p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Search Results ({allResults.length})</h2>
              <p className="text-sm text-gray-500">Select a campaign and save the leads you want</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Save to Campaign:</label>
              <select
                className="form-input w-full md:w-48 py-1.5 text-sm"
                value={saveCampaignId}
                onChange={(e) => setSaveCampaignId(e.target.value)}
              >
                <option value="">-- Select Campaign --</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {aiError && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{aiError}</p>
            </div>
          )}

          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {allResults.map((biz) => {
              const isSaved = savedIds.has(biz.sourceId);
              const isSaving = savingIds.has(biz.sourceId);

              return (
                <div key={biz.sourceId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      {biz.businessName || biz.name || "Unknown Business"}
                      {biz.rating && (
                        <span className="text-xs font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          ★ {biz.rating} ({biz.reviewCount || 0})
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {[biz.category || biz.types?.[0], biz.address].filter(Boolean).join(" · ")}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      {biz.email ? (
                        <span className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
                          <Mail className="w-3 h-3" /> {biz.email}
                          {biz.emailSources?.map((src: string) => (
                            <EmailBadge key={src} src={src} />
                          ))}
                        </span>
                      ) : findingAiIds.has(biz.sourceId) ? (
                        <span className="flex items-center gap-1 text-xs text-blue-500 flex-wrap">
                          <Loader2 className="w-3 h-3 animate-spin" /> Auto-finding email with AI...
                        </span>
                      ) : null}
                      {(biz.phone || biz.formatted_phone_number) && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="w-3 h-3" /> {biz.phone || biz.formatted_phone_number}
                        </span>
                      )}
                      {biz.website && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Globe className="w-3 h-3" />
                          <a href={biz.website} target="_blank" rel="noreferrer" className="hover:underline">
                            {biz.website}
                          </a>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <button
                      onClick={() => handleSaveResult(biz)}
                      disabled={isSaved || isSaving}
                      className={`btn-primary w-full sm:w-auto text-sm py-1.5 px-4 ${isSaved ? "bg-green-500 hover:bg-green-600 border-transparent text-white" : ""}`}
                    >
                      {isSaving ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</>
                      ) : isSaved ? (
                        <><CheckCircle2 className="w-4 h-4 mr-1" /> Saved</>
                      ) : (
                        "Save Lead"
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {state.success && allResults.length === 0 && (
        <div className="card p-10 text-center text-gray-500 text-sm">
          No results found for your search criteria.
        </div>
      )}
    </div>
  );
}
