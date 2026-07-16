"use client";

import { useState, useTransition } from "react";
import { ExternalLink, RefreshCw, Mail } from "lucide-react";
import { regenerateGrowthReportAction, resendGrowthReportAction } from "./actions";

interface Props {
  reportId: string;
  leadId: string;
  canOpen: boolean;
  canResend: boolean;
}

export default function GrowthReportsActions({ reportId, leadId, canOpen, canResend }: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRegenerate = () => {
    if (!confirm("Regenerate this report? This will re-run the audit and re-send the email if the lead has one.")) return;
    startTransition(async () => {
      setFeedback(null);
      const res = await regenerateGrowthReportAction({ leadId });
      setFeedback(res.success ? "✓ Queued" : `⚠ ${res.error || "Failed"}`);
    });
  };

  const handleResend = () => {
    if (!confirm("Re-send the report email to the lead's inbox?")) return;
    startTransition(async () => {
      setFeedback(null);
      const res = await resendGrowthReportAction(reportId);
      setFeedback(res.success ? "✓ Email re-queued" : `⚠ ${res.error || "Failed"}`);
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5" data-testid={`report-actions-${reportId}`}>
      {canOpen && (
        <a
          href={`/r/${reportId}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md font-medium"
          data-testid={`report-open-${reportId}`}
        >
          <ExternalLink className="w-3 h-3" /> Open
        </a>
      )}
      {canResend && (
        <button
          onClick={handleResend}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-md font-medium disabled:opacity-50"
          data-testid={`report-resend-${reportId}`}
        >
          <Mail className="w-3 h-3" /> Re-send
        </button>
      )}
      <button
        onClick={handleRegenerate}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2.5 py-1.5 rounded-md font-medium disabled:opacity-50"
        data-testid={`report-regenerate-${reportId}`}
      >
        <RefreshCw className={`w-3 h-3 ${isPending ? "animate-spin" : ""}`} /> Regen
      </button>
      {feedback && (
        <span
          className={`text-[10px] ml-1 ${feedback.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}
        >
          {feedback}
        </span>
      )}
    </div>
  );
}
