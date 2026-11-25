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
  totalDeposit: string | null;
  totalWithdraw: string | null;
  totalIncome: string | null;
  statsUpdatedAt: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
  logs: RunLog[];
}

interface ActivePaymentOrder {
  id: string;
  planDays: number;
  planLabel: string;
  baseAmount: number;
  expectedAmount: string;
  expiresAt: string;
  qrDataUrl: string;
}

const PLAN_OPTIONS = [
  { days: 30, usd: 1, label: "30 Days", tag: "Starter" },
  { days: 65, usd: 2, label: "65 Days", tag: "+5 Bonus Days" },
  { days: 100, usd: 3, label: "100 Days", tag: "+10 Bonus Days" },
  { days: 200, usd: 6, label: "200 Days", tag: "Popular" },
  { days: 365, usd: 10, label: "365 Days", tag: "Best Value" },
];

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
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [isGhost, setIsGhost] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Payment & Subscription Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<ActivePaymentOrder | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

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
      }
    } catch (err) {
      console.error("Failed to load user data:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleSelectPlan = useCallback(async (planDays: number) => {
    setCreatingOrder(true);
    setPaymentError(null);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate payment QR.");
      }
      setPaymentOrder(data.order);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : "Could not generate QR.");
    } finally {
      setCreatingOrder(false);
    }
  }, []);

  const checkPaymentStatus = useCallback(
    async (orderId: string, manual = false) => {
      if (manual) setCheckingPayment(true);
      try {
        const res = await fetch(`/api/payments/status?orderId=${encodeURIComponent(orderId)}`);
        const data = await res.json();
        if (data.status === "paid") {
          setShowPaymentModal(false);
          setPaymentOrder(null);
          setActionMessage({
            type: "success",
            text: "USDT (BEP20) payment verified via BscScan! Auto-Click is now active.",
          });
          await fetchUserData();
        } else if (data.status === "expired" && paymentOrder) {
          // Automatically rotate to a fresh unique amount & QR every 10 minutes
          await handleSelectPlan(paymentOrder.planDays);
        }
      } catch {
        // Ignore transient network poll error
      } finally {
        if (manual) setCheckingPayment(false);
      }
    },
    [fetchUserData, handleSelectPlan, paymentOrder]
  );

  // Live 10-minute countdown timer & 8-second blockchain auto-polling
  useEffect(() => {
    if (!showPaymentModal || !paymentOrder) return;

    const updateTimer = () => {
      const diffSec = Math.max(
        0,
        Math.floor((new Date(paymentOrder.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diffSec);
      if (diffSec === 0) {
        handleSelectPlan(paymentOrder.planDays);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
    const pollInterval = setInterval(() => {
      checkPaymentStatus(paymentOrder.id, false);
    }, 8000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(pollInterval);
    };
  }, [showPaymentModal, paymentOrder, handleSelectPlan, checkPaymentStatus]);

  const handleToggleAutoClick = async (nextStatus: "active" | "inactive") => {
    setTogglingStatus(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/user/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update Auto-Click status.");
      }
      if (data.requiresPayment) {
        setPaymentOrder(null);
        setPaymentError(null);
        setShowPaymentModal(true);
        return;
      }
      if (nextStatus === "active") {
        setActionMessage({
          type: "success",
          text: data.result?.message || "Auto-Click Started! Daily 12:00 AM IST routine is now active.",
        });
      } else {
        setActionMessage({
          type: "success",
          text: "Auto-Click Stopped. Bot will remain paused until you click Start Auto-Click again.",
        });
      }
      await fetchUserData();
    } catch (err: unknown) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update status.",
      });
    } finally {
      setTogglingStatus(false);
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

  const isAutoClickActive = user?.status === "active";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Ghost Mode Banner */}
      {isGhost && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-wrap items-center justify-center gap-3">
          <span>
            You are viewing <strong>{user?.xpr3tUsername || user?.email}</strong> as Admin (Ghost Mode)
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
              User Dashboard
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-mono font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
              {user?.xpr3tUsername || user?.email}
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
        {actionMessage && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium ${
              actionMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {actionMessage.text}
          </div>
        )}

        {/* Auto-Click Control Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-xl border flex-shrink-0 ${
                isAutoClickActive
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900">
                  XPR3T Account:{" "}
                  <span className="font-mono text-blue-600">{user?.xpr3tUsername || user?.email}</span>
                </h2>
                {isAutoClickActive ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Auto-Click Active (12:00 AM IST)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Auto-Click Stopped
                  </span>
                )}
                {user?.role === "admin" ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                    Lifetime Validity (Admin)
                  </span>
                ) : user?.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date() ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Valid till:{" "}
                    {new Date(user.subscriptionExpiresAt).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Plan Required
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {isAutoClickActive
                  ? "Bot will automatically click Start Engine every night at 12:00 AM IST until you click Stop Auto-Click."
                  : "Click Start Auto-Click to activate daily 12:00 AM IST automated clicking."}
              </p>
              {user?.lastRunMessage && (
                <p className="text-xs font-medium mt-2.5 text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg inline-block border border-slate-200">
                  Last Status: {user.lastRunMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAutoClickActive ? (
              <button
                onClick={() => handleToggleAutoClick("inactive")}
                disabled={togglingStatus}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20 transition disabled:opacity-60 flex items-center gap-2"
              >
                {togglingStatus ? "Stopping..." : "Stop Auto-Click"}
              </button>
            ) : (
              <button
                onClick={() => handleToggleAutoClick("active")}
                disabled={togglingStatus}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition disabled:opacity-60 flex items-center gap-2"
              >
                {togglingStatus ? "Starting..." : "Start Auto-Click"}
              </button>
            )}

            <button
              onClick={handleTestClick}
              disabled={runningTest}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition disabled:opacity-60 flex items-center gap-2"
            >
              {runningTest ? "Testing..." : "Test Run Now"}
            </button>

            {user?.role !== "admin" && (
              <button
                onClick={() => {
                  setPaymentOrder(null);
                  setPaymentError(null);
                  setShowPaymentModal(true);
                }}
                className="px-4 py-2.5 rounded-xl font-semibold text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
              >
                Extend Plan
              </button>
            )}
          </div>
        </div>

        {/* Account Financial Summary (Total Deposit, Total Withdraw, Total Income) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Deposit
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                XPR3T
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-indigo-600 font-mono">
              {user?.totalDeposit || "$0.00"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {user?.statsUpdatedAt
                ? `Synced: ${new Date(user.statsUpdatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
                : "Click Test Run Now to sync"}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Withdraw
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                XPR3T
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900 font-mono">
              {user?.totalWithdraw || "$0.00"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Confirmed &amp; processed withdrawals
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Income
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Earnings
              </span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-emerald-600 font-mono">
              {user?.totalIncome || "$0.00"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cumulative XPR3T account income
            </p>
          </div>
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

      {/* USDT (BEP20) Subscription & Auto-Verify QR Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {paymentOrder ? "Scan QR to Pay USDT (BEP20)" : "Choose Auto-Click Plan"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {paymentOrder
                    ? "Auto-verified via BscScan. Validity activates immediately after payment."
                    : "Select a validity plan to generate your unique BEP20 payment QR."}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2"
              >
                &times;
              </button>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {paymentError}
              </div>
            )}

            {!paymentOrder ? (
              <div className="space-y-2.5">
                {PLAN_OPTIONS.map((plan) => (
                  <button
                    key={plan.days}
                    type="button"
                    disabled={creatingOrder}
                    onClick={() => handleSelectPlan(plan.days)}
                    className="w-full p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition flex items-center justify-between text-left disabled:opacity-60"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm sm:text-base">
                          {plan.label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {plan.tag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Daily 12:00 AM IST automated Start Engine click
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-blue-600 font-mono">
                        {plan.usd} USDT
                      </span>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        BEP20 (BSC)
                      </div>
                    </div>
                  </button>
                ))}

                {creatingOrder && (
                  <p className="text-center text-xs font-medium text-blue-600 pt-2">
                    Generating unique payment QR code...
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 inline-block mx-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paymentOrder.qrDataUrl}
                    alt="USDT BEP20 Payment QR"
                    className="w-56 h-56 mx-auto rounded-xl bg-white p-2 border border-slate-200"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 block">
                    Exact Amount to Pay ({paymentOrder.planLabel})
                  </span>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-1">
                    {paymentOrder.expectedAmount} USDT
                  </div>
                  <p className="text-[11px] text-blue-700 mt-1">
                    Amount is auto-locked for your account. Do not edit the decimal amount while paying.
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2.5">
                  <span>QR &amp; Amount refreshes in:</span>
                  <span className="font-mono font-bold text-sm">
                    {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
                    {String(secondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => checkPaymentStatus(paymentOrder.id, true)}
                    disabled={checkingPayment}
                    className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-60"
                  >
                    {checkingPayment ? "Checking BscScan..." : "I Have Paid — Verify Now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentOrder(null)}
                    className="py-2.5 px-4 rounded-xl font-semibold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    Change Plan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

