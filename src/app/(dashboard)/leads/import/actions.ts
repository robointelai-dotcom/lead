"use server";

import { z } from "zod";
import { parse } from "csv-parse/sync";
import { requireSession } from "@/lib/auth";
import { getImportQueue } from "@/lib/queue";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const importSchema = z.object({
  campaignId: z.string().min(1, "Please select a target campaign"),
});

export type ImportActionState = {
  success: boolean;
  error?: string;
  jobId?: string;
};

/**
 * Server Action to parse an uploaded CSV and enqueue a background import job.
 */
export async function uploadCsvAction(
  _prev: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  const session = await requireSession();

  const campaignId = formData.get("campaignId") as string;
  const autoDispatch = formData.get("autoDispatchToGithub") === "true";
  const file = formData.get("file") as File;

  const parsed = importSchema.safeParse({ campaignId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (!file || file.size === 0) {
    return { success: false, error: "Please select a CSV file to upload" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const records = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      return { success: false, error: "The CSV file appears to be empty or invalid" };
    }

    // Create a SearchJob record to track progress (reusing search_jobs table for import tracking)
    const { data: searchJob, error: insertError } = await supabase
      .from("search_jobs")
      .insert({
        organizationId: session.organizationId,
        createdByUserId: session.userId,
        campaignId: campaignId,
        niche: "CSV Import",
        status: "PENDING",
        totalProcessed: 0,
        totalFound: 0,
        maxResults: records.length,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    const queue = getImportQueue();
    const job = await queue.add(
      "import",
      {
        organizationId: session.organizationId,
        campaignId: campaignId,
        leads: records,
        jobId: searchJob.id,
        autoDispatchToGithub: autoDispatch,
      },
      { jobId: `import-${searchJob.id}` }
    );

    console.log(
      `[import-actions] enqueued import job ${job.id} for org ${session.organizationId} (${records.length} records)`
    );

    revalidatePath("/leads");
    revalidatePath(`/campaigns/${campaignId}`);

    return { success: true, jobId: searchJob.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[import-actions] upload failed:", msg);
    return { success: false, error: `Failed to process CSV: ${msg}` };
  }
}
