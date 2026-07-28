import { prisma } from "./src/lib/prisma";
async function run() {
  try {
    await prisma.integration.findFirst({ where: { organizationId: { foo: "bar" } } as any });
  } catch (err: any) {
    console.log("MESSAGE:", err.message);
  }
}
run();
