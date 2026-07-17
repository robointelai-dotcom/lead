import { getDecryptedApiKey } from "@/lib/integrations/credentials";

// The model we are forcing since Google deprecated 2.5 for new keys
const GEMINI_MODEL = "gemini-3.5-flash";

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
}

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
  phone: string
): Promise<string | undefined> {
  const apiKey = await getDecryptedApiKey(organizationId, "gemini");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const prompt = `Find the public email address for the business '${businessName}' located at ${website || "unknown website"} (Phone: ${phone || "unknown"}). Only return the email address, nothing else. Do not output markdown or labels.`;

  console.log(`[Gemini AI] Starting search for: ${businessName}`);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 500,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds for Gemini to use Search tool

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`Gemini Network/Timeout Error: ${err.message}`);
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Gemini AI] HTTP ${response.status}: ${errText.slice(0, 300)}`);
    throw new GeminiProviderError(response.status, errText.slice(0, 200));
  }

  const data = (await response.json()) as GeminiResponsePayload;
  const textPart = data.candidates?.[0]?.content?.parts?.find(p => typeof p.text === "string")?.text;
  const text = typeof textPart === "string" ? textPart.trim() : undefined;

  console.log(`[Gemini AI] Output for ${businessName}: ${text}`);

  if (text && text.includes("@") && !text.includes(" ")) {
    return text.toLowerCase();
  }

  return undefined;
}
