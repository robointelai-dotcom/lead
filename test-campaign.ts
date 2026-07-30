import { supabase } from "./src/lib/supabase";
import { randomUUID } from "crypto";

async function run() {
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  
  if (!org) {
    console.log("No org found");
    return;
  }

  console.log("Inserting campaign for org", org.id);

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      id: randomUUID(),
      organizationId: org.id,
      name: "Test Campaign " + Date.now(),
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (campaignError) {
    console.error("Campaign Insert Error:", campaignError);
  } else {
    console.log("Success:", campaign);
    
    // Cleanup
    await supabase.from("campaigns").delete().eq("id", campaign.id);
  }
}

run();
