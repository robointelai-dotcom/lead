import { prisma } from './src/lib/prisma';
import { askOpenAIForEmail } from './src/lib/discover-email';

async function run() {
  const integration = await prisma.integration.findFirst({ where: { provider: "openai", isActive: true } });
  const apiKey = (integration?.credentials as any)?.apiKey;
  
  const email = await askOpenAIForEmail(
    apiKey,
    "Dentist of America- Alexandria",
    "http://www.dentistofamerica.com/",
    "(703) 936-6522",
    "4800 Cherokee Ave, Alexandria, VA 22312, USA"
  );
  console.log("Found email:", email);
}
run().catch(console.error).finally(() => prisma.$disconnect());
