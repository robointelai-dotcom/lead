"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginUser, setSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { generateSlug } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

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
    if (err.digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("Login error:", err);
    return { success: false, error: `Login failed: ${err.message || String(err)}` };
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
    // 1. Check if email already exists
    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      return { success: false, error: "Email already in use" };
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const slug = generateSlug(parsed.data.organizationName);

    // 2. Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: parsed.data.organizationName,
        slug,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // 3. Create user
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        name: parsed.data.name,
        passwordHash,
      })
      .select()
      .single();

    if (userError) throw userError;

    // 4. Create membership
    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "OWNER",
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (memberError) throw memberError;

    // 5. Create subscription
    const now = new Date();
    const { error: subError } = await supabase
      .from("subscriptions")
      .insert({
        organization_id: org.id,
        plan: "FREE",
        status: "ACTIVE",
        current_period_start: now.toISOString(),
        current_period_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (subError) throw subError;

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
    return { success: false, error: `Registration failed: ${err.message || String(err)}` };
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const { clearSession } = await import("@/lib/auth");
  await clearSession();
  redirect("/login");
}
