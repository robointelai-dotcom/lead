"use client";

import { useActionState, useState } from "react";
import { createCampaignAction, type CampaignActionState } from "@/app/(dashboard)/campaigns/actions";
import { useRouter } from "next/navigation";

const NICHES = [
  "Restaurant", "Dentist", "Plumber", "Hair Salon", "Gym", "Lawyer", "Auto Repair",
  "Real Estate", "Bakery", "Coffee Shop", "Electrician", "HVAC", "Roofer",
  "Landscaping", "Cleaning Service", "Chiropractor", "Accountant", "Insurance",
  "Marketing Agency", "Web Design", "Photography", "Fitness Trainer",
];

const STATUSES = ["DRAFT", "ACTIVE", "PAUSED"];

const COUNTRIES = ["US", "CA", "GB", "AU", "NZ", "IE"];

interface CampaignFormProps {
  members: { id: string; name: string }[];
  defaultValues?: {
    name?: string;
    description?: string;
    niche?: string;
    country?: string;
    state?: string;
    city?: string;
    goal?: string;
    assignedUserId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };
  campaignId?: string;
}

const initialState: CampaignActionState = { success: false };

export default function CampaignForm({ members, defaultValues, campaignId }: CampaignFormProps) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(createCampaignAction, initialState);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  if (state.success && state.campaignId) {
    router.push(`/campaigns/${state.campaignId}`);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="campaignId" value={campaignId || ""} />
      <input type="hidden" name="tags" value={JSON.stringify(tags)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <label className="form-label">Campaign Name *</label>
          <input name="name" type="text" className="form-input" placeholder="e.g. NYC Restaurants Q3 2025" defaultValue={defaultValues?.name} required />
          {state.fieldErrors?.name && <p className="form-error">{state.fieldErrors.name[0]}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="form-label">Description</label>
          <textarea name="description" rows={3} className="form-input resize-none" placeholder="What is this campaign about?" defaultValue={defaultValues?.description || ""} />
        </div>

        <div>
          <label className="form-label">Niche / Category</label>
          <select name="niche" className="form-input" defaultValue={defaultValues?.niche || ""}>
            <option value="">Select niche...</option>
            {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Status</label>
          <select name="status" className="form-input" defaultValue={defaultValues?.status || "DRAFT"}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Country</label>
          <select name="country" className="form-input" defaultValue={defaultValues?.country || "US"}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">State / Province</label>
          <input name="state" type="text" className="form-input" placeholder="e.g. NY" defaultValue={defaultValues?.state || ""} />
        </div>

        <div className="md:col-span-2">
          <label className="form-label">City</label>
          <input name="city" type="text" className="form-input" placeholder="e.g. New York" defaultValue={defaultValues?.city || ""} />
        </div>

        <div className="md:col-span-2">
          <label className="form-label">Goal</label>
          <textarea name="goal" rows={2} className="form-input resize-none" placeholder="What's the goal of this campaign?" defaultValue={defaultValues?.goal || ""} />
        </div>

        <div>
          <label className="form-label">Assigned To</label>
          <select name="assignedUserId" className="form-input" defaultValue={defaultValues?.assignedUserId || ""}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="form-label">Start Date</label>
          <input name="startDate" type="date" className="form-input" defaultValue={defaultValues?.startDate || ""} />
        </div>

        <div>
          <label className="form-label">End Date</label>
          <input name="endDate" type="date" className="form-input" defaultValue={defaultValues?.endDate || ""} />
        </div>

        <div>
          <label className="form-label">Tags</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              className="form-input flex-1"
              placeholder="Add tag, press Enter"
            />
            <button type="button" onClick={addTag} className="btn-secondary flex-shrink-0">Add</button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag) => (
                <span key={tag} className="badge badge-amber text-xs flex items-center gap-1">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-600">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {state.error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{state.error}</div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? "Saving..." : campaignId ? "Update Campaign" : "Create Campaign"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}
