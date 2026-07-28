import { getConfig } from "./config";

export interface ColdEmailGenerationInput {
  lead: {
    businessName: string;
    contactName?: string;
    email: string;
    website?: string;
    industry?: string;
    city?: string;
  };
  report: {
    summary: string;
    topFindings: Array<{
      title: string;
      evidence: string;
      recommendation: string;
    }>;
    reportUrl?: string;
  };
  campaign: {
    senderName: string;
    companyName: string;
    offer?: string;
    callToAction: string;
    tone: "professional" | "friendly" | "consultative";
  };
}

export interface GeneratedEmail {
  subject: string;
  html: string;
  text: string;
}

export async function generateAiEmail(input: ColdEmailGenerationInput): Promise<GeneratedEmail> {
  const config = getConfig();

  if (!config.ai.configured || !config.ai.provider) {
    return generateFallbackEmail(input);
  }

  const prompt = buildPrompt(input);

  try {
    if (config.ai.provider === "openai" && process.env.OPENAI_API_KEY) {
      return await callOpenAi(process.env.OPENAI_API_KEY, prompt, input);
    } else if (config.ai.provider === "gemini" && process.env.GEMINI_API_KEY) {
      return await callGemini(process.env.GEMINI_API_KEY, prompt, input);
    }
  } catch (error) {
    console.error(`[email-generator] AI generation failed (${config.ai.provider}):`, error);
  }

  // Fallback
  return generateFallbackEmail(input);
}

function buildPrompt(input: ColdEmailGenerationInput): string {
  const findingsList = input.report.topFindings
    .slice(0, 2)
    .map(f => `- ${f.title}: ${f.evidence}`)
    .join("\n");

  return `
Write a short, concise, ${input.campaign.tone} cold email to ${input.lead.contactName || "the owner"} of ${input.lead.businessName}.

Use the following website audit findings carefully. Do NOT invent or make up facts. Only mention 1 or 2 findings at most:
${findingsList}

Overall summary: ${input.report.summary}

Our offer: ${input.campaign.offer || "We help optimize local businesses."}
Call to action: ${input.campaign.callToAction}

Report Link to include: ${input.report.reportUrl || "No link provided"}

Sender: ${input.campaign.senderName} from ${input.campaign.companyName}

Format output as JSON:
{
  "subject": "Email subject line",
  "html": "HTML formatted email body with <br> and <p> tags",
  "text": "Plain text version of the email body"
}
`;
}

async function callOpenAi(apiKey: string, prompt: string, input: ColdEmailGenerationInput): Promise<GeneratedEmail> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  const content = JSON.parse(data.choices[0].message.content);
  return validateAndSanitizeOutput(content, input);
}

async function callGemini(apiKey: string, prompt: string, input: ColdEmailGenerationInput): Promise<GeneratedEmail> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  const content = JSON.parse(data.candidates[0].content.parts[0].text);
  return validateAndSanitizeOutput(content, input);
}

function validateAndSanitizeOutput(content: any, input: ColdEmailGenerationInput): GeneratedEmail {
  if (!content.subject || !content.html || !content.text) {
    throw new Error("AI returned malformed JSON structure.");
  }
  
  // Basic XSS sanitization (removing scripts, iframes, etc.)
  let safeHtml = content.html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/on\w+="[^"]*"/g, "");

  return {
    subject: content.subject,
    html: safeHtml,
    text: content.text,
  };
}

export function generateFallbackEmail(input: ColdEmailGenerationInput): GeneratedEmail {
  const greetingName = input.lead.contactName || input.lead.businessName;
  const finding = input.report.topFindings[0] 
    ? input.report.topFindings[0].title 
    : "some areas affecting your website's performance";

  const reportLine = input.report.reportUrl 
    ? `We prepared a short technical report with the supporting details:\n<a href="${input.report.reportUrl}">${input.report.reportUrl}</a>` 
    : "We prepared a short technical report with the supporting details.";
    
  const textReportLine = input.report.reportUrl 
    ? `We prepared a short technical report with the supporting details:\n${input.report.reportUrl}` 
    : "We prepared a short technical report with the supporting details.";

  const html = `
    <p>Hi ${greetingName},</p>
    <p>We reviewed the public-facing website for ${input.lead.businessName} and identified a few areas that may be affecting performance and lead conversion.</p>
    <p>One finding was: <strong>${finding}</strong>.</p>
    <p>${reportLine}</p>
    <p>${input.campaign.callToAction || "Would you be open to a brief discussion about the findings?"}</p>
    <br>
    <p>Regards,<br>
    ${input.campaign.senderName}<br>
    ${input.campaign.companyName}</p>
  `;

  const text = `Hi ${greetingName},

We reviewed the public-facing website for ${input.lead.businessName} and identified a few areas that may be affecting performance and lead conversion.

One finding was: ${finding}.

${textReportLine}

${input.campaign.callToAction || "Would you be open to a brief discussion about the findings?"}

Regards,
${input.campaign.senderName}
${input.campaign.companyName}`;

  return {
    subject: `Technical Review: ${input.lead.businessName}`,
    html,
    text,
  };
}
