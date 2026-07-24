"use client";

import Link from "next/link";
import { Plus, BarChart3, FileText, Download, Trash2, Loader2, Copy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatDate } from "@/lib/utils";
import { deleteReportAction } from "./actions";
import { useState } from "react";

interface ReportsClientProps {
  reports: Array<{
    id: string;
    name: string;
    type: string;
    campaignName: string | null;
    createdByName: string | null;
    generatedAt: string | null;
    createdAt: string;
  }>;
  campaigns: Array<{ id: string; name: string }>;
  campaignData: Array<{ name: string; leads: number; status: string }>;
}

export default function ReportsClient({ reports, campaigns, campaignData }: ReportsClientProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    setDeletingId(id);
    try {
      await deleteReportAction(id);
    } catch (err) {
      alert("Failed to delete report");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/api/reports/${id}/export?format=csv`;
    navigator.clipboard.writeText(url);
    alert("Download link copied to clipboard!");
  };

  const campaignReports = reports.filter(r => r.type !== "AUDIT");
  const autoReports = reports.filter(r => r.type === "AUDIT");

  const renderReportList = (list: typeof reports, emptyMessage: string) => {
    if (list.length === 0) {
      return (
        <div className="empty-state py-8">
          <BarChart3 className="w-8 h-8 mb-3 opacity-30 mx-auto" />
          <p className="font-medium text-gray-500">{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-gray-50">
        {list.map((r) => (
          <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.type} · {r.campaignName || "No Campaign"} · {r.createdByName || "System"} · {formatDate(r.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button 
                onClick={() => handleCopyLink(r.id)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 bg-white border-gray-200"
                title="Copy Download Link"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Link
              </button>
              <a 
                href={`/api/reports/${r.id}/export?format=csv`}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                download
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              <button 
                onClick={() => handleDelete(r.id)}
                disabled={deletingId === r.id}
                className="btn-ghost p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
              >
                {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm">Analyze your lead generation performance</p>
        </div>
        <Link href="/reports/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Generate Report
        </Link>
      </div>

      {/* Campaign performance chart */}
      {campaignData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Campaign Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={campaignData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
              <Bar dataKey="leads" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign Reports list */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Campaign Reports
          </h3>
        </div>
        {renderReportList(campaignReports, "No campaign reports generated yet")}
      </div>

      {/* Auto-Generated Reports list */}
      <div className="card border-indigo-100 shadow-sm shadow-indigo-100/20">
        <div className="flex items-center justify-between p-5 border-b border-indigo-50 bg-indigo-50/30">
          <div>
            <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              Auto-Generated AI Growth Reports
            </h3>
            <p className="text-xs text-indigo-600/70 mt-1">
              Deep website audits generated automatically during lead mining.
            </p>
          </div>
        </div>
        {renderReportList(autoReports, "No auto-generated reports available. Enable this feature in the search settings.")}
      </div>
    </div>
  );
}
