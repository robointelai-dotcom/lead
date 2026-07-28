import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { findIntegrationApiKey } from "@/lib/integrations";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { prompt, lead } = await req.json();

    if (!prompt || !lead) {
      return NextResponse.json({ error: "Prompt and lead are required" }, { status: 400 });
    }

    // Get integrations
    const { data: integrations = [] } = await supabase
      .from("integrations")
      .select("*")
      .eq("organizationId", session.organizationId)
      .eq("isActive", true);

    const openaiKey = findIntegrationApiKey(integrations || [], "openai", ["OPENAI_API_KEY"]);
    const geminiKey = findIntegrationApiKey(integrations || [], "gemini", ["GEMINI_API_KEY", "GOOGLE_GEMINI_API_KEY"]);

    let generatedText = "";

    const systemPrompt = `You are an expert cold email copywriter. You are writing a highly personalized cold email based on a user's prompt. 
Lead Details:
Business Name: ${lead.businessName}
City: ${lead.city || "Unknown"}
Category: ${lead.category || "Business"}
Rating: ${lead.rating || "N/A"}

User Instructions:
${prompt}

Output ONLY the email body. Do not include subject line unless requested. Be concise and persuasive.`;

    // Try OpenAI first, then fallback to Gemini
    if (openaiKey) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: systemPrompt }],
            temperature: 0.7,
            max_tokens: 300,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          generatedText = data.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (err) {
        console.error("OpenAI failed:", err);
      }
    }

    if (!generatedText && geminiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 300 }
          }),
        });
        if (res.ok) {
          const data = await res.json();
          generatedText = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text?.trim() || "";
        }
      } catch (err) {
        console.error("Gemini failed:", err);
      }
    }

    if (!generatedText) {
      return NextResponse.json({ error: "Failed to generate email. Ensure AI integrations are active." }, { status: 500 });
    }

    return NextResponse.json({ email: generatedText });
  } catch (err: any) {
    console.error("[generate-email] error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
