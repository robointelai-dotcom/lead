import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";

export class IntegrationCredentialError extends Error {
  constructor(public provider: string, message: string) {
    super(`Integration Error (${provider}): ${message}`);
    this.name = "IntegrationCredentialError";
  }
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
    throw new IntegrationCredentialError(provider, "Integration is missing or inactive.");
  }

  const credentials = integration.credentials as Record<string, unknown> | null;
  if (!credentials || typeof credentials.apiKey !== "string") {
    throw new IntegrationCredentialError(provider, "API key is missing in database credentials.");
  }

  try {
    const decrypted = decryptToken(credentials.apiKey).trim();
    if (!decrypted) {
      throw new Error("Decrypted string is empty.");
    }
    return decrypted;
  } catch (err: any) {
    throw new IntegrationCredentialError(provider, `Failed to decrypt API key: ${err.message}`);
  }
}
