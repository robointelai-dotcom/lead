"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getImportQueue } from "@/lib/queue";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { parse } from "csv-parse/sync";

export async function enqueueCsvImportAction(
  campaignId: string,
  csvText: string
) {
  const session = await requireSession();

  if (!campaignId) {
    return { success: false, error: "Campaign ID is required" };
  }

  if (!csvText) {
    return { success: false, error: "CSV content is empty" };
  }

  try {
    // Parse CSV
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      return { success: false, error: "No valid records found in CSV" };
    }

    // Limit to 1000 leads per import for safety
    const leads = records.slice(0, 1000);

    // Create a record in search_jobs to track this import
    const { data: job, error: jobError } = await supabase
      .from("search_jobs")
      .insert({
        organizationId: session.organizationId,
        createdByUserId: session.userId,
        campaignId,
        niche: "CSV Import",
        status: "PENDING",
        totalProcessed: 0,
        totalFound: 0,
        maxResults: leads.length,
      })
      .select("id")
      .single();

    if (jobError) throw jobError;

    const queue = getImportQueue();
    await queue.add("import", {
      organizationId: session.organizationId,
      campaignId,
      leads,
      jobId: job.id, // Pass job ID to worker
    });

    console.log(`[import-actions] enqueued import for org ${session.organizationId}, ${leads.length} leads`);

    revalidatePath("/automations");
    return { success: true, count: leads.length };
  } catch (err: any) {
    console.error("[import-actions] failed:", err);
    return { success: false, error: err.message || "Failed to parse CSV" };
  }
}

export async function stopAutomationAction(jobId: string) {
  const session = await requireSession();
  
  if (!jobId) return { success: false, error: "Job ID required" };

  try {
    const { error } = await supabase
      .from("search_jobs")
      .update({ status: "CANCELLED", updatedAt: new Date().toISOString() })
      .eq("id", jobId)
      .eq("organizationId", session.organizationId);

    if (error) throw error;

    revalidatePath("/automations");
    return { success: true };
  } catch (err: any) {
    console.error("[stop-automation] failed:", err);
    return { success: false, error: err.message || "Failed to stop automation" };
  }
}

export async function deleteAutomationAction(jobId: string) {
  const session = await requireSession();
  
  if (!jobId) return { success: false, error: "Job ID required" };

  try {
    const { error } = await supabase
      .from("search_jobs")
      .delete()
      .eq("id", jobId)
      .eq("organizationId", session.organizationId);

    if (error) throw error;

    revalidatePath("/automations");
    return { success: true };
  } catch (err: any) {
    console.error("[delete-automation] failed:", err);
    return { success: false, error: err.message || "Failed to delete automation" };
  }
}
