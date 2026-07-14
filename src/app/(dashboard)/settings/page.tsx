import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession();

  const [user, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true, slug: true, website: true, industry: true, timezone: true },
    }),
  ]);

  return (
    <SettingsClient
      user={user || { name: null, email: session.email }}
      org={org || { name: session.organizationName, slug: "", website: null, industry: null, timezone: "UTC" }}
    />
  );
}
