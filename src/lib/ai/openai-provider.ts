import { getDecryptedApiKey } from "@/lib/integrations/credentials";

const OPENAI_MODEL = "gpt-4o-mini";

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
  phone: string
): Promise<string | undefined> {
  const apiKey = await getDecryptedApiKey(organizationId, "openai");
  const endpoint = "https://api.openai.com/v1/chat/completions";

  const prompt = `Find the public email address for the business '${businessName}' located at ${website || "unknown website"} (Phone: ${phone || "unknown"}). Only return the email address, nothing else. Do not output markdown or labels.`;

  console.log(`[OpenAI AI] Starting search for: ${businessName}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 100,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`OpenAI Network/Timeout Error: ${err.message}`);
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[OpenAI AI] HTTP ${response.status}: ${errText.slice(0, 300)}`);
    throw new OpenAIProviderError(response.status, errText.slice(0, 200));
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();

  console.log(`[OpenAI AI] Output for ${businessName}: ${text}`);

  if (text && text.includes("@") && !text.includes(" ")) {
    return text.toLowerCase();
  }

  return undefined;
}
