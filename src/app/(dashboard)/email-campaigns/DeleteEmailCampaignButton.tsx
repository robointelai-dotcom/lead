"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteEmailCampaignAction } from "./actions";
import { useRouter } from "next/navigation";

export default function DeleteEmailCampaignButton({
  id,
  variant = "ghost",
  redirectAfterDelete = false
}: {
  id: string;
  variant?: "ghost" | "danger";
  redirectAfterDelete?: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this email campaign? This cannot be undone.")) return;
    
    setIsDeleting(true);
    const res = await deleteEmailCampaignAction(id);
    
    if (res.success) {
      if (redirectAfterDelete) {
        router.push("/email-campaigns");
      }
    } else {
      alert("Failed to delete email campaign: " + res.error);
      setIsDeleting(false);
    }
  };

  const className = variant === "danger" 
    ? "btn-secondary text-red-600 hover:bg-red-50 hover:border-red-200" 
    : "p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors";

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={className}
      title="Delete Campaign"
    >
      <Trash2 className="w-4 h-4" />
      {variant === "danger" && <span className="ml-2">{isDeleting ? "Deleting..." : "Delete"}</span>}
    </button>
  );
}
