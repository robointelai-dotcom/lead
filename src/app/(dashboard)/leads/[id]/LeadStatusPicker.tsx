"use client";

import { useState, useTransition } from "react";
import { updateCampaignLeadStatusAction } from "../actions";

const STATUS_OPTIONS = [
  "NEW",
  "CONTACTED",
  "REPLIED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
  "DO_NOT_CONTACT",
] as const;

interface LeadStatusPickerProps {
  campaignLeadId: string;
  currentStatus: string;
}

/**
 * Inline status picker for a CampaignLead. Server action performs
 * the DB write inside a transaction, records LeadStatusHistory, and
 * (when the new status is QUALIFIED) auto-enqueues a GHL contact upsert.
 */
export default function LeadStatusPicker({
  campaignLeadId,
  currentStatus,
}: LeadStatusPickerProps) {
  const [status, setStatus] = useState(currentStatus);
  const [banner, setBanner] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    setStatus(next);

    startTransition(async () => {
      setBanner(null);
      try {
        const result = await updateCampaignLeadStatusAction({
          campaignLeadId,
          status: next as (typeof STATUS_OPTIONS)[number],
        });
        if (!result.success) {
          setBanner(`⚠ ${result.error || "Failed to update"}`);
          setStatus(currentStatus);
          return;
        }
        if (result.ghlSyncEnqueued) {
          setBanner("✓ Updated · GHL contact upsert enqueued");
        } else {
          setBanner("✓ Status updated");
        }
      } catch (err) {
        console.error(err);
        setBanner("⚠ Unexpected error");
        setStatus(currentStatus);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1" data-testid={`lead-status-picker-${campaignLeadId}`}>
      <select
        value={status}
        onChange={handleChange}
        disabled={isPending}
        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
        data-testid={`lead-status-select-${campaignLeadId}`}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {banner && (
        <span
          className={`text-[10px] ${banner.startsWith("✓") ? "text-green-600" : "text-red-600"}`}
          data-testid={`lead-status-banner-${campaignLeadId}`}
        >
          {banner}
        </span>
      )}
    </div>
  );
}
