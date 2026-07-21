import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "@/lib/supabase";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";
const SESSION_COOKIE = "leadflow_session";

export interface SessionUser {
  userId: string;
  email: string;
  name: string | null;
  organizationId: string;
  organizationName: string;
  role: string;
  memberId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(payload: SessionUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(
  session: SessionUser,
  roles: string[]
): Promise<void> {
  if (!roles.includes(session.role)) {
    redirect("/dashboard");
  }
}

export async function setSession(user: SessionUser): Promise<void> {
  const token = createToken(user);
  const cookieStore = await cookies();
  
  const isProd = process.env.NODE_ENV === "production";
  
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  const normalizedEmail = email.toLowerCase().trim();
  console.log("[auth] login attempt for:", normalizedEmail);
  
  // 1. Find user via Supabase JS
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .single();

  if (userError) {
    if (userError.code === "PGRST116") {
      throw new Error(`User account "${normalizedEmail}" not found in database. Did you run npm run fix-user?`);
    }
    throw new Error(`Database Error: ${userError.message}`);
  }
  
  if (!user) {
    throw new Error(`User account "${normalizedEmail}" not found.`);
  }

  if (!user.passwordHash) {
    throw new Error("User found but has no password set.");
  }

  // 2. Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error("Incorrect password. If you forgot it, run npm run fix-user to reset to 'password123'.");
  }

  // 3. Find active membership + organization
  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select(`
      id,
      role,
      organization_id,
      organizations (
        id,
        name
      )
    `)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (memberError || !membership) {
    throw new Error("Account found but no active organization membership was detected.");
  }

  const org = Array.isArray(membership.organizations) 
    ? membership.organizations[0] 
    : (membership.organizations as any);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organization_id,
    organizationName: org?.name || "Unknown",
    role: membership.role,
    memberId: membership.id,
  };
}
