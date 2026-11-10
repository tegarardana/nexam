/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Cpu,
  BarChart3,
  Layers,
  Code2,
  KeyRound,
  Users,
  BookOpen,
  GraduationCap,
  X,
  RefreshCw,
  UserCheck,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dev Mode States
  const [isDevPromptOpen, setIsDevPromptOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [devVerifying, setDevVerifying] = useState(false);
  const [devVerifyError, setDevVerifyError] = useState<string | null>(null);

  // Dev Switcher Modal
  const [isDevSwitcherOpen, setIsDevSwitcherOpen] = useState(false);
  const [devUsers, setDevUsers] = useState<any[]>([]);
  const [devRoleFilter, setDevRoleFilter] = useState("all");
  const [devSearchQuery, setDevSearchQuery] = useState("");
  const [devSwitching, setDevSwitching] = useState(false);
  const [devSwitchingId, setDevSwitchingId] = useState<string | null>(null);

  const [settings, setSettings] = useState<{
    appName: string;
    appLogo: string;
    appTagline: string;
    institutionName: string;
    institutionLogo: string;
  }>({
    appName: "Nexam",
    appLogo: "",
    appTagline: "School Assessment & Examination Suite",
    institutionName: "SMK Negeri 1 Contoh",
    institutionLogo: "",
  });

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) {
          setSettings({
            appName: data.settings.appName || "Nexam",
            appLogo: data.settings.appLogo || "",
            appTagline: data.settings.appTagline || "School Assessment & Examination Suite",
            institutionName: data.settings.institutionName || "SMK Negeri 1 Contoh",
            institutionLogo: data.settings.institutionLogo || data.settings.appLogo || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal masuk ke sistem. Periksa kembali nama pengguna dan kata sandi.");
        setLoading(false);
        return;
      }

      // Route based on role
      const roles: string[] = data.user?.roles || [];
      if (roles.includes("administrator")) {
        router.push("/admin");
      } else if (roles.includes("teacher")) {
        router.push("/teacher");
      } else {
        router.push("/student");
      }
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan. Pastikan koneksi server aktif.");
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const handleGoogleLogin = () => {
    // Demo notice or social login trigger
    setError("Social login (Google) sedang disiapkan untuk domain sekolah terintegrasi Google Workspace.");
  };

  const handleOpenDevPrompt = async () => {
    // Cek apakah Dev Mode sudah aktif sebelumnya
    try {
      const res = await fetch("/api/auth/dev-mode");
      const data = await res.json();
      if (data.success && data.active && Array.isArray(data.users)) {
        setDevUsers(data.users);
        setIsDevSwitcherOpen(true);
        return;
      }
    } catch {}

    setAdminPasswordInput("");
    setDevVerifyError(null);
    setIsDevPromptOpen(true);
  };

  const handleVerifyDevPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevVerifyError(null);
    setDevVerifying(true);

    try {
      const res = await fetch("/api/auth/dev-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const data = await res.json();

      if (data.success) {
        setIsDevPromptOpen(false);
        setDevUsers(data.users || []);
        setIsDevSwitcherOpen(true);
      } else {
        setDevVerifyError(data.error || "Kata sandi administrator salah.");
      }
    } catch {
      setDevVerifyError("Terjadi kesalahan jaringan saat verifikasi.");
    } finally {
      setDevVerifying(false);
    }
  };

  const handleDevSwitchUser = async (targetUser: any) => {
    try {
      setDevSwitching(true);
      setDevSwitchingId(targetUser.id);

      const res = await fetch("/api/auth/dev-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id }),
      });
      const data = await res.json();

      if (data.success) {
        setIsDevSwitcherOpen(false);
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
      setDevSwitching(false);
      setDevSwitchingId(null);
    }
  };

  const filteredDevUsers = devUsers.filter((u) => {
    const matchesRole =
      devRoleFilter === "all" ||
      (devRoleFilter === "admin" && u.role === "administrator") ||
      (devRoleFilter === "teacher" && u.role === "teacher") ||
      (devRoleFilter === "student" && u.role === "student");

    const q = devSearchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.className && u.className.toLowerCase().includes(q));

    return matchesRole && matchesSearch;
  });

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-950">
      {/* ========================================================= */}
      {/* 1. KOLOM KIRI (Branding / Hero Section - Desktop only)     */}
      {/* ========================================================= */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-[#0D274C] min-h-screen relative overflow-hidden flex-col justify-between p-8 sm:p-12 lg:p-16 text-white border-r border-[#0D274C]">
        {/* Background glow effects & decorative pattern */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#65C443]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-[-100px] right-[-100px] w-[450px] h-[450px] bg-[#163B6E]/40 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-[#65C443]/10 rounded-full blur-2xl" />
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Top Header Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            {settings.appLogo ? (
              <img
                src={settings.appLogo}
                alt={settings.appName}
                className="h-11 w-auto max-w-[120px] object-contain shrink-0 drop-shadow-sm"
              />
            ) : (
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#65C443] to-emerald-400 shadow-lg shadow-[#65C443]/30 border border-white/20 shrink-0">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-xl tracking-tight">
                  {settings.appName || "Nexam"}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#65C443] text-white shadow-xs">
                  CBT Platform
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {settings.institutionName ? settings.institutionName : settings.appTagline}
              </p>
            </div>
          </div>
        </div>

        {/* Middle Hero Section */}
        <div className="relative z-10 my-auto py-12 max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15] mb-5">
            Build Your Skills With{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-[#65C443] to-teal-200 bg-clip-text text-transparent">
              Real-Time Intelligent Assessment
            </span>
          </h1>

          <p className="text-slate-200 text-sm sm:text-base leading-relaxed mb-8 max-w-lg">
            Platform ujian sekolah terpadu dengan pemantauan anti-cheat server-enforced, penjadwalan cerdas,
            dan analisis hasil instan untuk seluruh civitas akademik.
          </p>

          {/* Floating Feature / Stats Badges */}
          <div className="grid grid-cols-3 gap-3.5 pt-4">
            <div className="p-3.5 rounded-2xl bg-[#163B6E]/60 border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2 text-[#65C443] text-xs font-bold mb-1">
                <Cpu className="w-4 h-4" />
                <span>Anti-Cheat</span>
              </div>
              <div className="text-xs text-slate-200 font-medium">Server-Enforced Realtime Monitoring</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#163B6E]/60 border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold mb-1">
                <BarChart3 className="w-4 h-4" />
                <span>Analisis Nilai</span>
              </div>
              <div className="text-xs text-slate-200 font-medium">Kalkulasi Otomatis & Distribusi Bobot</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#163B6E]/60 border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1">
                <Layers className="w-4 h-4" />
                <span>Multi-Jenjang</span>
              </div>
              <div className="text-xs text-slate-200 font-medium">SD, SMP, SMA/SMK & Jurusan Fleksibel</div>
            </div>
          </div>
        </div>

        {/* Bottom Tagline / System Status */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#65C443] animate-pulse" />
            <span>{settings.appName || "Nexam"} CBT Engine • Server Ready</span>
          </div>
          <div className="text-slate-400 font-mono text-[11px]">Argon2id Enforced</div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. KOLOM KANAN (Form Login - White Background)             */}
      {/* ========================================================= */}
      <div className="w-full md:w-1/2 lg:w-2/5 min-h-screen bg-white text-slate-800 flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-y-auto">
        {/* Top spacer to balance vertical center */}
        <div className="w-full h-4" />

        {/* Center: Main Login Form Container */}
        <div className="flex flex-col justify-center items-center my-auto w-full py-6">
          <div className="max-w-md w-full mx-auto">
            {/* Mobile Branding (visible on mobile only) */}
            <div className="md:hidden flex items-center gap-3 mb-6 p-3 rounded-2xl bg-slate-50 border border-slate-200">
              {settings.appLogo ? (
                <img
                  src={settings.appLogo}
                  alt={settings.appName}
                  className="h-10 w-auto max-w-[100px] object-contain shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#0D274C] flex items-center justify-center text-[#65C443] shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 text-sm tracking-tight truncate">
                    {settings.appName || "Nexam"}
                  </span>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[#65C443] text-white">
                    CBT
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-600 truncate">
                  {settings.institutionName || "SMK Negeri 1 Contoh"}
                </div>
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="mb-7">
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome!</h2>
              <p className="text-sm text-slate-500 mt-1">Please login to your account.</p>
            </div>

            {/* Error Alert Box */}
            {error && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-rose-700 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Input Username / Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username-input"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: admin, guru.budi, siswa.andi"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-4 focus:ring-[#65C443]/15 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Input Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Silakan hubungi administrator sekolah Anda untuk mereset kata sandi akun.");
                    }}
                    className="text-xs text-[#0D274C] hover:text-[#65C443] font-semibold transition"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-4 focus:ring-[#65C443]/15 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#65C443] focus:ring-[#65C443] border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-medium">Remember this device</span>
                </label>
              </div>

              {/* Login Button (Pill-shaped / rounded-full with NetAcad Green #65C443) */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3.5 px-6 rounded-full bg-[#65C443] hover:bg-[#52a835] text-white font-bold text-sm shadow-md shadow-[#65C443]/25 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Divider 'Or continue with' */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold tracking-wider">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Social Login Button (Google) */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-3 px-4 rounded-full border border-slate-200 hover:bg-slate-50/80 text-slate-700 font-semibold text-xs transition duration-200 flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Dev Mode Entry Trigger */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={handleOpenDevPrompt}
                className="w-full py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#0D274C] hover:from-slate-800 hover:to-[#163b6e] text-white border border-slate-800 shadow-sm flex items-center justify-between transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-[#65C443] group-hover:scale-105 transition-transform">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Masuk ke Dev Mode</span>
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-[#65C443] text-white">
                        Trial
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Verifikasi admin untuk switch akun bebas (Admin/Guru/Siswa)
                    </div>
                  </div>
                </div>
                <div className="p-1 rounded-lg bg-white/5 text-slate-300 group-hover:translate-x-0.5 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL 1: VERIFIKASI PASSWORD ADMIN UNTUK DEV MODE         */}
        {/* ========================================================= */}
        {isDevPromptOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in select-none">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-900 text-[#65C443]">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Akses Dev Mode</h3>
                    <p className="text-[11px] text-slate-500">Mode Trial & Switcher Pengguna</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDevPromptOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleVerifyDevPassword} className="space-y-4 pt-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Masukkan kata sandi akun <strong>Administrator</strong> untuk membuka fitur pemilihan dan pertukaran akun trial:
                </p>

                {devVerifyError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{devVerifyError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kata Sandi Admin
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showAdminPassword ? "text" : "password"}
                      required
                      autoFocus
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="Masukkan password admin..."
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#65C443]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Gunakan password akun admin (misal: AdminPassword123!)
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDevPromptOpen(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={devVerifying}
                    className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold shadow-md shadow-[#65C443]/20 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {devVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Memverifikasi...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Buka Dev Mode</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: PILIH USER TRIAL (DEV MODE) DI LOGIN             */}
        {/* ========================================================= */}
        {isDevSwitcherOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in select-none">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full flex flex-col max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-[#0D274C] text-[#65C443] shadow-md shadow-[#0D274C]/20">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      Pilih Akun Trial (Dev Mode)
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#65C443]/15 text-[#2e7d18] border border-[#65C443]/30">
                        Admin Verified
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Klik akun target di bawah untuk langsung login dan masuk ke dashboard terkait.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDevSwitcherOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Tabs & Search */}
              <div className="p-4 border-b border-slate-100 bg-white space-y-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {[
                    { id: "all", label: "Semua", icon: Users },
                    { id: "admin", label: "Admin", icon: ShieldCheck },
                    { id: "teacher", label: "Guru", icon: BookOpen },
                    { id: "student", label: "Siswa", icon: GraduationCap },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = devRoleFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setDevRoleFilter(tab.id)}
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
                    value={devSearchQuery}
                    onChange={(e) => setDevSearchQuery(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#65C443]"
                  />
                </div>
              </div>

              {/* Users List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredDevUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Tidak ada akun yang sesuai dengan pencarian atau filter.
                  </div>
                ) : (
                  filteredDevUsers.map((u) => {
                    const isSwitchingThis = devSwitchingId === u.id;

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
                        onClick={() => !devSwitching && handleDevSwitchUser(u)}
                        className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-[#65C443]/50 transition flex items-center justify-between gap-3 cursor-pointer group"
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
                            <div className="font-bold text-slate-900 text-xs truncate group-hover:text-[#0D274C]">
                              {u.displayName}
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

                          <button
                            type="button"
                            disabled={devSwitching}
                            className="p-1.5 px-2.5 rounded-xl bg-slate-100 group-hover:bg-[#65C443] group-hover:text-white text-slate-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          >
                            {isSwitchingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                            <span className="text-[11px]">Masuk</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  {filteredDevUsers.length} akun tersedia untuk trial
                </span>
                <button
                  type="button"
                  onClick={() => setIsDevSwitcherOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs cursor-pointer transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer: Copyright & Anti-Cheat Notice */}
        <div className="w-full text-center pt-6 border-t border-slate-100 text-xs text-slate-400">
          <p className="font-semibold text-slate-600">
            {settings.appName || "Nexam"} CBT • {settings.institutionName || "Secure Examination Platform"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Protected by Server-Enforced Anti-Cheat Engine
          </p>
        </div>
      </div>
    </div>
  );
}
