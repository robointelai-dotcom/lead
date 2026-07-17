import { prisma } from "./src/lib/prisma";
import { decryptToken } from "./src/lib/crypto";

async function main() {
  const org = await prisma.organization.findFirst();
  const integration = await prisma.integration.findFirst({
    where: { provider: "openai" }
  });
  console.log("OpenAI Integration:", integration ? "Exists" : "Null");
  if (integration && integration.credentials) {
    const creds = integration.credentials as any;
    console.log("Encrypted Key:", creds.apiKey);
    try {
      console.log("Decrypted Key:", decryptToken(creds.apiKey));
    } catch(e) {
      console.error("Decryption failed:", e);
    }
  }
}
main();
