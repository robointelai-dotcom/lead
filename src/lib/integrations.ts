import { decryptToken } from "@/lib/crypto";

type IntegrationLike = {
  provider: string;
  credentials: unknown;
};

export function getIntegrationApiKey(credentials: unknown): string | undefined {
  if (!credentials || typeof credentials !== "object" || !("apiKey" in credentials)) {
    return undefined;
  }

  const apiKey = (credentials as { apiKey?: unknown }).apiKey;
  if (typeof apiKey !== "string" || !apiKey.trim()) return undefined;

  try {
    const decrypted = decryptToken(apiKey);
    return decrypted && decrypted.trim() ? decrypted : undefined;
  } catch {
    return apiKey;
  }
}

export function getEnvApiKey(names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }

  return undefined;
}

export function findIntegrationApiKey(
  integrations: IntegrationLike[],
  provider: string,
  envNames: string[] = []
): string | undefined {
  const integrationKey = getIntegrationApiKey(
    integrations.find((integration) => integration.provider === provider)?.credentials
  );

  return integrationKey || getEnvApiKey(envNames);
}
