"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail, Lock, User, Building2, Zap, ArrowRight } from "lucide-react";
import { registerAction } from "../actions";
import type { ActionResult } from "../actions";

const initialState: ActionResult = { success: false };

export default function RegisterPage() {
  const [state, action, isPending] = useActionState(registerAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f8f9fb]">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 bg-amber-500 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">LeadFlow Pro</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h2>
            <p className="text-gray-500">Start generating leads in minutes</p>
          </div>

          {state.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-4">
            <div>
              <label className="form-label" htmlFor="name">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="name" name="name" type="text" placeholder="Alex Johnson" className="form-input pl-10" required />
              </div>
              {state.fieldErrors?.name && <p className="form-error">{state.fieldErrors.name[0]}</p>}
            </div>

            <div>
              <label className="form-label" htmlFor="organizationName">Organization name</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="organizationName" name="organizationName" type="text" placeholder="Acme Agency" className="form-input pl-10" required />
              </div>
              {state.fieldErrors?.organizationName && <p className="form-error">{state.fieldErrors.organizationName[0]}</p>}
            </div>

            <div>
              <label className="form-label" htmlFor="email">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="email" name="email" type="email" placeholder="you@company.com" className="form-input pl-10" required />
              </div>
              {state.fieldErrors?.email && <p className="form-error">{state.fieldErrors.email[0]}</p>}
            </div>

            <div>
              <label className="form-label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="password" name="password" type="password" placeholder="Min 8 characters" className="form-input pl-10" required />
              </div>
              {state.fieldErrors?.password && <p className="form-error">{state.fieldErrors.password[0]}</p>}
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full justify-center py-2.5 text-base mt-2"
            >
              {isPending ? "Creating account..." : <><span>Create account</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-600 font-semibold hover:text-amber-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
