import { prisma } from "@/lib/prisma";
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
  const existing = await prisma.integration.findUnique({
    where: {
      organizationId_provider: {
        organizationId,
        provider,
      },
    },
  });

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

  return await prisma.integration.upsert({
    where: {
      organizationId_provider: {
        organizationId,
        provider,
      },
    },
    create: {
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
      ...fields,
    },
    update: {
      type,
      name,
      isActive,
      credentials: credentialsToStore,
      config: configToStore,
      ...fields,
    },
  });
}

export async function disconnectIntegration(organizationId: string, provider: string) {
  return await prisma.integration.update({
    where: {
      organizationId_provider: {
        organizationId,
        provider,
      },
    },
    data: {
      isActive: false,
    },
  });
}
