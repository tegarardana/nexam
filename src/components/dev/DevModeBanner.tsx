"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Users,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  UserCheck,
  X,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  LogOut,
  Sparkles,
} from "lucide-react";

interface DevUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  nis: string | null;
  nip: string | null;
  role: string;
  roles: string[];
  className: string | null;
}

export default function DevModeBanner() {
  const router = useRouter();
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [users, setUsers] = useState<DevUser[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [switching, setSwitching] = useState<boolean>(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    // Periksa cookie nexam_dev_mode
    const checkDevMode = () => {
      const cookies = document.cookie.split(";").map((c) => c.trim());
      const hasDevCookie = cookies.some((c) => c.startsWith("nexam_dev_mode=true"));
      setIsDevMode(hasDevCookie);

      if (hasDevCookie) {
        // Ambil info current user
        fetch("/api/auth/me")
          .then((r) => r.json())
          .then((d) => {
            if (d.success && d.user) {
              setCurrentUser(d.user);
            }
          })
          .catch(() => {});
      }
    };

    checkDevMode();

    const interval = setInterval(checkDevMode, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadDevUsers = async () => {
    try {
      const res = await fetch("/api/auth/dev-mode");
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Gagal memuat daftar user dev:", err);
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    loadDevUsers();
  };

  const handleSwitchUser = async (targetUser: DevUser) => {
    try {
      setSwitching(true);
      setSwitchingId(targetUser.id);
      const res = await fetch("/api/auth/dev-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id }),
      });
      const data = await res.json();

      if (data.success) {
        setIsModalOpen(false);
        if (data.redirectUrl) {
          router.push(data.redirectUrl);
          router.refresh();
        } else {
          window.location.reload();
        }
      } else {
        alert(data.error || "Gagal beralih pengguna.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan saat beralih akun.");
    } finally {
      setSwitching(false);
      setSwitchingId(null);
    }
  };

  const handleExitDevMode = async () => {
    if (confirm("Nonaktifkan Dev Mode? Anda akan kembali ke mode pengguna reguler.")) {
      try {
        await fetch("/api/auth/dev-mode", { method: "DELETE" });
        setIsDevMode(false);
        window.location.reload();
      } catch (err) {
        console.error("Gagal keluar dari dev mode:", err);
      }
    }
  };

  if (!isDevMode) return null;

  const filteredUsers = users.filter((u) => {
    const matchesRole =
      selectedRoleFilter === "all" ||
      (selectedRoleFilter === "admin" && u.role === "administrator") ||
      (selectedRoleFilter === "teacher" && u.role === "teacher") ||
      (selectedRoleFilter === "student" && u.role === "student");

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.className && u.className.toLowerCase().includes(q));

    return matchesRole && matchesSearch;
  });

  return (
    <>
      {/* FLOATING ACTION BAR */}
      <div className="fixed bottom-4 right-4 z-[9999] select-none print:hidden">
        {isCollapsed ? (
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-900/90 text-white shadow-2xl backdrop-blur-md border border-[#65C443]/40 text-xs font-bold hover:scale-105 transition-all cursor-pointer group"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#65C443] animate-pulse" />
            <Code2 className="w-4 h-4 text-[#65C443]" />
            <span>Dev Mode</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
          </button>
        ) : (
          <div className="flex items-center gap-2 p-1.5 pl-3 bg-slate-900/95 text-white shadow-2xl backdrop-blur-md rounded-2xl border border-slate-700/80 text-xs">
            <div className="flex items-center gap-2 pr-1 border-r border-slate-700/80">
              <div className="w-2 h-2 rounded-full bg-[#65C443] animate-pulse" />
              <div className="flex flex-col">
                <span className="font-extrabold text-[11px] text-[#65C443] leading-none flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#65C443]" /> Dev Trial
                </span>
                {currentUser && (
                  <span className="text-[10px] text-slate-300 font-medium leading-none mt-0.5 truncate max-w-[110px]">
                    {currentUser.displayName}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenModal}
              className="px-2.5 py-1.5 rounded-xl bg-[#65C443] hover:bg-[#54a837] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ganti Akun</span>
            </button>

            <button
              type="button"
              onClick={handleExitDevMode}
              title="Matikan Dev Mode"
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              title="Ciutkan Widget"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* MODAL USER SWITCHER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in select-none">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#0D274C] text-[#65C443] shadow-md shadow-[#0D274C]/20">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    Dev Mode: Switcher Akun Trial
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#65C443]/15 text-[#2e7d18] border border-[#65C443]/30">
                      Aktif
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih akun target untuk langsung login tanpa memasukkan kata sandi.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                {[
                  { id: "all", label: "Semua Akun", icon: Users },
                  { id: "admin", label: "Admin", icon: ShieldCheck },
                  { id: "teacher", label: "Guru", icon: BookOpen },
                  { id: "student", label: "Siswa", icon: GraduationCap },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = selectedRoleFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedRoleFilter(tab.id)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isActive
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#65C443]" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Cari nama, username, atau kelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#65C443]"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Tidak ada akun yang sesuai dengan pencarian atau filter.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id || currentUser?.username === u.username;
                  const isSwitchingThis = switchingId === u.id;

                  const roleBadgeColor =
                    u.role === "administrator"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : u.role === "teacher"
                      ? "bg-[#0D274C]/10 text-[#0D274C] border-[#0D274C]/20"
                      : "bg-[#65C443]/15 text-[#2e7d18] border-[#65C443]/30";

                  const roleLabel =
                    u.role === "administrator" ? "Administrator" : u.role === "teacher" ? "Guru" : "Siswa";

                  return (
                    <div
                      key={u.id}
                      onClick={() => !isCurrent && !switching && handleSwitchUser(u)}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-300/40"
                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-[#65C443]/40 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            u.role === "administrator"
                              ? "bg-amber-100 text-amber-800"
                              : u.role === "teacher"
                              ? "bg-[#0D274C] text-white"
                              : "bg-[#65C443] text-white"
                          }`}
                        >
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {u.displayName}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                                Akun Aktif
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-mono">@{u.username}</span>
                            {u.className && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-slate-700">{u.className}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadgeColor}`}
                        >
                          {roleLabel}
                        </span>

                        {!isCurrent && (
                          <button
                            type="button"
                            disabled={switching}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-[#65C443] hover:text-white text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            {isSwitchingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline text-[11px]">Beralih</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                {filteredUsers.length} akun tersedia untuk pengujian
              </span>
              <button
                type="button"
                onClick={handleExitDevMode}
                className="text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer transition flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                <span>Matikan Dev Mode</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

