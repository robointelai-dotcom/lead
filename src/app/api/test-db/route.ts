import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "MISSING";
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ":[MASKED]@");
  
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ success: true, userCount, maskedUrl, rawUrlLength: dbUrl.length });
  } catch (error: any) {
    return NextResponse.json({ success: false, maskedUrl, rawUrlLength: dbUrl.length, error: error?.message || String(error), stack: error?.stack });
  }
}
