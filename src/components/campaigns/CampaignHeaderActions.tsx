"use client";

import { useState } from "react";
import { Trash2, Loader2, Pencil, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteCampaignAction } from "@/app/(dashboard)/campaigns/actions";

interface CampaignHeaderActionsProps {
  campaignId: string;
  campaignName: string;
}

export default function CampaignHeaderActions({ campaignId, campaignName }: CampaignHeaderActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the campaign "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteCampaignAction(campaignId);
      if (res.success) {
        router.push("/campaigns");
      } else {
        alert(res.error || "Failed to delete campaign");
        setIsDeleting(false);
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={`/search?campaignId=${campaignId}`} className="btn-secondary text-sm">
        <Target className="w-4 h-4" /> Search Leads
      </Link>
      <Link href={`/campaigns/${campaignId}/edit`} className="btn-secondary text-sm">
        <Pencil className="w-4 h-4" /> Edit
      </Link>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
      >
        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Delete
      </button>
    </div>
  );
}
