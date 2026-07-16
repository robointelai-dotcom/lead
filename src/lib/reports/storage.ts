/**
 * Report Storage
 * --------------
 * Uploads generated report HTML to Supabase Storage and returns the
 * public URL. Bucket name is `reports` — the file will need to be in
 * a public bucket, or served via signed URLs.
 *
 * Path convention: `{organizationId}/{reportId}.html`
 *
 * Falls back gracefully — if Supabase isn't configured we return `null`
 * so the report worker can still persist HTML to the DB.
 */

import { getSupabase } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_REPORTS_BUCKET || "reports";

export interface UploadResult {
  url: string | null;
  path: string | null;
  error?: string;
}

async function ensureBucket(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    // Check existence — createBucket is idempotent when we catch the "already exists" case
    const { data: buckets } = await sb.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET);
    if (!exists) {
      const { error } = await sb.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: "5MB",
        allowedMimeTypes: ["text/html", "application/pdf"],
      });
      if (error && !/already exists/i.test(error.message)) {
        console.warn("[report-storage] createBucket warning:", error.message);
      } else {
        console.log(`[report-storage] Created bucket '${BUCKET}'`);
      }
    }
  } catch (err) {
    console.warn("[report-storage] ensureBucket failed:", (err as Error).message);
  }
}

export async function uploadReportHtml(
  organizationId: string,
  reportId: string,
  html: string
): Promise<UploadResult> {
  const sb = getSupabase();
  if (!sb) {
    return { url: null, path: null, error: "Supabase not configured" };
  }

  await ensureBucket();

  const path = `${organizationId}/${reportId}.html`;
  try {
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(path, html, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadErr) {
      console.error("[report-storage] upload failed:", uploadErr.message);
      return { url: null, path: null, error: uploadErr.message };
    }

    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    console.log(`[report-storage] uploaded ${path} → ${data.publicUrl}`);
    return { url: data.publicUrl, path };
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[report-storage] upload exception:", msg);
    return { url: null, path: null, error: msg };
  }
}
