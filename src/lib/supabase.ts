import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("[supabase] Missing environment variables: SUPABASE_URL or SUPABASE_API_KEY");
}

export const supabase = createClient(
  supabaseUrl || "https://dummy.supabase.co",
  supabaseKey || "dummy-key"
);
