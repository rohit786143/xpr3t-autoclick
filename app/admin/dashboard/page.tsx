"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation - Bright White Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-36 h-10 flex items-center justify-center p-1.5 rounded-xl bg-slate-900 shadow-sm">
              <Image
                src="/xpr3t-logo.png"
                alt="XPR3T Logo"
                width={140}
                height={35}
                priority
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Arbitrage Engine Auto-Clicker
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  12:00 AM IST
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Automatic daily &quot;Start Engine&quot; click scheduler
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={DEFAULT_XPR3T_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
              Open XPR3T Portal
            </a>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Add User Card - Clean Bright White */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-200/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Add XPR3T User Account
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Admin can add multiple agent IDs. The bot will automatically log in and click &quot;Start Engine&quot; every night at 12:00 AM IST.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
              <Globe className="h-3.5 w-3.5 text-blue-600" />
              Target: Top Right Arbitrage Engine
            </span>
          </div>

          <form
            onSubmit={handleQuickAddUser}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Agent Login-ID (Username)
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. XP71457513"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
              </div>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Login Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold text-white shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition"
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

        {/* Metrics Grid - Bright Theme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Total Accounts</span>
              <UserIcon className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">{users.length}</p>
            <p className="text-xs text-slate-400 mt-1">
              Automated per-account sessions
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Active 12:00 AM Bot IDs</span>
              <Power className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-extrabold text-emerald-600 mt-2">
              {activeCount}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Runs automatically every midnight IST
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Successful Checks</span>
              <CheckCircle2 className="h-4 w-4 text-sky-600" />
            </div>
            <p className="text-3xl font-extrabold text-sky-600 mt-2">
              {successCount}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Arbitrage Engine active / clicked
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Run All Now</span>
              <Shield className="h-4 w-4 text-blue-600" />
            </div>
            <button
              onClick={handleRunAllActive}
              disabled={runningAll || activeCount === 0}
              className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition"
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
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              banner.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {banner.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Accounts Table - Clean White */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md shadow-slate-200/50">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Configured Accounts ({users.length})
              </h2>
              <p className="text-xs text-slate-500">
                Shows daily login status, Arbitrage Engine state, and click history.
              </p>
            </div>
            <button
              onClick={fetchUsers}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-sm">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">No Accounts Added Yet</p>
              <p className="text-xs text-slate-500">
                Enter an Agent Login-ID and Password above to start automated runs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                    <th className="py-3.5 px-6">Agent Login-ID</th>
                    <th className="py-3.5 px-4">Routine Status</th>
                    <th className="py-3.5 px-4">Daily Run &amp; Click Detail</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {users.map((user) => {
                    const isRunning =
                      runningIds[user.id] || user.lastRunStatus === "running";
                    const isLogOpen = expandedLogUserId === user.id;
                    const isWrongCredentials =
                      user.lastRunMessage?.toLowerCase().includes("wrong username") ||
                      user.lastRunMessage?.toLowerCase().includes("invalid credentials");

                    return (
                      <React.Fragment key={user.id}>
                        <tr className="hover:bg-slate-50 transition">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-900 font-mono text-base">
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
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
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
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Success
                                    </span>
                                  ) : user.lastRunStatus === "running" ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Checking...
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      {isWrongCredentials
                                        ? "Wrong username or password"
                                        : "Login Failed"}
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
                                        ? "text-rose-600 font-semibold"
                                        : "text-slate-600"
                                    }`}
                                    title={user.lastRunMessage}
                                  >
                                    {user.lastRunMessage}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
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
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-amber-800 transition"
                              >
                                {isRunning ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Checking...
                                  </>
                                ) : (
                                  <>
                                    <Zap className="h-3.5 w-3.5 text-amber-600" />
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
                                    ? "bg-slate-200 border-slate-300 text-slate-900"
                                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
                                }`}
                              >
                                <History className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => openEditModal(user)}
                                title="Edit password or status"
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 transition"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteUser(user)}
                                title="Delete account"
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Daily Run & Click History Accordion */}
                        {isLogOpen && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5 text-blue-600" />
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
                                      className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                            log.status === "success"
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                              : "bg-rose-50 text-rose-700 border border-rose-200"
                                          }`}
                                        >
                                          {log.status.toUpperCase()}
                                        </span>
                                        <span className="text-slate-800 font-medium">
                                          {log.message}
                                        </span>
                                      </div>
                                      <span className="text-slate-400 shrink-0">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Edit Credentials: {editingUser.username}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Agent Login-ID
                </label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Daily Automation Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as "active" | "inactive")
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="active">Active (Daily 12:00 AM IST)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-md shadow-blue-600/20"
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
