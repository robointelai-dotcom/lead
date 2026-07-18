import { getDecryptedApiKey } from "@/lib/integrations/credentials";
import { askGeminiForEmail } from "@/lib/lead-provider";

export class GeminiProviderError extends Error {
  constructor(public status: number, message: string) {
    super(`Gemini API Error ${status}: ${message}`);
    this.name = "GeminiProviderError";
  }
}

export async function findEmailWithGemini(
  organizationId: string,
  businessName: string,
  website: string,
  phone: string,
  address?: string
): Promise<string | undefined> {
  const apiKey = await getDecryptedApiKey(organizationId, "gemini");
  try {
    return await askGeminiForEmail(apiKey, businessName, website, phone, address);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = Number(message.match(/Gemini API error (\d+)/i)?.[1] || 0);
    throw new GeminiProviderError(status, message.replace(/^Gemini API error \d+:\s*/i, ""));
  }
}
