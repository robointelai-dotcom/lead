/**
 * Integrations Save Router Handler
 * --------------------------------
 * Consumes settings from the Integrations dashboard tab, encrypts all
 * sensitive secrets via `encryptToken`, and performs a single Prisma
 * upsert scoped by `organizationId`.
 *
 * Accepted body shape (all fields optional; only supplied fields are
 * written — existing values are preserved):
 *
 *   {
 *     provider: "github" | "ghl" | "callfluent" | "gemini" | "openai" | "google-places" | ...,
 *     name?: string,
 *     isActive?: boolean,
 *     apiKey?: string,                 // generic providers (gemini/openai/google-places)
 *     githubToken?: string,
 *     githubRepoOwner?: string,
 *     githubRepoName?: string,
 *     githubTargetBranch?: string,
 *     ghlAccessToken?: string,
 *     ghlRefreshToken?: string,
 *     ghlLocationId?: string,
 *     callfluentApiKey?: string,
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type IntegrationTypeStr = "LEAD_PROVIDER" | "EMAIL_PROVIDER" | "CRM" | "WEBHOOK";

interface SaveBody {
  provider?: string;
  name?: string;
  isActive?: boolean;
  apiKey?: string;

  githubToken?: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
  githubTargetBranch?: string;

  ghlAccessToken?: string;
  ghlRefreshToken?: string;
  ghlLocationId?: string;

  callfluentApiKey?: string;
}

function inferType(provider: string): IntegrationTypeStr {
  const p = provider.toLowerCase();
  if (p === "sendgrid" || p === "mailgun" || p === "resend") return "EMAIL_PROVIDER";
  if (p === "ghl" || p === "gohighlevel") return "CRM";
  if (p === "github" || p === "callfluent") return "WEBHOOK";
  return "LEAD_PROVIDER";
}

function inferName(provider: string): string {
  const map: Record<string, string> = {
    github: "GitHub Automation",
    ghl: "GoHighLevel CRM",
    callfluent: "Callfluent AI Voice",
    "google-places": "Google Places API",
    gemini: "Google Gemini AI",
    openai: "OpenAI GPT",
    sendgrid: "SendGrid",
    resend: "Resend",
    mailgun: "Mailgun",
  };
  return map[provider.toLowerCase()] || provider;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch (err) {
    console.error("[integrations/save] invalid JSON:", err);
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const provider = (body.provider || "").trim().toLowerCase();
  if (!provider) {
    return NextResponse.json(
      { success: false, error: "provider is required" },
      { status: 400 }
    );
  }

  try {
    const type = inferType(provider);
    const name = body.name?.trim() || inferName(provider);
    const isActive = body.isActive !== false;

    // Encrypt every secret we're about to write. Empty string -> "".
    const enc = (v?: string) => (v && v.trim() ? encryptToken(v.trim()) : undefined);

    const credentialsToStore =
      body.apiKey && body.apiKey.trim()
        ? { apiKey: encryptToken(body.apiKey.trim()) }
        : undefined;

    const updateData: Record<string, unknown> = {
      type,
      name,
      isActive,
    };
    if (credentialsToStore !== undefined) updateData.credentials = credentialsToStore;

    const githubToken = enc(body.githubToken);
    if (githubToken !== undefined) updateData.githubToken = githubToken;
    if (body.githubRepoOwner?.trim()) updateData.githubRepoOwner = body.githubRepoOwner.trim();
    if (body.githubRepoName?.trim()) updateData.githubRepoName = body.githubRepoName.trim();
    if (body.githubTargetBranch?.trim()) updateData.githubTargetBranch = body.githubTargetBranch.trim();

    const ghlAccess = enc(body.ghlAccessToken);
    if (ghlAccess !== undefined) updateData.ghlAccessToken = ghlAccess;
    const ghlRefresh = enc(body.ghlRefreshToken);
    if (ghlRefresh !== undefined) updateData.ghlRefreshToken = ghlRefresh;
    if (body.ghlLocationId?.trim()) updateData.ghlLocationId = body.ghlLocationId.trim();

    const callfluent = enc(body.callfluentApiKey);
    if (callfluent !== undefined) updateData.callfluentApiKey = callfluent;

    // Locate existing row for this org+provider (multi-tenant isolation)
    const { data: existing, error: findError } = await supabase
      .from("integrations")
      .select("id")
      .eq("organizationId", session.organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      const { error: updateError } = await supabase
        .from("integrations")
        .update(updateData)
        .eq("id", existing.id);
      
      if (updateError) throw updateError;

      console.log(
        `[integrations/save] updated ${provider} for org ${session.organizationId}`
      );
    } else {
      const { error: createError } = await supabase
        .from("integrations")
        .insert({
          organizationId: session.organizationId,
          provider,
          type,
          name,
          isActive,
          credentials: credentialsToStore || {},
          githubToken: updateData.githubToken as string | undefined,
          githubRepoOwner: (updateData.githubRepoOwner as string) || undefined,
          githubRepoName: (updateData.githubRepoName as string) || undefined,
          githubTargetBranch: (updateData.githubTargetBranch as string) || undefined,
          ghlAccessToken: updateData.ghlAccessToken as string | undefined,
          ghlRefreshToken: updateData.ghlRefreshToken as string | undefined,
          ghlLocationId: updateData.ghlLocationId as string | undefined,
          callfluentApiKey: updateData.callfluentApiKey as string | undefined,
        });
      
      if (createError) throw createError;

      console.log(
        `[integrations/save] created ${provider} for org ${session.organizationId}`
      );
    }

    revalidatePath("/integrations");
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[integrations/save] failed:", msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "integrations-save",
    method: "POST",
  });
}
