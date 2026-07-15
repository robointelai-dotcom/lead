import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ success: true, userCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error), stack: error?.stack });
  }
}
