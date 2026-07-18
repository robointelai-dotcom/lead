import { getDecryptedApiKey } from "@/lib/integrations/credentials";
import { askOpenAIForEmail } from "@/lib/lead-provider";

export class OpenAIProviderError extends Error {
  constructor(public status: number, message: string) {
    super(`OpenAI API Error ${status}: ${message}`);
    this.name = "OpenAIProviderError";
  }
}

export async function findEmailWithOpenAI(
  organizationId: string,
  businessName: string,
  website: string,
  phone: string,
  address?: string
): Promise<string | undefined> {
  const apiKey = await getDecryptedApiKey(organizationId, "openai");
  try {
    return await askOpenAIForEmail(apiKey, businessName, website, phone, address);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = Number(message.match(/OpenAI API error (\d+)/i)?.[1] || 0);
    throw new OpenAIProviderError(status, message.replace(/^OpenAI API error \d+:\s*/i, ""));
  }
}
