import { prisma } from './src/lib/prisma';

async function run() {
  const integration = await prisma.integration.findFirst({
    where: { provider: "gemini", isActive: true }
  });
  const apiKey = (integration?.credentials as any)?.apiKey;
  
  const prompt = `Search the web to find the verified contact email address for the business "Service Plus Plumbing". 
Their website is https://www.serviceplusplumbingpdx.com/ and phone is (503) 927-4482. 
Return ONLY the full, exact email address string (e.g. contact@example.com). 
If you absolutely cannot find a real working email on the web, return exactly "NOT_FOUND". Do not guess or hallucinate incomplete emails.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
    }),
  });
  
  if (!response.ok) {
     console.error("HTTP ERROR:", await response.text());
     return;
  }
  const data = await response.json();
  console.log("RESPONSE DATA:", JSON.stringify(data, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
