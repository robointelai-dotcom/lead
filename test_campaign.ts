require("dotenv").config({ path: ".env.local" });
import { processEmailCampaignLocally } from "./src/lib/workers/emailCampaignWorker";
import { supabase } from "./src/lib/supabase";

async function main() {
  const { data: campaign } = await supabase.from("email_campaigns").select("id, organizationId").eq("status", "SENDING").limit(1).single();
  if (!campaign) {
    console.log("No SENDING campaign found");
    return;
  }
  console.log(`Processing campaign ${campaign.id} for org ${campaign.organizationId}`);
  await processEmailCampaignLocally(campaign.id, campaign.organizationId);
}

main().catch(console.error);
