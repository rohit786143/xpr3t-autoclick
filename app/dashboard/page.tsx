"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface RunLog {
  id: string;
  status: string;
  message: string;
  durationMs: number | null;
  executedAt: string;
}

interface UserData {
  id: string;
  email: string;
  role: string;
  xpr3tUsername: string | null;
  status: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  createdAt: string;
  logs: RunLog[];
}

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningTest, setRunningTest] = useState(false);
  const [isGhost, setIsGhost] = useState(false);

  // Link XPR3T Form
  const [xpr3tUsername, setXpr3tUsername] = useState("");
  const [xpr3tPassword, setXpr3tPassword] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/account");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        if (data.user.xpr3tUsername) {
          setXpr3tUsername(data.user.xpr3tUsername);
        }
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
    // Check if session has ghost flag in cookie/storage or URL
    if (document.cookie.includes("autoclick_session")) {
      // Just check if reverting is possible via API
    }
  }, [fetchUserData]);

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSavingAccount(true);

    try {
      const res = await fetch("/api/user/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xpr3tUsername,
          xpr3tPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to link account.");
      }

      setFormSuccess(data.message || "Account linked successfully!");
      setXpr3tPassword("");
      await fetchUserData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error saving account.");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleTestClick = async () => {
    setRunningTest(true);
    try {
      const res = await fetch("/api/user/account", { method: "PUT" });
      const data = await res.json();
      if (data.result) {
        await fetchUserData();
      }
    } catch (err) {
      console.error("Test click failed:", err);
    } finally {
      setRunningTest(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleRevertGhost = async () => {
    try {
      const res = await fetch("/api/admin/ghost-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert" }),
      });
      const data = await res.json();
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to exit ghost mode:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <svg className="animate-spin h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading your dashboard...
        </div>
      </div>
    );
  }

  const isConfigured = !!user?.xpr3tUsername;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/xpr3t-logo.png"
              alt="XPR3T"
              width={130}
              height={38}
              priority
              className="h-8 w-auto object-contain"
            />
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              User Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-slate-600">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Banner if Account is linked */}
        {isConfigured ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Linked XPR3T Account: <span className="font-mono text-blue-600">{user?.xpr3tUsername}</span>
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Bot Active (12:00 AM IST)
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Automatic daily routine targets Arbitrage Engine (#btnArbitrageStart) at midnight IST.
                </p>
                {user?.lastRunMessage && (
                  <p className="text-xs font-medium mt-2 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg inline-block border border-slate-200">
                    Last Status: {user.lastRunMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleTestClick}
                disabled={runningTest}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition disabled:opacity-60 flex items-center gap-2"
              >
                {runningTest ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Running Test...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Test Run Now
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Notice for user without linked account */
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-6 flex items-start gap-4">
            <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold text-amber-900">No XPR3T Account Linked Yet</h3>
              <p className="text-sm mt-1 text-amber-700">
                Please connect your XPR3T Login ID & Password below. Once linked, the bot will automatically run every night at 12:00 AM IST. (Note: Only 1 XPR3T account per registered user).
              </p>
            </div>
          </div>
        )}

        {/* Link / Update XPR3T Account Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              {isConfigured ? "Update Linked XPR3T Credentials" : "Connect Your XPR3T Account"}
            </h3>
            <p className="text-sm text-slate-500">
              Enter the exact Agent ID and Password you use to log in to <a href="https://xpr3t.com/Sign-in.html" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">xpr3t.com</a>.
            </p>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
              {formSuccess}
            </div>
          )}

          <form onSubmit={handleLinkAccount} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                XPR3T Login ID (Username)
              </label>
              <input
                type="text"
                required
                value={xpr3tUsername}
                onChange={(e) => setXpr3tUsername(e.target.value)}
                placeholder="e.g. XP71457513"
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                XPR3T Login Password
              </label>
              <input
                type="password"
                required
                value={xpr3tPassword}
                onChange={(e) => setXpr3tPassword(e.target.value)}
                placeholder={isConfigured ? "Enter new password to update" : "Enter XPR3T password"}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={savingAccount}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {savingAccount ? "Saving..." : isConfigured ? "Update Credentials" : "Connect Account & Activate Bot"}
              </button>
            </div>
          </form>
        </div>

        {/* Recent Execution Logs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Daily Execution History</h3>
              <p className="text-xs text-slate-500">Recorded history of automated and manual runs for your account</p>
            </div>
            <button
              onClick={fetchUserData}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
            >
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Execution Message / Outcome</th>
                  <th className="py-3 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {user?.logs && user.logs.length > 0 ? (
                  user.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(log.executedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.status === "success"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-800">
                        {log.message}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {log.durationMs ? `${log.durationMs}ms` : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                      No click records yet. Test run or wait for tonight&apos;s 12:00 AM IST routine.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

