"use client";

import Link from "next/link";
import { Megaphone, MapPin, Users, Calendar, ArrowRight, MoreVertical, Pencil, Pause, Archive, Trash2, Play, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { deleteCampaignAction, updateCampaignStatusAction } from "@/app/(dashboard)/campaigns/actions";

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    niche: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    status: string;
    leadsCount: number;
    assignedUser: string | null;
    tags: { name: string; color: string }[];
    startDate: string | null;
    endDate: string | null;
  };
}

const statusConfig: Record<string, { label: string; badge: string }> = {
  ACTIVE: { label: "Active", badge: "badge-green" },
  DRAFT: { label: "Draft", badge: "badge-gray" },
  PAUSED: { label: "Paused", badge: "badge-amber" },
  ARCHIVED: { label: "Archived", badge: "badge-gray" },
  COMPLETED: { label: "Completed", badge: "badge-blue" },
};

export default function CampaignCard({ campaign }: CampaignCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const status = statusConfig[campaign.status] || { label: campaign.status, badge: "badge-gray" };
  const location = [campaign.city, campaign.state, campaign.country].filter(Boolean).join(", ");

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the campaign "${campaign.name}"? This action cannot be undone.`)) {
      return;
    }
    setIsUpdating(true);
    try {
      const res = await deleteCampaignAction(campaign.id);
      if (!res.success) {
        alert(res.error || "Failed to delete campaign");
        setIsUpdating(false);
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred");
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async (newStatus: "ACTIVE" | "PAUSED" | "ARCHIVED") => {
    setIsUpdating(true);
    try {
      const res = await updateCampaignStatusAction(campaign.id, newStatus);
      if (!res.success) {
        alert(res.error || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
      alert("An unexpected error occurred");
    } finally {
      setIsUpdating(false);
      setShowMenu(false);
    }
  };

  return (
    <div className={`card p-5 relative ${isUpdating ? "opacity-60 pointer-events-none" : ""}`}>
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <Link href={`/campaigns/${campaign.id}`} className="font-semibold text-gray-900 hover:text-amber-600 transition-colors text-sm leading-tight">
              {campaign.name}
            </Link>
            <span className={`badge ${status.badge} text-xs ml-1`}>{status.label}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-100 shadow-lg z-10 py-1">
              <Link href={`/campaigns/${campaign.id}/edit`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Link>
              <button 
                onClick={() => handleStatusUpdate(campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
              >
                {campaign.status === "ACTIVE" ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
              </button>
              <button 
                onClick={() => handleStatusUpdate("ARCHIVED")}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
              <div className="border-t border-gray-100 mt-1">
                <button 
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {campaign.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{campaign.description}</p>
      )}

      <div className="space-y-1.5 mb-4">
        {campaign.niche && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Megaphone className="w-3.5 h-3.5" />
            <span>{campaign.niche}</span>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>{location}</span>
          </div>
        )}
        {campaign.assignedUser && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{campaign.assignedUser}</span>
          </div>
        )}
        {campaign.startDate && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(campaign.startDate)} – {campaign.endDate ? formatDate(campaign.endDate) : "Ongoing"}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {campaign.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {campaign.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.name}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: tag.color + "20", color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {campaign.tags.length > 3 && (
            <span className="badge badge-gray">+{campaign.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Users className="w-4 h-4 text-gray-400" />
          {campaign.leadsCount} leads
        </div>
        <Link
          href={`/campaigns/${campaign.id}`}
          className="flex items-center gap-1 text-amber-600 text-sm font-medium hover:text-amber-700"
        >
          Open <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
