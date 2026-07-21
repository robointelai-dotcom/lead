import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CampaignForm from "@/components/campaigns/CampaignForm";

export const metadata = { title: "New Campaign" };

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const session = await requireSession();

  const { data: members = [] } = await supabase
    .from("organization_members")
    .select("*, user:users(*)")
    .eq("organizationId", session.organizationId)
    .eq("isActive", true);

  const displayMembers = (members || []).map((m: any) => ({
    id: m.id,
    name: m.user?.name || m.user?.email || "Unknown"
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
          <p className="text-gray-500 text-sm">Set up your lead generation campaign</p>
        </div>
      </div>

      <div className="card p-6">
        <CampaignForm
          members={displayMembers}
        />
      </div>
    </div>
  );
}
