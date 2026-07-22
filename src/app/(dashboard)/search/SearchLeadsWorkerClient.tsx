"use client";

import { useActionState, useState, useEffect } from "react";
import { Search, Loader2, Mail, Phone, Globe, CheckCircle2, AlertCircle, Github, Rocket } from "lucide-react";
import { enqueueSearchJobAction, getSearchJobStatusAction, getSearchJobResultsAction, type EnqueueSearchResult, type SearchJobStatusDTO } from "./actions";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
}

const NICHES = [
  "Restaurant", "Dentist", "Plumber", "Hair Salon", "Gym", "Lawyer", "Auto Repair",
  "Real Estate", "Bakery", "Coffee Shop", "Electrician", "HVAC", "Chiropractor",
  "Accountant", "Insurance", "Marketing Agency", "Web Design", "Photography",
];

const initialState: EnqueueSearchResult = { success: false, error: "" };

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

export default function SearchLeadsWorkerClient({
  campaigns,
}: {
  campaigns: Campaign[];
}) {
  const [state, action, isPending] = useActionState(enqueueSearchJobAction, initialState);
  const [status, setStatus] = useState<SearchJobStatusDTO | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (state.success && "searchJobId" in state) {
      setIsPolling(true);
      setResults([]);
      const interval = setInterval(async () => {
        const currentStatus = await getSearchJobStatusAction(state.searchJobId);
        if (currentStatus) {
          setStatus(currentStatus);
          if (currentStatus.status === "COMPLETED") {
            setIsPolling(false);
            clearInterval(interval);
            const res = await getSearchJobResultsAction(state.searchJobId);
            if (res.success) setResults(res.results);
          } else if (currentStatus.status === "FAILED") {
            setIsPolling(false);
            clearInterval(interval);
          }
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [state.success, state]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Lead Mining</h1>
        <p className="text-gray-500 text-sm">
          Deep-search Google Maps with City Sweep technology and Power AI email discovery.
        </p>
      </div>

      {!state.success || isPolling || (status && status.status !== "COMPLETED") ? (
        <div className="card p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Search Parameters</h2>
          <form action={action} className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="form-label">Niche / Category</label>
                <select name="niche" className="form-input" required>
                  <option value="">Select a niche</option>
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
                <select name="maxResults" className="form-input" defaultValue="60">
                  <option value="20">20 Leads</option>
                  <option value="60">60 Leads</option>
                  <option value="100">100 Leads</option>
                  <option value="500">500 (City Sweep)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="form-label">City</label>
                <input name="city" type="text" className="form-input" placeholder="e.g. New York" required />
              </div>

              <div className="col-span-2">
                <label className="form-label">Target Campaign (Optional)</label>
                <select name="campaignId" className="form-input">
                  <option value="">-- No Campaign --</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <input type="checkbox" name="autoFindEmails" value="true" id="autoEmails" defaultChecked className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <label htmlFor="autoEmails" className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
                  <Rocket className="w-4 h-4" /> Run 4-stage Power AI Email Discovery
                </label>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <input type="checkbox" name="autoDispatchToGithub" value="true" id="autoGithub" className="w-4 h-4 text-slate-600 rounded border-gray-300 focus:ring-slate-500" />
                <label htmlFor="autoGithub" className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
                  <Github className="w-4 h-4" /> Auto-dispatch to GitHub Outreach
                </label>
              </div>
            </div>

            {!state.success && "error" in state && state.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {state.error}
              </div>
            )}

            {isPolling ? (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                    <span className="font-semibold text-gray-900">
                      {status?.status === "PROCESSING" ? "Mining Leads..." : "Queueing Job..."}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{status?.totalFound || 0} leads saved</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: status?.totalProcessed ? `${Math.min(100, (status.totalProcessed / (status.totalProcessed + 20)) * 100)}%` : "5%" }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <p className="text-lg font-bold">{status?.totalProcessed || 0}</p>
                    <p className="text-[9px] uppercase text-gray-400 font-bold">Processed</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <p className="text-lg font-bold text-green-600">{status?.totalFound || 0}</p>
                    <p className="text-[9px] uppercase text-gray-400 font-bold">New Leads</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <p className="text-lg font-bold text-blue-600">{status?.totalWithEmail || 0}</p>
                    <p className="text-[9px] uppercase text-gray-400 font-bold">Emails</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded text-center">
                    <p className="text-lg font-bold text-purple-600">{status?.totalWithPhone || 0}</p>
                    <p className="text-[9px] uppercase text-gray-400 font-bold">Phones</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button type="submit" disabled={isPending} className="btn-primary w-full md:w-auto px-8">
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isPending ? "Starting Engine..." : "Start Mining Engine"}
                </button>
              </div>
            )}
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6 bg-green-50 border-green-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="font-bold text-green-900">Mining Complete</h2>
                <p className="text-sm text-green-700">Found {results.length} unique leads and saved them to your database.</p>
              </div>
            </div>
            <button onClick={() => window.location.reload()} className="btn-primary text-sm">New Search</button>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Preview of Results</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {results.slice(0, 50).map((r: any) => {
                const biz = r.rawData;
                return (
                  <div key={r.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          {biz.businessName}
                          {biz.rating && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">★ {biz.rating}</span>}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{biz.category} · {biz.city}, {biz.state}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {biz.email && (
                            <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                              <Mail className="w-3 h-3" /> {biz.email}
                              {biz.emailSources?.map((s: string) => <EmailBadge key={s} src={s} />)}
                            </span>
                          )}
                          {biz.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                              <Phone className="w-3 h-3" /> {biz.phone}
                            </span>
                          )}
                          {biz.website && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                              <Globe className="w-3 h-3" /> {new URL(biz.website).hostname}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/leads/${r.leadId}`} className="btn-ghost p-1.5 rounded-lg border border-gray-200">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            {results.length > 50 && (
              <div className="p-4 text-center border-t border-gray-100 bg-gray-50/50 text-sm text-gray-500">
                Showing first 50 of {results.length} leads. <Link href="/leads" className="text-amber-600 font-medium hover:underline">View all saved leads →</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
