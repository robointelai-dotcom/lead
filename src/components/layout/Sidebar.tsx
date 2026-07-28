"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, LayoutDashboard, Search, Megaphone, BookmarkCheck,
  BarChart3, Mail, FileText, Plug, Users, CreditCard,
  Settings, ChevronLeft, ChevronRight, X
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { useState } from "react";

const navGroups = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/search", icon: Search, label: "Search Leads" },
    ],
  },
  {
    label: "Campaigns",
    items: [
      { href: "/campaigns", icon: Megaphone, label: "Campaigns" },
      { href: "/leads", icon: BookmarkCheck, label: "Saved Leads" },
      { href: "/automations", icon: Zap, label: "Automations" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { href: "/email-campaigns", icon: Mail, label: "Email Campaigns" },
      { href: "/email-templates", icon: FileText, label: "Email Templates" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/reports", icon: BarChart3, label: "Reports" },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/team", icon: Users, label: "Team Members" },
      { href: "/integrations", icon: Plug, label: "Integrations" },
      { href: "/subscription", icon: CreditCard, label: "Subscription" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

interface SidebarProps {
  session: SessionUser;
}

export default function Sidebar({ session }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{ width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2d3048]">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-white text-sm whitespace-nowrap">LeadFlow Pro</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-3 mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        {!collapsed && (
          <div className="p-3 border-t border-[#2d3048]">
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#252831] transition-colors">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">
                  {(session.name || session.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">{session.name || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{session.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
