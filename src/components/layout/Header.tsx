"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut, Calendar, User as UserIcon, Menu } from "lucide-react";

interface HeaderProps {
  user: {
    username: string;
    displayName: string;
    roles: string[];
  };
  activeYear?: string | null;
  activeSemester?: string | null;
  onToggleMobileMenu?: () => void;
  breadcrumb?: React.ReactNode;
}

export default function Header({
  user,
  activeYear,
  activeSemester,
  onToggleMobileMenu,
  breadcrumb,
}: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  const primaryRole = user.roles[0] || "user";
  const roleBadgeColors: Record<string, string> = {
    administrator: "bg-amber-50 text-amber-700 border-amber-200",
    teacher: "bg-[#0D274C]/10 text-[#0D274C] border-[#0D274C]/20",
    student: "bg-[#65C443]/15 text-[#2e7d18] border-[#65C443]/30 font-semibold",
  };

  const roleLabel: Record<string, string> = {
    administrator: "Administrator",
    teacher: "Guru / Penguji",
    student: "Siswa",
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-xs">
      <div className="w-full flex items-center justify-between gap-4">
        {/* Left: Breadcrumb (or Branding if breadcrumb not provided) */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
              title="Buka Menu Sidebar"
            >
              <Menu className="w-5 h-5 text-[#0D274C]" />
            </button>
          )}

          {breadcrumb ? (
            <div className="min-w-0 flex items-center">
              {breadcrumb}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0D274C] to-[#163B6E] shadow-sm shadow-[#0D274C]/20 border border-[#0D274C]/30 shrink-0">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#0D274C] tracking-tight text-lg">Nexam</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-bold bg-[#65C443] text-white shadow-xs">
                    CBT
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center: Academic Context Indicator */}
        {activeYear && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-[#65C443]" />
            <span className="font-medium">T.A. {activeYear}</span>
            {activeSemester && (
              <>
                <span className="text-slate-400">•</span>
                <span className="text-[#0D274C] font-semibold">{activeSemester}</span>
              </>
            )}
          </div>
        )}

        {/* Right: User Profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 pl-2">
            <div className="w-8 h-8 rounded-full bg-[#0D274C]/10 border border-[#0D274C]/20 flex items-center justify-center text-[#0D274C] font-bold text-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {user.displayName}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                    roleBadgeColors[primaryRole] || "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {roleLabel[primaryRole] || primaryRole}
                </span>
                <span className="text-[10px] text-slate-500">@{user.username}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Keluar dari akun"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
