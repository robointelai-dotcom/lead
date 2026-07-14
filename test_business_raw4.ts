import { prisma } from './src/lib/prisma';

async function run() {
  const integration = await prisma.integration.findFirst({
    where: { provider: "gemini", isActive: true }
  });
  const apiKey = (integration?.credentials as any)?.apiKey;
  
  const prompt = `Find the public contact email address for the business "Business With The USA" located at 20533 Biscayne Blvd #469, Aventura, FL 33180. Phone: (786) 876-9555. Search thoroughly on Google (check their official website, Facebook page, Yelp, or other business directories). If you find a valid email address, make sure it is included in your response.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    }),
  });
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("TEXT:", text);
}
run().catch(console.error).finally(() => prisma.$disconnect());
