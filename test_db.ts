require("dotenv").config({ path: ".env.local" });
import { supabase } from "./src/lib/supabase";

async function main() {
  const { data, error } = await supabase
    .from("email_messages")
    .select("*, lead:leads!inner(businessName, organizationId)")
    .limit(1);
    
  console.log("Error:", error);
  console.log("Data:", data);
}

main().catch(console.error);
