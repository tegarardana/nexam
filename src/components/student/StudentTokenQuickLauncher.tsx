"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight, Loader2, Sparkles, AlertCircle } from "lucide-react";

export default function StudentTokenQuickLauncher() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim().toUpperCase();
    if (!cleanToken) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/student/examinations/quick-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cleanToken }),
      });

      const json = await res.json();

      if (res.ok && json.success && json.examination?.id) {
        // Berhasil mencocokkan token -> langsung arahkan ke ruang ujian dengan query param token
        router.push(`/student/exam/${json.examination.id}?token=${encodeURIComponent(cleanToken)}`);
      } else {
        setErrorMessage(json.error || "Token ujian tidak valid atau belum aktif.");
      }
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat memverifikasi token.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D274C] via-[#102f5a] to-[#0A1F3D] text-white p-5 sm:p-6 shadow-md border border-slate-700/50">
      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-44 h-44 bg-[#65C443]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold">
            <KeyRound className="w-3.5 h-3.5 text-[#65C443]" />
            <span>Akses Cepat Ujian CBT</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Punya Token Ujian dari Pengawas?</span>
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ketikkan kode token ujian yang diberikan oleh guru/pengawas untuk langsung membuka dan mengaktifkan lembar ujian Anda.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 max-w-md w-full flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              required
              maxLength={12}
              value={token}
              onChange={(e) => {
                setToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="MASUKKAN TOKEN"
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-slate-400 font-mono text-center tracking-widest text-base font-bold border border-white/20 focus:border-[#65C443] focus:outline-none transition shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="px-5 py-3 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#4ea030] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengecek...</span>
              </>
            ) : (
              <>
                <span>Buka Ujian</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {errorMessage && (
        <div className="mt-3.5 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

