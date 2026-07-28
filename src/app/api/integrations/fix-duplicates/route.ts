import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // 1. Fetch all integrations
    const { data: allIntegrations, error } = await supabase
      .from("integrations")
      .select("id, organizationId, provider, createdAt")
      .order("createdAt", { ascending: false });

    if (error) throw error;

    if (!allIntegrations || allIntegrations.length === 0) {
      return NextResponse.json({ success: true, message: "No integrations found." });
    }

    // 2. Find duplicates
    const seen = new Set<string>();
    const duplicateIds: string[] = [];

    for (const row of allIntegrations) {
      const key = `${row.organizationId}_${row.provider}`;
      if (seen.has(key)) {
        duplicateIds.push(row.id);
      } else {
        seen.add(key);
      }
    }

    // 3. Delete duplicates
    if (duplicateIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("integrations")
        .delete()
        .in("id", duplicateIds);
      
      if (deleteError) throw deleteError;
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${duplicateIds.length} duplicate integrations.`,
        deletedIds: duplicateIds
      });
    }

    return NextResponse.json({ success: true, message: "No duplicates found." });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
