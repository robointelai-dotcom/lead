import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();

  const [
    { data: user },
    { data: org }
  ] = await Promise.all([
    supabase.from("users").select("name, email").eq("id", session.userId).single(),
    supabase.from("organizations").select("name, slug, website, industry, timezone").eq("id", session.organizationId).single(),
  ]);

  return (
    <SettingsClient
      user={user || { name: null, email: session.email }}
      org={org || { name: session.organizationName, slug: "", website: null, industry: null, timezone: "UTC" }}
    />
  );
}
