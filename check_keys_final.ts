import { prisma } from './src/lib/prisma'
import { decryptToken } from './src/lib/crypto'

async function test() {
  const org = await prisma.organization.findFirst({ where: { slug: 'acme-agency' }});
  const integrations = await prisma.integration.findMany({ where: { organizationId: org!.id }});
  const gInt = integrations.find(i => i.provider === 'gemini');
  const oInt = integrations.find(i => i.provider === 'openai');
  const gKey = gInt ? decryptToken((gInt.credentials as any).apiKey) : null;
  const oKey = oInt ? decryptToken((oInt.credentials as any).apiKey) : null;
  
  if (oKey) {
    console.log("Current OpenAI Key ends with:", oKey.substring(oKey.length - 10));
    console.log("OpenAI Key length:", oKey.length);
    const res = await fetch("https://api.openai.com/v1/models", { headers: { "Authorization": `Bearer ${oKey}` }});
    console.log("OpenAI API test status:", res.status);
    if (res.status === 401) console.log("OpenAI 401 error:", await res.text());
  } else {
    console.log("No OpenAI key found.");
  }

  if (gKey) {
    console.log("Current Gemini Key ends with:", gKey.substring(gKey.length - 10));
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${gKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
    });
    console.log("Gemini API test status:", res.status);
    if (res.status !== 200) console.log("Gemini error:", await res.text());
  }
}
test().catch(console.error).finally(() => prisma.$disconnect());
