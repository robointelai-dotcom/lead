import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "MISSING";
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":[MASKED]@");
  try {
    const sessionOrgId = "test-org-id"; // Just testing the database constraints
    await prisma.integration.create({
      data: {
        organizationId: sessionOrgId,
        type: "LEAD_PROVIDER",
        name: "Test",
        provider: "test-provider",
        credentials: { apiKey: "test" },
        isActive: true,
      },
    });
    return NextResponse.json({ success: true, message: "Integration created successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error), stack: error?.stack });
  }
}
