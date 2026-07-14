"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ActionResult } from "../actions";
import { Mail, Lock, Zap, Eye, EyeOff, ArrowRight, BarChart3, Users, Target } from "lucide-react";
import { loginAction } from "../actions";

const initialState: ActionResult = { success: false };

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#1a1c23] text-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">LeadFlow Pro</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              Turn cold leads into{" "}
              <span className="text-amber-400">warm opportunities</span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              The complete platform for finding, managing, and converting local business leads at scale.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Target, title: "Smart Lead Search", desc: "Find qualified leads from any niche, city, or country" },
              { icon: BarChart3, title: "Campaign Analytics", desc: "Track every lead's journey from search to conversion" },
              { icon: Users, title: "Team Collaboration", desc: "Assign leads and campaigns to your team members" },
            ].map((feature) => (
              <div key={feature.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">{feature.title}</p>
                  <p className="text-gray-400 text-sm">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          © 2025 LeadFlow Pro. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 bg-[#f8f9fb]">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">LeadFlow Pro</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-gray-500">Sign in to your account to continue</p>
            </div>

            {state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <span className="text-red-500">⚠</span>
                {state.error}
              </div>
            )}

            <form action={action} className="space-y-5">
              <div>
                <label className="form-label" htmlFor="email">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="form-input pl-10"
                    defaultValue="admin@acme.com"
                    required
                  />
                </div>
                {state.fieldErrors?.email && (
                  <p className="form-error">{state.fieldErrors.email[0]}</p>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="password">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="form-input pl-10 pr-10"
                    defaultValue="password123"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {state.fieldErrors?.password && (
                  <p className="form-error">{state.fieldErrors.password[0]}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <a href="#" className="text-amber-600 font-medium hover:text-amber-700">Forgot password?</a>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn-primary w-full justify-center py-2.5 text-base"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign in <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>

              <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
                <p className="text-xs text-amber-700 font-medium">Demo credentials pre-filled above</p>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-amber-600 font-semibold hover:text-amber-700">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
