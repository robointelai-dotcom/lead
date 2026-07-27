import { supabase } from "./src/lib/supabase";
import { randomUUID } from "crypto";

async function run() {
  const { data, error } = await supabase.from("reports").insert({
    id: randomUUID(),
    organizationId: "123e4567-e89b-12d3-a456-426614174000",
    name: "Test Report",
    type: "AUDIT",
    data: {},
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log("Error:", error);
}
run();
