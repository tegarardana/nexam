"use client";

import React, { useState } from "react";
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
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#65C443] to-emerald-400 shadow-lg shadow-[#65C443]/30 border border-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-xl tracking-tight">Nexam</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#65C443] text-white shadow-xs">
                  CBT Platform
                </span>
              </div>
              <p className="text-xs text-slate-300">School Assessment & Examination Suite</p>
            </div>
          </div>
        </div>

        {/* Middle Hero Section */}
        <div className="relative z-10 my-auto py-12 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#65C443]/15 border border-[#65C443]/30 text-[#65C443] text-xs font-semibold mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#65C443]" />
            <span>Next-Generation CBT Examination 2.0</span>
          </div>

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
            <span>Nexam CBT Engine v0.1 • Server Ready</span>
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

            {/* Demo Quick Fill Shortcuts */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-[#65C443]" />
                <span className="font-semibold text-slate-700">Akun Pengujian (Demo):</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill("admin", "AdminPassword123!")}
                  className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-[#65C443]/10 border border-slate-200 hover:border-[#65C443]/30 text-xs font-semibold text-slate-700 hover:text-[#2e7d18] transition text-center cursor-pointer"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill("guru.budi", "GuruBudi123!")}
                  className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-[#0D274C]/10 border border-slate-200 hover:border-[#0D274C]/30 text-xs font-semibold text-slate-700 hover:text-[#0D274C] transition text-center cursor-pointer"
                >
                  Guru
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill("siswa.andi", "SiswaAndi123!")}
                  className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-[#65C443]/10 border border-slate-200 hover:border-[#65C443]/30 text-xs font-semibold text-slate-700 hover:text-[#2e7d18] transition text-center cursor-pointer"
                >
                  Siswa
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Copyright & Anti-Cheat Notice */}
        <div className="w-full text-center pt-6 border-t border-slate-100 text-xs text-slate-400">
          <p className="font-semibold text-slate-600">Nexam CBT • Secure Examination Platform</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Protected by Server-Enforced Anti-Cheat Engine
          </p>
        </div>
      </div>
    </div>
  );
}
