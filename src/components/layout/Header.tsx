"use client";

import { Bell, LogOut, Search, ChevronDown } from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { useState } from "react";
import { logoutAction } from "@/app/(auth)/actions";

interface HeaderProps {
  session: SessionUser;
}

export default function Header({ session }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header
      className="h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4 flex-shrink-0 z-30"
    >
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search leads, campaigns..."
          className="form-input pl-9 py-2 text-sm bg-gray-50 border-gray-200 focus:bg-white"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Org badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-amber-700">{session.organizationName}</span>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {(session.name || session.email)[0].toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-gray-900">{session.name || "User"}</p>
              <p className="text-xs text-gray-400">{session.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-100 shadow-xl z-50 py-1">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-900 text-sm">{session.name}</p>
                <p className="text-gray-400 text-xs truncate">{session.email}</p>
              </div>
              <a href="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                Settings
              </a>
              <a href="/subscription" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                Subscription
              </a>
              <div className="border-t border-gray-100 mt-1">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
