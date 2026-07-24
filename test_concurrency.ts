import { prisma } from './src/lib/prisma';
import { askGeminiForEmail } from './src/lib/discover-email';

async function run() {
  const gemini = await prisma.integration.findFirst({ where: { provider: "gemini", isActive: true } });
  const apiKey = (gemini?.credentials as any)?.apiKey;

  console.log("Starting 3 concurrent requests...");
  
  const results = await Promise.all([
    askGeminiForEmail(apiKey, "Dentist of America- Alexandria", "http://www.dentistofamerica.com/", "(703) 936-6522", "4800 Cherokee Ave, Alexandria, VA 22312, USA"),
    askGeminiForEmail(apiKey, "All In One Dental", "http://westchesterfamilydentists.com/", "(310) 645-6033", "8930 S Sepulveda Blvd #118, Los Angeles, CA 90045, USA"),
    askGeminiForEmail(apiKey, "DTLA Smile", "", "(213) 688-2828", "104 W 7th St #2, Los Angeles, CA 90014, USA")
  ]);

  console.log("Results:", results);
}
run().catch(console.error).finally(() => prisma.$disconnect());
