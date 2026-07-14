import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, "");
}

export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

export function calculateQualityScore(lead: {
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  isVerified?: boolean;
  isClaimed?: boolean;
  facebook?: string | null;
  instagram?: string | null;
}): number {
  let score = 0;
  if (lead.email) score += 25;
  if (lead.phone) score += 20;
  if (lead.website) score += 15;
  if (lead.rating && lead.rating >= 4) score += 15;
  if (lead.reviewCount && lead.reviewCount >= 10) score += 10;
  if (lead.isVerified) score += 10;
  if (lead.isClaimed) score += 5;
  if (lead.facebook || lead.instagram) score += 5;
  return Math.min(score, 100);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateSlug(name: string): string {
  return slugify(name) + "-" + Math.random().toString(36).slice(2, 7);
}
