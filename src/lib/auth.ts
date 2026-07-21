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
  
  // 1. Find user via Supabase JS
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .single();

  if (userError || !user || !user.passwordHash) {
    console.error("[auth] loginUser lookup failed:", userError?.message);
    return null;
  }

  // 2. Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  // 3. Find active membership + organization
  // Note: We use Postgres table names: organization_members and organizations
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
    console.error("[auth] membership lookup failed:", memberError?.message);
    return null;
  }

  const org = Array.isArray(membership.organizations) 
    ? membership.organizations[0] 
    : (membership.organizations as any);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organization_id,
    organizationName: org.name,
    role: membership.role,
    memberId: membership.id,
  };
}
