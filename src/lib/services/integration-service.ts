import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { encryptToken } from "@/lib/crypto";

export type SaveIntegrationInput = {
  organizationId: string;
  type: import("@prisma/client").IntegrationType;
  name: string;
  provider: string;
  isActive: boolean;
  apiKey?: string;
  config?: Record<string, unknown>;
  providerFields?: Record<string, string | undefined>;
};

export async function saveIntegration(input: SaveIntegrationInput) {
  const { organizationId, provider, type, name, isActive, apiKey, config, providerFields } = input;

  // 1. Load existing to preserve credentials
  const { data: existingRecords, error: findError } = await supabase
    .from("integrations")
    .select("*")
    .eq("organizationId", organizationId)
    .eq("provider", provider)
    .limit(1);

  if (findError) throw findError;
  const existing = existingRecords?.[0];

  const existingCreds = (existing?.credentials as Record<string, any>) || {};
  const credentialsToStore: Record<string, any> = { ...existingCreds };

  if (apiKey && apiKey.trim()) {
    credentialsToStore.apiKey = encryptToken(apiKey.trim());
  } else if (!existing && provider !== "github" && provider !== "ghl") {
    // If it's a new generic integration, apiKey should not be blank unless it's a webhook
    if (provider === "gmass" || provider === "openai" || provider === "gemini") {
      throw new Error("API key is required for new connections.");
    }
  }

  // Handle specific fields and encrypt if needed
  const fields: Record<string, string> = {};
  if (providerFields) {
    if (providerFields.githubToken?.trim()) fields.githubToken = encryptToken(providerFields.githubToken.trim());
    if (providerFields.githubRepoOwner?.trim()) fields.githubRepoOwner = providerFields.githubRepoOwner.trim();
    if (providerFields.githubRepoName?.trim()) fields.githubRepoName = providerFields.githubRepoName.trim();
    if (providerFields.githubTargetBranch?.trim()) fields.githubTargetBranch = providerFields.githubTargetBranch.trim();
    
    if (providerFields.ghlAccessToken?.trim()) fields.ghlAccessToken = encryptToken(providerFields.ghlAccessToken.trim());
    if (providerFields.ghlRefreshToken?.trim()) fields.ghlRefreshToken = encryptToken(providerFields.ghlRefreshToken.trim());
    if (providerFields.ghlLocationId?.trim()) fields.ghlLocationId = providerFields.ghlLocationId.trim();

    if (providerFields.callfluentApiKey?.trim()) fields.callfluentApiKey = encryptToken(providerFields.callfluentApiKey.trim());
  }
  
  // Merge config, ensuring gmassTemplate isn't in credentials
  const configToStore = { ...((existing?.config as Record<string, any>) || {}), ...config };
  
  // Backwards compat: if gmassTemplate is in existing credentials, move it to config
  if (credentialsToStore.gmassTemplate !== undefined) {
     configToStore.gmassTemplate = credentialsToStore.gmassTemplate;
     delete credentialsToStore.gmassTemplate;
  }

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("integrations")
      .update({
        type,
        name,
        isActive,
        credentials: credentialsToStore,
        config: configToStore,
        updatedAt: new Date().toISOString(),
        ...fields,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data: created, error: createError } = await supabase
    .from("integrations")
    .insert({
      id: randomUUID(),
      organizationId,
      provider,
      type,
      name,
      isActive,
      credentials: credentialsToStore,
      config: configToStore,
      githubRepoOwner: "robointelai-dotcom",
      githubRepoName: "Workflow-Automation-",
      githubTargetBranch: "main",
      updatedAt: new Date().toISOString(),
      ...fields,
    })
    .select()
    .single();

  if (createError) throw createError;
  return created;
}

export async function disconnectIntegration(organizationId: string, provider: string) {
  const { data: existingRecords } = await supabase
    .from("integrations")
    .select("id")
    .eq("organizationId", organizationId)
    .eq("provider", provider)
    .limit(1);
    
  const existing = existingRecords?.[0];
  if (!existing) return null;

  const { data: updated, error } = await supabase
    .from("integrations")
    .update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}
