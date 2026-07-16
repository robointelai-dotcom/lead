import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const integrations = await prisma.integration.findMany();
  const gInt = integrations.find(i => i.provider === 'gemini');
  const gKey = gInt?.credentials ? decryptToken((gInt.credentials as any).apiKey) : null;
  
  if (gKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${gKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Find the public email address for the business 'Sky Dental' located at https://skydentalnyc.com/. Only return the email address, nothing else." }] }],
        tools: [{ google_search: {} }]
      })
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());
