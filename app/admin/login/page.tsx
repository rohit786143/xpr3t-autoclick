"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  KeyRound,
  Zap,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("AdminPassword123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error while connecting to server.");
      setLoading(false);
    }
  }

  function fillDemoAdmin() {
    setUsername("admin");
    setPassword("AdminPassword123!");
    setError("");
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800">
      <div className="w-full max-w-md">
        {/* Brand Header with XPR3T Official Logo */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative w-48 h-16 mb-2 flex items-center justify-center p-2 rounded-2xl bg-slate-900 shadow-md">
            <Image
              src="/xpr3t-logo.png"
              alt="XPR3T Official Logo"
              width={180}
              height={50}
              priority
              className="object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 shadow-sm mt-2">
            <Zap className="h-3.5 w-3.5 text-blue-600" />
            Arbitrage Engine 24h Auto-Click Control
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            Admin Portal Login
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage agent accounts &amp; daily 12:00 AM IST click automation
          </p>
        </div>

        {/* Clean Modern White Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-7 sm:p-8 shadow-xl shadow-slate-200/60">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Admin Username
              </label>
              <div className="relative">
                <User className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Admin Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-blue-600/25 transition mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-blue-600" />
              Default credentials ready
            </span>
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-4"
            >
              Reset Default
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          XPR3T Arbitrage Engine Automation • 24h Background Runner
        </p>
      </div>
    </div>
  );
}
