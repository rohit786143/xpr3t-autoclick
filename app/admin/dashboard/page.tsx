"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Plus,
  Play,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  RefreshCw,
  Globe,
  User as UserIcon,
  Shield,
  ExternalLink,
  Loader2,
  Power,
  History,
  X,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Zap,
} from "lucide-react";

const DEFAULT_XPR3T_URL = "https://xpr3t.com/Sign-in.html";

interface RunLog {
  id: string;
  status: string;
  message: string;
  durationMs: number | null;
  executedAt: string;
}

interface BotUser {
  id: string;
  username: string;
  targetWebsiteUrl: string;
  buttonSelector: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
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
  const [runningAll, setRunningAll] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Quick Add User form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<BotUser | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [savingEdit, setSavingEdit] = useState(false);

  // Logs drawer state
  const [expandedLogUserId, setExpandedLogUserId] = useState<string | null>(
    null
  );

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/");
        router.refresh();
        return;
      }
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleQuickAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) return;

    setAddingUser(true);
    setBanner(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          targetWebsiteUrl: DEFAULT_XPR3T_URL,
          buttonSelector: "#btnArbitrageStart",
          usernameSelector: "#inputEmail",
          passwordSelector: "#inputPassword",
          submitSelector: "#submit-login",
          status: "active",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "error",
          text: data.error || "Failed to add user.",
        });
        setAddingUser(false);
        return;
      }

      setNewUsername("");
      setNewPassword("");
      setBanner({
        type: "success",
        text: `User "${data.user.username}" added! Ready for daily 12:00 AM IST Arbitrage auto-click.`,
      });
      await fetchUsers();
    } catch {
      setBanner({
        type: "error",
        text: "Network error while adding user.",
      });
    } finally {
      setAddingUser(false);
    }
  }

  function openEditModal(user: BotUser) {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditPassword("");
    setEditStatus(user.status);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setBanner(null);

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editUsername.trim(),
          password: editPassword || undefined,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setBanner({
          type: "error",
          text: data.error || "Failed to update user.",
        });
        setSavingEdit(false);
        return;
      }

      setEditingUser(null);
      setBanner({
        type: "success",
        text: `Updated credentials for "${data.user.username}".`,
      });
      await fetchUsers();
    } catch {
      setBanner({
        type: "error",
        text: "Network error while updating user.",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleStatus(user: BotUser) {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  }

  async function handleDeleteUser(user: BotUser) {
    if (
      !window.confirm(
        `Delete user "${user.username}" and remove their persistent session?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBanner({
          type: "success",
          text: `Deleted user "${user.username}".`,
        });
        await fetchUsers();
      }
    } catch {
      setBanner({
        type: "error",
        text: "Failed to delete user.",
      });
    }
  }

  async function handleTriggerUser(user: BotUser) {
    setRunningIds((prev) => ({ ...prev, [user.id]: true }));
    setBanner(null);

    try {
      const res = await fetch(`/api/users/${user.id}/trigger`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok && data.result) {
        setBanner({
          type: data.result.success ? "success" : "error",
          text: `[${user.username}] ${data.result.message}`,
        });
      } else {
        setBanner({
          type: "error",
          text: data.error || `Bot run failed for ${user.username}.`,
        });
      }
      await fetchUsers();
    } catch {
      setBanner({
        type: "error",
        text: `Network error triggering bot for ${user.username}.`,
      });
    } finally {
      setRunningIds((prev) => ({ ...prev, [user.id]: false }));
    }
  }

  async function handleRunAllActive() {
    setRunningAll(true);
    setBanner(null);

    try {
      const res = await fetch("/api/worker/run-all", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.results) {
        const succeeded = data.results.filter(
          (r: { success: boolean }) => r.success
        ).length;
        setBanner({
          type: succeeded === data.results.length ? "success" : "error",
          text: `Batch completed: ${succeeded}/${data.results.length} active account(s) processed.`,
        });
      } else {
        setBanner({
          type: "error",
          text: data.error || "Batch execution failed.",
        });
      }
      await fetchUsers();
    } catch {
      setBanner({
        type: "error",
        text: "Network error during batch run.",
      });
    } finally {
      setRunningAll(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const activeCount = users.filter((u) => u.status === "active").length;
  const successCount = users.filter(
    (u) => u.lastRunStatus === "success"
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                XPR3T Arbitrage Engine Auto-Clicker
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  12:00 AM IST Routine
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Daily Automatic &quot;Start Engine&quot; Clicker for all agent IDs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={DEFAULT_XPR3T_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition"
            >
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
              Open XPR3T Portal
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-xs font-medium text-slate-300 hover:text-rose-200 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Add User Card */}
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-400" />
                Add XPR3T User Account
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Admin can add multiple user IDs. The bot will automatically log in and click &quot;Start Engine&quot; every night at 12:00 AM IST.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <Globe className="h-3.5 w-3.5 text-indigo-400" />
              Target: Arbitrage Engine (Top Right)
            </span>
          </div>

          <form
            onSubmit={handleQuickAddUser}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Agent Login-ID (Username)
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. XP71457513"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Login Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={addingUser}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition"
              >
                {addingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
              <span>Total Accounts</span>
              <UserIcon className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-3xl font-bold text-white mt-2">{users.length}</p>
            <p className="text-xs text-slate-500 mt-1">
              Automated per-account sessions
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
              <span>Active 12:00 AM Bot IDs</span>
              <Power className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold text-emerald-400 mt-2">
              {activeCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Triggers automatically at midnight IST
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
              <span>Successful Checks</span>
              <CheckCircle2 className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-3xl font-bold text-sky-400 mt-2">
              {successCount}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Arbitrage Engine active / clicked
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
              <span>Run All Now</span>
              <Shield className="h-4 w-4 text-indigo-400" />
            </div>
            <button
              onClick={handleRunAllActive}
              disabled={runningAll || activeCount === 0}
              className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 transition"
            >
              {runningAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Bot For All...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Test All Active IDs Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
        {banner && (
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
              banner.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : "bg-rose-500/10 border-rose-500/30 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {banner.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Accounts Table */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Configured Accounts ({users.length})
              </h2>
              <p className="text-xs text-slate-400">
                Shows daily login status, Arbitrage Engine state, and click history.
              </p>
            </div>
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <span className="text-sm">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Bot className="h-10 w-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">
                No Accounts Added Yet
              </h3>
              <p className="text-xs text-slate-500">
                Enter an Agent Login-ID and Password above to start automated runs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
                    <th className="py-3.5 px-6">Agent Login-ID</th>
                    <th className="py-3.5 px-4">Routine Status</th>
                    <th className="py-3.5 px-4">Daily Run &amp; Click Detail</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {users.map((user) => {
                    const isRunning =
                      runningIds[user.id] || user.lastRunStatus === "running";
                    const isLogOpen = expandedLogUserId === user.id;
                    const isWrongCredentials =
                      user.lastRunMessage?.toLowerCase().includes("wrong username") ||
                      user.lastRunMessage?.toLowerCase().includes("password");

                    return (
                      <React.Fragment key={user.id}>
                        <tr className="hover:bg-slate-800/30 transition">
                          <td className="py-4 px-6">
                            <div className="font-bold text-white font-mono text-base">
                              {user.username}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Added: {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(user)}
                              title="Click to toggle Active / Inactive"
                              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                                user.status === "active"
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                              }`}
                            >
                              {user.status === "active"
                                ? "● Active (12 AM IST)"
                                : "○ Inactive"}
                            </button>
                          </td>

                          <td className="py-4 px-4">
                            {user.lastRunAt ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {user.lastRunStatus === "success" ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Success
                                    </span>
                                  ) : user.lastRunStatus === "running" ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Running...
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      {isWrongCredentials
                                        ? "Wrong username or password"
                                        : "Failed"}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(user.lastRunAt).toLocaleString()}
                                  </span>
                                </div>
                                {user.lastRunMessage && (
                                  <p
                                    className={`text-xs max-w-md truncate ${
                                      isWrongCredentials
                                        ? "text-rose-400 font-semibold"
                                        : "text-slate-300"
                                    }`}
                                    title={user.lastRunMessage}
                                  >
                                    {user.lastRunMessage}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500 italic">
                                Ready for next 12:00 AM IST cycle
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleTriggerUser(user)}
                                disabled={isRunning}
                                title="Run bot test now"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 disabled:opacity-50 text-xs font-semibold text-amber-300 transition"
                              >
                                {isRunning ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Checking...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3.5 w-3.5" />
                                    Test Click
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() =>
                                  setExpandedLogUserId(
                                    isLogOpen ? null : user.id
                                  )
                                }
                                title="View daily history logs"
                                className={`p-2 rounded-xl border text-xs transition ${
                                  isLogOpen
                                    ? "bg-slate-800 border-slate-700 text-white"
                                    : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white"
                                }`}
                              >
                                <History className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => openEditModal(user)}
                                title="Edit password or status"
                                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteUser(user)}
                                title="Delete account"
                                className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Daily Run & Click History Accordion */}
                        {isLogOpen && (
                          <tr className="bg-slate-950/70">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5 text-indigo-400" />
                                Daily Login &amp; Click History for {user.username}
                              </div>
                              {!user.logs || user.logs.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">
                                  No previous run history yet.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {user.logs.map((log) => (
                                    <div
                                      key={log.id}
                                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`px-2 py-0.5 rounded font-semibold ${
                                            log.status === "success"
                                              ? "bg-emerald-500/15 text-emerald-300"
                                              : "bg-rose-500/15 text-rose-300"
                                          }`}
                                        >
                                          {log.status.toUpperCase()}
                                        </span>
                                        <span className="text-slate-200">
                                          {log.message}
                                        </span>
                                      </div>
                                      <span className="text-slate-500 shrink-0">
                                        {new Date(
                                          log.executedAt
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Edit Credentials: {editingUser.username}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Agent Login-ID
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Daily Automation Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as "active" | "inactive")
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                >
                  <option value="active">Active (Daily 12:00 AM IST)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                >
                  {savingEdit && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
