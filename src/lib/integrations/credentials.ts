import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";

export class IntegrationCredentialError extends Error {
  constructor(public provider: string, message: string) {
    super(`Integration Error (${provider}): ${message}`);
    this.name = "IntegrationCredentialError";
  }
}

function normalizeApiKey(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function getEnvApiKey(provider: string): string | undefined {
  const envNames: Record<string, string[]> = {
    gemini: ["GEMINI_API_KEY", "GOOGLE_GEMINI_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    "google-places": ["GOOGLE_PLACES_API_KEY", "GOOGLE_MAPS_API_KEY"],
  };

  for (const name of envNames[provider] || []) {
    const value = process.env[name];
    if (value?.trim()) return normalizeApiKey(value);
  }

  return undefined;
}

/**
 * Shared helper to securely fetch and decrypt an API key for a given organization and provider.
 * Throws IntegrationCredentialError if missing or invalid, preventing silent failures.
 */
export async function getDecryptedApiKey(organizationId: string, provider: string): Promise<string> {
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      provider,
      isActive: true,
    },
  });

  if (!integration) {
    const envApiKey = getEnvApiKey(provider);
    if (envApiKey) return envApiKey;
    throw new IntegrationCredentialError(provider, "Integration is missing or inactive.");
  }

  const credentials = integration.credentials as Record<string, unknown> | null;
  if (!credentials || typeof credentials.apiKey !== "string") {
    const envApiKey = getEnvApiKey(provider);
    if (envApiKey) return envApiKey;
    throw new IntegrationCredentialError(provider, "API key is missing in database credentials.");
  }

  try {
    const decrypted = normalizeApiKey(decryptToken(credentials.apiKey));
    if (!decrypted) {
      throw new Error("Decrypted string is empty.");
    }
    return decrypted;
  } catch (err) {
    const fallback = normalizeApiKey(credentials.apiKey);
    if (fallback) return fallback;

    const envApiKey = getEnvApiKey(provider);
    if (envApiKey) return envApiKey;

    const message = err instanceof Error ? err.message : String(err);
    throw new IntegrationCredentialError(provider, `Failed to decrypt API key: ${message}`);
  }
}
