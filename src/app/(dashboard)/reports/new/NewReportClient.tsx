"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { generateReportAction, type GenerateReportState } from "../actions";

interface Campaign {
  id: string;
  name: string;
}

const initialState: GenerateReportState = { success: false };

export default function NewReportClient({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(generateReportAction, initialState);
  const [reportType, setReportType] = useState<string>("CAMPAIGN");

  if (state.success) {
    setTimeout(() => router.push("/reports"), 2000);
    return (
      <div className="card p-12 text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Report Generated!</h2>
        <p className="text-gray-500">Your report has been created and is ready for analysis.</p>
        <p className="text-sm text-gray-400">Redirecting to reports list...</p>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <form action={action} className="space-y-6">
        <div className="space-y-2">
          <label className="form-label">Report Name</label>
          <input
            name="name"
            type="text"
            className="form-input"
            placeholder="e.g. Q3 Plumbing Outreach Performance"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="form-label">Report Type</label>
          <select
            name="type"
            className="form-input"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            required
          >
            <option value="CAMPAIGN">Campaign Deep-Dive</option>
            <option value="PERFORMANCE">Overall Lead Performance</option>
            <option value="ANALYTICS">Discovery Analytics</option>
            <option value="AUDIT">Campaign Audit Trail</option>
          </select>
          <p className="text-xs text-gray-400">
            {reportType === "CAMPAIGN" && "Analyzes conversion rates and data quality for a specific campaign."}
            {reportType === "PERFORMANCE" && "Broad overview of lead mining efficiency across all campaigns."}
            {reportType === "ANALYTICS" && "Technical report on AI discovery success and source distribution."}
            {reportType === "AUDIT" && "Compliance report showing history of data changes and outreach."}
          </p>
        </div>

        {reportType === "CAMPAIGN" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
            <label className="form-label">Target Campaign</label>
            <select name="campaignId" className="form-input" required>
              <option value="">-- Select a Campaign --</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {state.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{state.error}</p>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={isPending}
            className="btn-primary w-full py-3 text-lg"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Aggregating Data...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
