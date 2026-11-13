"use client";

import React, { useEffect, useState } from "react";
import { Gift, CheckCircle2, Lock, LogOut, MousePointerClick } from "lucide-react";

const SESSION_KEY = "demo_target_portal_session";
const CLICKS_KEY = "demo_target_portal_clicks";

export default function DemoTargetPage() {
  const [hydrated, setHydrated] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [claimedCount, setClaimedCount] = useState(0);
  const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem(SESSION_KEY);
    const savedClicks = Number(localStorage.getItem(CLICKS_KEY) || "0");
    if (savedUser) {
      setLoggedInUser(savedUser);
    }
    setClaimedCount(savedClicks);
    setHydrated(true);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    localStorage.setItem(SESSION_KEY, username);
    setLoggedInUser(username);
  }

  function handleClaimClick() {
    const next = claimedCount + 1;
    const nowIso = new Date().toLocaleTimeString();
    setClaimedCount(next);
    setLastClaimedAt(nowIso);
    setJustClaimed(true);
    localStorage.setItem(CLICKS_KEY, String(next));
  }

  function handleExpireSession() {
    localStorage.removeItem(SESSION_KEY);
    setLoggedInUser(null);
    setJustClaimed(false);
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Loading Demo Target Portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Gift className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">
                Demo Target Website
              </h1>
              <p className="text-xs text-slate-400">
                Simulated portal for testing Playwright 24h bot
              </p>
            </div>
          </div>
          {loggedInUser && (
            <button
              onClick={handleExpireSession}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Expire Session
            </button>
          )}
        </div>

        {!loggedInUser ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                Session is currently unauthenticated. Playwright will fill this
                login form automatically.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition"
            >
              Sign In to Target Portal
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center justify-between">
              <span>
                Logged in as:{" "}
                <strong className="text-white">{loggedInUser}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                Session Active
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                24-Hour Check-In Action
              </div>

              <button
                id="claim-daily-reward-btn"
                type="button"
                onClick={handleClaimClick}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition"
              >
                <MousePointerClick className="h-5 w-5" />
                Claim 24h Automated Click (#claim-daily-reward-btn)
              </button>

              <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-1">
                <span>
                  Total Clicks in Session:{" "}
                  <strong className="text-white">{claimedCount}</strong>
                </span>
                {lastClaimedAt && (
                  <span>
                    Last Click:{" "}
                    <strong className="text-emerald-400">{lastClaimedAt}</strong>
                  </span>
                )}
              </div>

              {justClaimed && (
                <div
                  id="claim-success-banner"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-medium"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Button clicked! Reward claimed successfully.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

