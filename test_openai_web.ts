import { prisma } from './src/lib/prisma';
async function run() {
  const integration = await prisma.integration.findFirst({ where: { provider: "openai", isActive: true } });
  const apiKey = (integration?.credentials as any)?.apiKey;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Search the web and tell me the current weather in New York." }]
      })
  });
  const data = await res.json();
  console.log(data.choices?.[0]?.message?.content);
}
run().catch(console.error).finally(() => prisma.$disconnect());
