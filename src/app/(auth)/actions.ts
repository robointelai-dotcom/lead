"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginUser, setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";


const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationName: z.string().min(2, "Organization name required"),
});

export type ActionResult = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function loginAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const session = await loginUser(parsed.data.email, parsed.data.password);
    if (!session) {
      return { success: false, error: "Invalid email or password" };
    }

    await setSession(session);
  } catch (err: any) {
    console.error("Login error:", err);
    let message = "An unexpected error occurred. Please try again.";
    
    const errMsg = err.message || "";
    if (errMsg.includes("connection") || errMsg.includes("reach database") || err.code === "P1001") {
      message = "Database connection failed. Please check your DATABASE_URL in Hostinger panel.";
    } else if (errMsg.includes("relation") || errMsg.includes("does not exist") || err.code === "P2021") {
      message = "Database tables are missing. Please run migrations or 'npx prisma db push'.";
    } else if (errMsg.includes("SSL")) {
      message = "Database SSL error. Try adding ?sslmode=no-verify to your connection string.";
    }
    
    return { success: false, error: message };
  }

  redirect("/dashboard");
}

export async function registerAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    organizationName: formData.get("organizationName") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();

  try {
    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return { success: false, error: "Email already in use" };
    }

    const passwordHash = await hashPassword(parsed.data.password);

    // Create org, user, membership, subscription
    const slug = generateSlug(parsed.data.organizationName);
    const org = await prisma.organization.create({
      data: {
        name: parsed.data.organizationName,
        slug,
      },
    });

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: parsed.data.name,
        passwordHash,
      },
    });

    const member = await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "OWNER",
        joinedAt: new Date(),
      },
    });

    const now = new Date();
    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        plan: "FREE",
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      organizationId: org.id,
      organizationName: org.name,
      role: "OWNER",
      memberId: member.id,
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    let message = "An unexpected error occurred. Please try again.";
    
    const errMsg = err.message || "";
    if (errMsg.includes("connection") || errMsg.includes("reach database") || err.code === "P1001") {
      message = "Database connection failed. Please check your DATABASE_URL.";
    } else if (errMsg.includes("relation") || errMsg.includes("does not exist") || err.code === "P2021") {
      message = "Database tables are missing. Please run migrations or 'npx prisma db push'.";
    }
    
    return { success: false, error: message };
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const { clearSession } = await import("@/lib/auth");
  await clearSession();
  redirect("/login");
}

// Helper for date arithmetic
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
