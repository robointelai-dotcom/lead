"use client";

import { useState } from "react";
import { Send, Pause, Play, Clock } from "lucide-react";
import { updateEmailCampaignStatusAction } from "./actions";
import { useRouter } from "next/navigation";

export default function PublishCampaignButton({
  id,
  currentStatus,
}: {
  id: string;
  currentStatus: string;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const handleUpdate = async (newStatus: string) => {
    setIsUpdating(true);
    const res = await updateEmailCampaignStatusAction(id, newStatus);
    
    if (res.success) {
      router.refresh();
    } else {
      alert("Failed to update campaign status: " + res.error);
    }
    setIsUpdating(false);
  };

  if (currentStatus === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleUpdate("SENDING")}
          disabled={isUpdating}
          className="btn-primary"
        >
          <Send className="w-4 h-4" />
          {isUpdating ? "Updating..." : "Send Now"}
        </button>
        <button
          onClick={() => handleUpdate("SCHEDULED")}
          disabled={isUpdating}
          className="btn-secondary text-blue-600 hover:bg-blue-50"
        >
          <Clock className="w-4 h-4" />
          {isUpdating ? "Updating..." : "Schedule"}
        </button>
      </div>
    );
  }

  if (currentStatus === "SCHEDULED" || currentStatus === "SENDING") {
    return (
      <button
        onClick={() => handleUpdate("PAUSED")}
        disabled={isUpdating}
        className="btn-secondary text-amber-600 hover:bg-amber-50"
      >
        <Pause className="w-4 h-4" />
        {isUpdating ? "Pausing..." : "Pause Campaign"}
      </button>
    );
  }

  if (currentStatus === "PAUSED") {
    return (
      <button
        onClick={() => handleUpdate("SCHEDULED")}
        disabled={isUpdating}
        className="btn-primary bg-emerald-600 hover:bg-emerald-700"
      >
        <Play className="w-4 h-4" />
        {isUpdating ? "Resuming..." : "Resume Campaign"}
      </button>
    );
  }

  return null;
}
