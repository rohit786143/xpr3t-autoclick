"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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

function getIstDateKey(dateInput: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateInput));
}

function getIstYearMonth(): { year: number; month: number } {
  const parts = getIstDateKey(new Date()).split("-");
  return { year: Number(parts[0]), month: Number(parts[1]) - 1 };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  // Calendar State (IST)
  const initialYM = useMemo(() => getIstYearMonth(), []);
  const [calYear, setCalYear] = useState(initialYM.year);
  const [calMonth, setCalMonth] = useState(initialYM.month);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getIstDateKey(new Date()));

  const logsByDate = useMemo(() => {
    const map: Record<string, RunLog[]> = {};
    if (!user?.logs) return map;
    for (const log of user.logs) {
      const key = getIstDateKey(log.executedAt);
      if (!map[key]) map[key] = [];
      map[key].push(log);
    }
    return map;
  }, [user?.logs]);

  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateKey: string | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(calMonth + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      cells.push({ day: d, dateKey: `${calYear}-${mm}-${dd}` });
    }
    return cells;
  }, [calYear, calMonth]);

  const goPrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/account");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setIsGhost(!!data.isGhost);
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
      {/* Ghost Mode Banner */}
      {isGhost && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-center gap-3">
          <span>
            You are viewing <strong>{user?.email}</strong> as Admin (Ghost Mode)
          </span>
          <button
            onClick={handleRevertGhost}
            className="px-3 py-1 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition text-xs"
          >
            Exit Ghost Mode &amp; Return to Admin Panel
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[#0b1120] rounded-xl border border-slate-800">
              <Image
                src="/xpr3t-logo.png"
                alt="XPR3T"
                width={130}
                height={38}
                priority
                className="h-7 w-auto object-contain"
              />
            </div>
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

          <form onSubmit={handleLinkAccount} autoComplete="off" className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                XPR3T Login ID (Username)
              </label>
              <input
                type="text"
                autoComplete="off"
                required
                value={xpr3tUsername}
                onChange={(e) => setXpr3tUsername(e.target.value)}
                placeholder="e.g. XP71457513"
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-black placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                XPR3T Login Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={xpr3tPassword}
                onChange={(e) => setXpr3tPassword(e.target.value)}
                placeholder={isConfigured ? "Enter new password to update" : "Enter XPR3T password"}
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-black placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
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

        {/* Daily Click Detail Calendar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Daily Click Detail Calendar</h3>
              <p className="text-xs text-slate-500">
                Click any date to see whether the bot clicked Start Engine or the exact reason it failed.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
                  Clicked / Active
                </span>
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block"></span>
                  Failed / Not Clicked
                </span>
              </div>
              <button
                onClick={fetchUserData}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Month Calendar Grid */}
            <div className="lg:col-span-7 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  &larr; Prev
                </button>
                <h4 className="text-sm font-bold text-slate-900">
                  {MONTH_NAMES[calMonth]} {calYear}
                </h4>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Next &rarr;
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
                {WEEK_DAYS.map((wd) => (
                  <div key={wd} className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-1">
                    {wd}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell, idx) => {
                  if (!cell.day || !cell.dateKey) {
                    return <div key={`empty-${idx}`} className="h-12 sm:h-14" />;
                  }
                  const dayLogs = logsByDate[cell.dateKey] || [];
                  const hasSuccess = dayLogs.some((l) => l.status === "success");
                  const hasFailed = !hasSuccess && dayLogs.some((l) => l.status === "failed");
                  const isSelected = selectedDateKey === cell.dateKey;

                  let cellClasses =
                    "bg-white border-slate-200 text-slate-700 hover:border-slate-400";
                  if (hasSuccess) {
                    cellClasses =
                      "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600";
                  } else if (hasFailed) {
                    cellClasses =
                      "bg-red-500 border-red-600 text-white hover:bg-red-600";
                  }

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(cell.dateKey!)}
                      className={`h-12 sm:h-14 rounded-xl border font-semibold text-xs sm:text-sm flex flex-col items-center justify-center transition relative ${cellClasses} ${
                        isSelected ? "ring-2 ring-offset-2 ring-blue-600" : ""
                      }`}
                    >
                      <span>{cell.day}</span>
                      {dayLogs.length > 0 && (
                        <span className="text-[9px] font-medium opacity-90">
                          {hasSuccess ? "Clicked" : "Failed"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected Date Detail & Reason */}
            <div className="lg:col-span-5 border border-slate-200 rounded-2xl p-5 bg-white flex flex-col">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Selected Date Details (IST)
                </span>
                <h4 className="text-base font-bold text-slate-900 mt-0.5">
                  {new Date(`${selectedDateKey}T00:00:00+05:30`).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h4>
              </div>

              {(() => {
                const selectedLogs = logsByDate[selectedDateKey] || [];
                if (selectedLogs.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8 text-slate-400">
                      <p className="text-sm font-medium text-slate-500">No activity on this date</p>
                      <p className="text-xs mt-1">
                        No automated 12:00 AM IST run or manual test was recorded on this day.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3 overflow-y-auto max-h-80 pr-1">
                    {selectedLogs.map((log) => {
                      const isOk = log.status === "success";
                      return (
                        <div
                          key={log.id}
                          className={`p-3.5 rounded-xl border ${
                            isOk
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-red-50 border-red-200 text-red-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                                isOk
                                  ? "bg-emerald-200 text-emerald-900"
                                  : "bg-red-200 text-red-900"
                              }`}
                            >
                              {isOk ? "Start Engine Clicked / Active" : "Not Clicked (Failed)"}
                            </span>
                            <span className="text-[11px] font-mono opacity-80">
                              {new Date(log.executedAt).toLocaleTimeString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-medium leading-relaxed">
                            {isOk ? log.message : `Reason: ${log.message}`}
                          </p>
                          {log.durationMs && (
                            <p className="text-[11px] opacity-70 mt-1 font-mono">
                              Duration: {log.durationMs}ms
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

