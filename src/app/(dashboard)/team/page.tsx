import { requireSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Users, UserPlus, Crown, Shield, User, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Team Members" };

const roleConfig: Record<string, { label: string; icon: typeof Crown; badge: string }> = {
  OWNER: { label: "Owner", icon: Crown, badge: "badge-amber" },
  ADMINISTRATOR: { label: "Admin", icon: Shield, badge: "badge-purple" },
  MANAGER: { label: "Manager", icon: User, badge: "badge-blue" },
  AGENT: { label: "Agent", icon: User, badge: "badge-gray" },
  VIEWER: { label: "Viewer", icon: Eye, badge: "badge-gray" },
};

export default async function TeamPage() {
  const session = await requireSession();

  const { data: members = [] } = await supabase
    .from("organization_members")
    .select("*, user:users(*)")
    .eq("organizationId", session.organizationId)
    .order("joinedAt", { ascending: true });

  const displayMembers = members || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-500 text-sm">{displayMembers.length} member{displayMembers.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn-primary">
          <UserPlus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      <div className="card">
        <div className="divide-y divide-gray-50">
          {displayMembers.map((m: any) => {
            const role = roleConfig[m.role] || roleConfig.AGENT;
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                  {m.user?.image ? (
                    <img src={m.user.image} alt={m.user.name || ""} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {(m.user?.name || m.user?.email || "U")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{m.user?.name || "Unknown"}</p>
                  <p className="text-sm text-gray-400">{m.user?.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${role.badge}`}>
                    <role.icon className="w-3 h-3" /> {role.label}
                  </span>
                  <span className={`text-xs ${m.isActive ? "text-green-600" : "text-gray-400"}`}>
                    {m.isActive ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-gray-400">Joined {formatDate(m.joinedAt)}</span>
                  {m.userId !== session.userId && (
                    <button className="btn-ghost text-xs py-1.5 px-3 text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Role Permissions</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Owner</th>
                <th>Admin</th>
                <th>Manager</th>
                <th>Agent</th>
                <th>Viewer</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Manage Organization", true, true, false, false, false],
                ["Manage Team Members", true, true, false, false, false],
                ["Manage Campaigns", true, true, true, false, false],
                ["Search Leads", true, true, true, true, false],
                ["Manage Leads", true, true, true, true, false],
                ["Send Emails", true, true, true, true, false],
                ["View Reports", true, true, true, true, true],
                ["Export Data", true, true, true, false, false],
              ].map(([permission, ...perms]) => (
                <tr key={String(permission)}>
                  <td className="font-medium">{permission}</td>
                  {perms.map((p, i) => (
                    <td key={i} className="text-center">
                      {p ? <span className="text-green-500">✓</span> : <span className="text-gray-300">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
