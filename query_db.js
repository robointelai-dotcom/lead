const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL || "https://dummy.supabase.co",
  process.env.SUPABASE_API_KEY || "dummy"
);

async function run() {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(3);
  console.log(JSON.stringify(data, null, 2));
}
run();
