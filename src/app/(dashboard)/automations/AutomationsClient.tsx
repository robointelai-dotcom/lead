"use client";

import { useState } from "react";
import { Zap, Search, Loader2, CheckCircle2, XCircle, Clock, BarChart3, Plus, ArrowRight, FileUp, Info } from "lucide-react";
import { enqueueSearchJobAction } from "@/app/(dashboard)/search/actions";
import { enqueueCsvImportAction } from "./actions";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
}

interface AutomationJob {
  id: string;
  niche: string | null;
  state: string | null;
  city: string | null;
  status: string;
  totalFound: number;
  totalProcessed: number;
  createdAt: string;
}

const NICHES = [
  "Restaurant", "Dentist", "Plumber", "Hair Salon", "Gym", "Lawyer", "Auto Repair",
  "Real Estate", "Bakery", "Coffee Shop", "Electrician", "HVAC", "Chiropractor",
  "Accountant", "Insurance", "Marketing Agency", "Web Design", "Photography",
];

export default function AutomationsClient({
  campaigns,
  recentJobs,
}: {
  campaigns: Campaign[];
  recentJobs: any[];
}) {
  const [activeTab, setActiveTab] = useState<"search" | "csv">("search");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvCampaignId, setCsvCampaignId] = useState("");

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const data = {
      niche: formData.get("niche") as string,
      country: formData.get("country") as string,
      state: formData.get("state") as string,
      city: formData.get("city") as string,
      maxResults: parseInt(formData.get("maxResults") as string, 10),
      campaignId: formData.get("campaignId") as string,
      autoFindEmails: true,
      autoDispatchToGithub: false,
    };

    if (!data.campaignId) {
      setError("Please select a campaign.");
      setIsPending(false);
      return;
    }

    try {
      const res = await enqueueSearchJobAction(data);
      if (res.success) {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      } else {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile || !csvCampaignId) {
      setError("Please select both a file and a target campaign.");
      return;
    }

    setIsPending(true);
    setError(null);
    setSuccess(false);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const res = await enqueueCsvImportAction(csvCampaignId, text);
        if (res.success) {
          setSuccess(true);
          setCsvFile(null);
          setCsvCampaignId("");
        } else {
          setError(res.error || "Failed to process CSV");
        }
        setIsPending(false);
      };
      reader.readAsText(csvFile);
    } catch (err: any) {
      setError(err.message || "Failed to read file");
      setIsPending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="badge badge-green">Completed</span>;
      case "PROCESSING":
      case "RUNNING":
        return <span className="badge badge-blue flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running</span>;
      case "FAILED":
        return <span className="badge badge-red">Failed</span>;
      default:
        return <span className="badge badge-gray">Pending</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500 fill-amber-500" />
            LeadFlow Automations
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Set up automatic "search and save" tasks that run in the background.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setActiveTab("search"); setError(null); setSuccess(false); }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "search" ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Background Search
          </div>
        </button>
        <button
          onClick={() => { setActiveTab("csv"); setError(null); setSuccess(false); }}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "csv" ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <div className="flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            Bulk CSV Upload
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Automation Forms */}
        <div className="lg:col-span-2">
          {activeTab === "search" ? (
            <div className="card p-6 h-full">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-600" />
                New Location Search
              </h2>
              
              <form onSubmit={handleSearchSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="form-label">Niche / Category</label>
                    <select name="niche" className="form-input" required>
                      <option value="">Select a niche</option>
                      {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">Target Campaign</label>
                    <select name="campaignId" className="form-input" required>
                      <option value="">Select a campaign</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">City</label>
                    <input name="city" type="text" className="form-input" placeholder="e.g. Los Angeles" required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">State / Province</label>
                    <input name="state" type="text" className="form-input" placeholder="e.g. CA" required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">Country</label>
                    <select name="country" className="form-input">
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">Max Leads to Find</label>
                    <select name="maxResults" className="form-input" defaultValue="100">
                      <option value="20">20 Leads</option>
                      <option value="60">60 Leads</option>
                      <option value="100">100 Leads</option>
                      <option value="300">300 Leads</option>
                      <option value="500">500 Leads (Full Sweep)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-amber-100">
                    <Zap className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Automation Mode</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      Task will find businesses, discover emails with AI, and save them one-by-one.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Search automation successfully started!
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={isPending} 
                    className="btn-primary w-full md:w-auto px-10 h-11"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                    {isPending ? "Starting..." : "Start Search"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card p-6 h-full">
              <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <FileUp className="w-4 h-4 text-blue-600" />
                Bulk CSV Lead Import
              </h2>
              
              <form onSubmit={handleCsvSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="form-label">Target Campaign</label>
                    <select 
                      value={csvCampaignId} 
                      onChange={(e) => setCsvCampaignId(e.target.value)} 
                      className="form-input" 
                      required
                    >
                      <option value="">Select a campaign</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="form-label">Choose CSV File</label>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      className="form-input pt-1.5" 
                      required 
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-100">
                      <Info className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-blue-900">CSV Template Guide</p>
                      <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                        Your CSV should have a header row. We support these column names:
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 pl-13">
                    {["businessName", "email", "phone", "website", "city", "state", "category"].map(col => (
                      <span key={col} className="px-2 py-0.5 bg-white rounded text-[10px] font-mono border border-blue-100 text-blue-600">{col}</span>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    CSV Import successfully enqueued! We are processing your leads one by one.
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button 
                    type="submit" 
                    disabled={isPending} 
                    className="btn-primary w-full md:w-auto px-10 h-11 bg-blue-600 hover:bg-blue-700"
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
                    {isPending ? "Uploading..." : "Start Import"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="space-y-6">
          <div className="card p-5 bg-gray-900 text-white border-none shadow-lg">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              How it works
            </h3>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">1</div>
                <p className="text-xs text-gray-300">Jobs are enqueued to background workers on the server.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">2</div>
                <p className="text-xs text-gray-300">Missing emails are auto-discovered using Power AI & Critical AI.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">3</div>
                <p className="text-xs text-gray-300">Leads are saved one by one and linked to your campaign automatically.</p>
              </li>
            </ul>
            <Link href="/campaigns" className="mt-6 flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
              <span className="text-xs font-medium">Manage Campaigns</span>
              <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
            </Link>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Usage Tracker
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Imports are processed at 10 leads per batch to ensure high delivery and quality.
            </p>
            <Link href="/subscription" className="btn-secondary w-full text-xs">
              View Plan Limits
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Automations List */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Automations</h2>
          <button 
            onClick={() => window.location.reload()} 
            className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <Clock className="w-3 h-3" /> Refresh Status
          </button>
        </div>
        
        {recentJobs.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            No automations started yet. Use the form above to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Task</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Results</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentJobs.map((job: any) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 text-sm">{job.niche || "CSV Import"}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">ID: {job.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-gray-700">
                        {job.city ? `${job.city}, ${job.state}` : "Uploaded File"}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{job.country || ""}</div>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-gray-900">{job.totalFound}</span>
                        <span className="text-[10px] text-gray-500">leads saved</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
