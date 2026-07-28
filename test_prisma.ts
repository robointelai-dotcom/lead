import { prisma } from "./src/lib/prisma";
async function run() {
  try {
    await prisma.integration.findFirst({ where: { organizationId: "123", provider: "gmass", foo: "bar" } as any });
  } catch (err: any) {
    console.log("MESSAGE LENGTH:", err.message.length);
    console.log("MESSAGE:", err.message);
  }
}
run();
