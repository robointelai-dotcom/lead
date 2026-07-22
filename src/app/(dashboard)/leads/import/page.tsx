import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ImportCsvClient from "./ImportCsvClient";

export const metadata = { title: "Import Leads via CSV" };

async function getCampaigns(organizationId: string) {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("organizationId", organizationId)
    .order("name", { ascending: true });
  
  return campaigns || [];
}

export default async function ImportLeadsPage() {
  const session = await requireSession();
  const campaigns = await getCampaigns(session.organizationId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Leads from CSV</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a CSV file of businesses. Missing emails will be auto-discovered by Power AI.
        </p>
      </div>

      <ImportCsvClient campaigns={campaigns} />

      <div className="card p-6 bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-amber-900 mb-2">CSV Format Guide</h3>
        <p className="text-sm text-amber-800 mb-4">
          For best results, ensure your CSV has headers that match these common names:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4">
          <div className="text-xs">
            <span className="font-bold">Business Name:</span><br/>
            businessName, company, name
          </div>
          <div className="text-xs">
            <span className="font-bold">Email:</span><br/>
            email
          </div>
          <div className="text-xs">
            <span className="font-bold">Phone:</span><br/>
            phone, telephone
          </div>
          <div className="text-xs">
            <span className="font-bold">Website:</span><br/>
            website, url
          </div>
          <div className="text-xs">
            <span className="font-bold">Location:</span><br/>
            address, city, state
          </div>
          <div className="text-xs">
            <span className="font-bold">Category:</span><br/>
            category, industry, niche
          </div>
        </div>
      </div>
    </div>
  );
}
