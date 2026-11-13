"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Play,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  RefreshCw,
  ExternalLink,
  Loader2,
  Power,
  History,
  X,
  AlertTriangle,
  Zap,
  LogIn,
} from "lucide-react";

interface RunLog {
  id: string;
  status: string;
  message: string;
  durationMs: number | null;
  executedAt: string;
}

interface BotUser {
  id: string;
  email: string;
  role: string;
  xpr3tUsername: string | null;
  targetWebsiteUrl: string;
  buttonSelector: string;
  status: "active" | "inactive";
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  createdAt: string;
  logs?: RunLog[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<BotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningIds, setRunningIds] = useState<Record<string, boolean>>({});
  const [ghostingId, setGhostingId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Master Admin Unlimited Add XPR3T Account state
  const [newXpr3tId, setNewXpr3tId] = useState("");
  const [newXpr3tPass, setNewXpr3tPass] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);

  // History modal
  const [historyUser, setHistoryUser] = useState<BotUser | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 15000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleGhostLogin = async (targetUserId: string, targetEmail: string) => {
    setGhostingId(targetUserId);
    setBanner(null);
    try {
      const res = await fetch("/api/admin/ghost-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ghost login failed.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Ghost login error.",
      });
      setGhostingId(null);
    }
  };

  const handleTriggerUser = async (id: string, label: string) => {
    setRunningIds((prev) => ({ ...prev, [id]: true }));
    setBanner(null);
    try {
      const res = await fetch(`/api/users/${id}/trigger`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");

      if (data.result?.success) {
        setBanner({
          type: "success",
          text: `[${label}] ${data.result.message}`,
        });
      } else {
        setBanner({
          type: "error",
          text: `[${label}] ${data.result?.message || data.error}`,
        });
      }
      await fetchUsers();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: `[${label}] ${err instanceof Error ? err.message : "Run failed"}`,
      });
    } finally {
      setRunningIds((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    setBanner(null);
    try {
      const res = await fetch("/api/worker/run-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run all users");

      const successes = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
      const total = data.results?.length || 0;
      setBanner({
        type: "success",
        text: `Batch completed: ${successes}/${total} accounts triggered successfully.`,
      });
      await fetchUsers();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to trigger all accounts.",
      });
    } finally {
      setRunningAll(false);
    }
  };

  const handleAddUnlimitedAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setAddingAccount(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xpr3tUsername: newXpr3tId,
          xpr3tPassword: newXpr3tPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add account.");
      }
      setBanner({
        type: "success",
        text: `XPR3T Account "${newXpr3tId}" added! Ready for 12:00 AM IST cycle.`,
      });
      setNewXpr3tId("");
      setNewXpr3tPass("");
      await fetchUsers();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to add account.",
      });
    } finally {
      setAddingAccount(false);
    }
  };

  const handleDeleteUser = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to delete user "${label}"?`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      setBanner({
        type: "success",
        text: `User "${label}" removed.`,
      });
      await fetchUsers();
    } catch (err: unknown) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Error deleting user.",
      });
    }
  };

  const totalUsers = users.length;
  const activeBots = users.filter((u) => u.status === "active" && u.xpr3tUsername).length;
  const successfulChecks = users.filter((u) => u.lastRunStatus === "success").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-[#0b1120] rounded-xl border border-slate-800">
              <Image
                src="/xpr3t-logo.png"
                alt="XPR3T"
                width={140}
                height={40}
                priority
                className="h-7 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 tracking-tight">
                Admin Master Control
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                12:00 AM IST Routine Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://xpr3t.com/Sign-in.html"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open XPR3T Portal
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-red-50 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Banner Alerts */}
        {banner && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border shadow-sm ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-red-50 border-red-200 text-red-900"
            }`}
          >
            {banner.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm font-medium">{banner.text}</div>
            <button
              onClick={() => setBanner(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Registered Users
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">{totalUsers}</span>
              <span className="text-xs text-slate-500">Self-registered via portal</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Linked Active Bot IDs
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-600">{activeBots}</span>
              <span className="text-xs text-slate-500">Runs at midnight IST</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Successful Checks
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-blue-600">{successfulChecks}</span>
              <span className="text-xs text-slate-500">Arbitrage engine active</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Batch Execution
            </span>
            <button
              onClick={handleRunAll}
              disabled={runningAll || activeBots === 0}
              className="mt-2 w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {runningAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running All...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Test All Active IDs Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Master Admin: Unlimited XPR3T Account Adder */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                + Add XPR3T Account (Master Admin Unlimited)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Only Master Admin (rohitsagarksg@gmail.com) can add unlimited XPR3T accounts here. Regular users are limited to 1 account each.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddUnlimitedAccount} autoComplete="off" className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                XPR3T Login ID (Username)
              </label>
              <input
                type="text"
                autoComplete="off"
                required
                value={newXpr3tId}
                onChange={(e) => setNewXpr3tId(e.target.value)}
                placeholder="e.g. XP71457513"
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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
                value={newXpr3tPass}
                onChange={(e) => setNewXpr3tPass(e.target.value)}
                placeholder="Enter XPR3T password"
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={addingAccount}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {addingAccount ? "Adding..." : "+ Add Account"}
              </button>
            </div>
          </form>
        </div>

        {/* Registered Users Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Registered Users & Linked Bot Accounts ({users.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Users register themselves, connect their XPR3T ID, and can be inspected via Ghost Login.
              </p>
            </div>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-6">User Email</th>
                  <th className="py-3 px-6">Linked XPR3T ID</th>
                  <th className="py-3 px-6">Routine Status</th>
                  <th className="py-3 px-6">Daily Run & Click Detail</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {loading ? "Loading users..." : "No users registered yet."}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isRunning = runningIds[user.id];
                    const isGhosting = ghostingId === user.id;
                    const label = user.xpr3tUsername || user.email;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition">
                        {/* User Email */}
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-900 text-sm">
                            {user.email}
                          </div>
                          <div className="text-xs text-slate-400">
                            Registered: {new Date(user.createdAt).toLocaleDateString("en-IN")}
                            {user.role === "admin" && (
                              <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold text-[10px]">
                                ADMIN
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Linked XPR3T ID */}
                        <td className="py-4 px-6">
                          {user.xpr3tUsername ? (
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                              {user.xpr3tUsername}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Not linked yet
                            </span>
                          )}
                        </td>

                        {/* Routine Status */}
                        <td className="py-4 px-6">
                          {user.xpr3tUsername ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active (12 AM IST)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              Awaiting XPR3T Setup
                            </span>
                          )}
                        </td>

                        {/* Daily Run & Click Detail */}
                        <td className="py-4 px-6 max-w-md">
                          {user.lastRunStatus === "running" ? (
                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Running automated check...
                            </div>
                          ) : user.lastRunStatus === "success" ? (
                            <div>
                              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {user.lastRunMessage?.includes("View Trade")
                                  ? "Engine already active (View Trade)"
                                  : "Start Engine Triggered"}
                              </div>
                              {user.lastRunAt && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {new Date(user.lastRunAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                                </div>
                              )}
                            </div>
                          ) : user.lastRunStatus === "failed" ? (
                            <div>
                              <div className="flex items-center gap-1 text-xs font-semibold text-red-600">
                                <XCircle className="w-3.5 h-3.5" />
                                {user.lastRunMessage?.startsWith("Wrong username or password")
                                  ? "Wrong username or password"
                                  : "Check Failed"}
                              </div>
                              <div className="text-[11px] text-red-500 line-clamp-1 mt-0.5 font-mono">
                                {user.lastRunMessage}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Ready for next 12:00 AM IST cycle
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Ghost Login Button */}
                            <button
                              onClick={() => handleGhostLogin(user.id, user.email)}
                              disabled={isGhosting}
                              title="Ghost Login into this user's dashboard"
                              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition disabled:opacity-50"
                            >
                              {isGhosting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <LogIn className="w-3.5 h-3.5" />
                              )}
                              <span>Ghost Login</span>
                            </button>

                            {/* Test Click */}
                            {user.xpr3tUsername && (
                              <button
                                onClick={() => handleTriggerUser(user.id, label)}
                                disabled={isRunning}
                                title="Run instant test check"
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition disabled:opacity-50"
                              >
                                {isRunning ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Zap className="w-3.5 h-3.5" />
                                )}
                                <span>Test Click</span>
                              </button>
                            )}

                            {/* History */}
                            <button
                              onClick={() => {
                                setHistoryUser(user);
                                setShowHistoryModal(true);
                              }}
                              title="View Click History"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                            >
                              <History className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            {user.role !== "admin" && (
                              <button
                                onClick={() => handleDeleteUser(user.id, user.email)}
                                title="Delete user"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* History Modal */}
      {showHistoryModal && historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Execution History: {historyUser.email}
                </h3>
                {historyUser.xpr3tUsername && (
                  <p className="text-xs text-slate-500 font-mono">
                    Linked ID: {historyUser.xpr3tUsername}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp (IST)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Outcome Message</th>
                    <th className="py-2.5 px-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {historyUser.logs && historyUser.logs.length > 0 ? (
                    historyUser.logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                          {new Date(log.executedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === "success"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-800">
                          {log.message}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {log.durationMs ? `${log.durationMs}ms` : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 font-sans">
                        No history records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
