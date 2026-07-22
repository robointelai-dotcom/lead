import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import NewReportClient from "./NewReportClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "New Report" };

export default async function NewReportPage() {
  const session = await requireSession();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organizationId", session.organizationId)
    .order("name", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="btn-ghost p-2 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate New Report</h1>
          <p className="text-gray-500 text-sm">Choose parameters for your performance analysis</p>
        </div>
      </div>

      <NewReportClient campaigns={campaigns || []} />
    </div>
  );
}
