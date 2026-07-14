import { prisma } from './src/lib/prisma';

async function run() {
  const integration = await prisma.integration.findFirst({ where: { provider: "gemini", isActive: true } });
  const apiKey = (integration?.credentials as any)?.apiKey;
  
  const name = "Dentist of America- Alexandria";
  const address = "4800 Cherokee Ave, Alexandria, VA 22312, USA";
  const website = "http://www.dentistofamerica.com/";
  const phone = "(703) 936-6522";
  
  const prompt = `You are a professional email researcher. Your task is to find the REAL, VERIFIED contact email address for this business:

Business: "${name}" at ${address}
Their website is ${website}.
Their phone is ${phone}.

Search strategy — check ALL of these sources in order:
1. Their official website (all pages: contact, about, team, staff)
2. Their Facebook Business Page (look in "About" section for email)
3. Their Instagram bio or posts mentioning email
4. Their LinkedIn company page
5. Yelp listing for this business (often shows owner email)
6. Google Business Profile / Google Maps listing
7. Better Business Bureau (BBB) profile
8. Yellowpages, Superpages, or similar directories
9. Any press releases, news articles, or local business features mentioning this company
10. Search: site:facebook.com "${name}" email
11. Search: "${name}" "${address || name}" email contact

Rules:
- Return ONLY the raw email address (example: info@example.com)
- The email MUST be a real address you found on an actual webpage
- Do NOT guess, fabricate, or create email addresses
- If you cannot find a real email after searching all sources above, return exactly: NOT_FOUND`;

  const start = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
    })
  });
  
  console.log(`Time taken: ${(Date.now() - start)/1000}s`);
  if (response.ok) {
     const data = await response.json();
     console.log(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
  } else {
     console.error(await response.text());
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
