import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveIntegration, SaveIntegrationInput } from "@/lib/services/integration-service";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IntegrationType } from "@prisma/client";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  provider: z.enum([
    "github", "ghl", "gohighlevel", "callfluent", 
    "google-places", "gemini", "openai", 
    "sendgrid", "resend", "mailgun", "gmass", "smtp"
  ]),
  name: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  apiKey: z.string().optional(),
  gmassTemplate: z.string().max(5000).optional(),
  githubToken: z.string().optional(),
  githubRepoOwner: z.string().optional(),
  githubRepoName: z.string().optional(),
  githubTargetBranch: z.string().optional(),
  ghlAccessToken: z.string().optional(),
  ghlRefreshToken: z.string().optional(),
  ghlLocationId: z.string().optional(),
  callfluentApiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromEmail: z.string().optional(),
  fromName: z.string().optional(),
});

function inferType(provider: string): IntegrationType {
  const p = provider.toLowerCase();
  if (p === "sendgrid" || p === "mailgun" || p === "resend" || p === "gmass" || p === "smtp") return "EMAIL_PROVIDER";
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
    gmass: "GMass API",
    smtp: "Custom SMTP",
  };
  return map[provider.toLowerCase()] || provider;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await req.json();
    if (rawBody.provider) rawBody.provider = rawBody.provider.trim().toLowerCase();

    const parsed = saveSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 });
    }
    const body = parsed.data;
    
    const provider = body.provider;
    const type = inferType(provider);
    const name = body.name?.trim() || inferName(provider);
    const isActive = body.isActive !== false;

    const input: SaveIntegrationInput = {
      organizationId: session.organizationId,
      provider,
      type,
      name,
      isActive,
      apiKey: body.apiKey,
      config: {
        ...(body.gmassTemplate !== undefined ? { gmassTemplate: body.gmassTemplate.trim() } : {}),
        ...(body.smtpHost !== undefined ? { smtpHost: body.smtpHost.trim() } : {}),
        ...(body.smtpPort !== undefined ? { smtpPort: body.smtpPort.trim() } : {}),
        ...(body.smtpUser !== undefined ? { smtpUser: body.smtpUser.trim() } : {}),
        ...(body.fromEmail !== undefined ? { fromEmail: body.fromEmail.trim() } : {}),
        ...(body.fromName !== undefined ? { fromName: body.fromName.trim() } : {}),
      },
      providerFields: {
        githubToken: body.githubToken,
        githubRepoOwner: body.githubRepoOwner,
        githubRepoName: body.githubRepoName,
        githubTargetBranch: body.githubTargetBranch,
        ghlAccessToken: body.ghlAccessToken,
        ghlRefreshToken: body.ghlRefreshToken,
        ghlLocationId: body.ghlLocationId,
        callfluentApiKey: body.callfluentApiKey,
        smtpPass: body.smtpPass,
      }
    };

    await saveIntegration(input);
    revalidatePath("/integrations");
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    let errorMsg = err instanceof Error ? err.message : (err?.message || JSON.stringify(err) || String(err));
    errorMsg = errorMsg.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    console.error(`[integrations/save] failed for org ${session?.organizationId}:`, err);
    return NextResponse.json(
      { success: false, error: `DEBUG ERROR: ${errorMsg}` },
      { status: 500 }
    );
  }
}
