"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  SlidersHorizontal,
  TrendingUp,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Info,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface KatrolModalProps {
  isOpen: boolean;
  onClose: () => void;
  examinationId: string;
  passingScore: number;
  students: any[];
  onAdjustSuccess: () => void;
  hasActiveAdjustment: boolean;
  currentAdjustmentReason?: string | null;
}

export default function KatrolModal({
  isOpen,
  onClose,
  examinationId,
  passingScore,
  students,
  onAdjustSuccess,
  hasActiveAdjustment,
  currentAdjustmentReason,
}: KatrolModalProps) {
  const [method, setMethod] = useState<"flat" | "linear" | "multiplier" | "kkm_floor">("flat");
  const [flatPoints, setFlatPoints] = useState<number>(5);
  const [targetMin, setTargetMin] = useState<number>(passingScore || 75);
  const [targetMax, setTargetMax] = useState<number>(100);
  const [multiplier, setMultiplier] = useState<number>(1.1);
  const [targetKkm, setTargetKkm] = useState<number>(passingScore || 75);
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Filter students who have valid percentage
  const gradedStudents = useMemo(() => {
    return students.filter((s) => s.percentage !== null);
  }, [students]);

  // Compute Live Preview
  const previewData = useMemo(() => {
    if (gradedStudents.length === 0) return [];

    const percentages = gradedStudents.map((s) => s.percentage);
    const minOrig = Math.min(...percentages);
    const maxOrig = Math.max(...percentages);

    return gradedStudents.map((s) => {
      const orig = s.percentage;
      let adjusted = orig;

      if (method === "flat") {
        adjusted = Math.min(100, Math.max(0, orig + (flatPoints || 0)));
      } else if (method === "linear") {
        if (maxOrig === minOrig) {
          adjusted = targetMax;
        } else {
          adjusted = targetMin + ((orig - minOrig) / (maxOrig - minOrig)) * (targetMax - targetMin);
        }
        adjusted = Math.min(100, Math.max(0, adjusted));
      } else if (method === "multiplier") {
        adjusted = Math.min(100, Math.max(0, orig * (multiplier || 1)));
      } else if (method === "kkm_floor") {
        adjusted = orig < targetKkm ? targetKkm : orig;
      }

      const roundedNew = Math.round(adjusted * 10) / 10;
      const diff = Math.round((roundedNew - orig) * 10) / 10;
      const isPassedNew = roundedNew >= passingScore;

      return {
        studentId: s.studentId,
        studentName: s.studentName,
        nis: s.nis,
        className: s.className,
        originalPercentage: orig,
        newPercentage: roundedNew,
        diff,
        isPassedNew,
      };
    });
  }, [gradedStudents, method, flatPoints, targetMin, targetMax, multiplier, targetKkm, passingScore]);

  // Statistics before & after
  const statsComparison = useMemo(() => {
    if (previewData.length === 0) {
      return {
        origAvg: 0,
        newAvg: 0,
        origPassCount: 0,
        newPassCount: 0,
        origPassRate: 0,
        newPassRate: 0,
      };
    }

    const total = previewData.length;
    const origSum = previewData.reduce((acc, curr) => acc + curr.originalPercentage, 0);
    const newSum = previewData.reduce((acc, curr) => acc + curr.newPercentage, 0);

    const origAvg = Math.round((origSum / total) * 10) / 10;
    const newAvg = Math.round((newSum / total) * 10) / 10;

    const origPassCount = previewData.filter((p) => p.originalPercentage >= passingScore).length;
    const newPassCount = previewData.filter((p) => p.isPassedNew).length;

    const origPassRate = Math.round((origPassCount / total) * 100);
    const newPassRate = Math.round((newPassCount / total) * 100);

    return { origAvg, newAvg, origPassCount, newPassCount, origPassRate, newPassRate };
  }, [previewData, passingScore]);

  // Handle Apply Katrol
  const handleApplyKatrol = async () => {
    if (previewData.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/examinations/${examinationId}/results/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          params: {
            flatPoints,
            targetMin,
            targetMax,
            multiplier,
            targetKkm,
          },
          reason: reason.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menerapkan katrol nilai.");
      }

      alert("Katrol nilai berhasil diterapkan!");
      onAdjustSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat menerapkan katrol nilai.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Reset to original scores
  const handleResetKatrol = async () => {
    if (!confirm("Apakah Anda yakin ingin mengembalikan seluruh nilai siswa ke nilai murni (menghapus katrol)?")) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(`/api/examinations/${examinationId}/results/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "reset",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengembalikan nilai murni.");
      }

      alert("Nilai siswa berhasil dikembalikan ke nilai murni!");
      onAdjustSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat mengembalikan nilai.");
    } finally {
      setResetting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-[#0D274C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#65C443]/20 flex items-center justify-center text-[#65C443]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Fitur Katrol Nilai Siswa (Skalasi Nilai)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#65C443] text-slate-950 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Curving Tool</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Sesuaikan distribusi nilai ujian siswa secara proporsional dengan standar KKM {passingScore}%
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8FAFC]">
          {/* Active Adjustment Banner (if any) */}
          {hasActiveAdjustment && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Saat ini terdapat katrol nilai aktif: <strong>{currentAdjustmentReason || "Penyesuaian Nilai"}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetKatrol}
                disabled={resetting}
                className="px-3 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{resetting ? "Mereset..." : "Kembalikan ke Nilai Murni"}</span>
              </button>
            </div>
          )}

          {/* Method Selection Cards */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              1. Pilih Metode Katrol Nilai
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Option 1: Flat */}
              <button
                type="button"
                onClick={() => setMethod("flat")}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  method === "flat"
                    ? "border-[#0D274C] bg-white ring-2 ring-[#0D274C] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">Tambah Poin (+X)</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Menambahkan poin tetap untuk semua peserta ujian (maks 100).
                  </p>
                </div>
                <div className="text-[10px] font-mono text-emerald-700 font-bold mt-2">
                  Rumus: Nilai + X
                </div>
              </button>

              {/* Option 2: Linear */}
              <button
                type="button"
                onClick={() => setMethod("linear")}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  method === "linear"
                    ? "border-[#0D274C] bg-white ring-2 ring-[#0D274C] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">Skala Linier (Min-Max)</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Mengangkat nilai terendah dan tertinggi ke batas target proporsional.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-blue-700 font-bold mt-2">
                  Kurva Proporsional
                </div>
              </button>

              {/* Option 3: Multiplier */}
              <button
                type="button"
                onClick={() => setMethod("multiplier")}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  method === "multiplier"
                    ? "border-[#0D274C] bg-white ring-2 ring-[#0D274C] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">Faktor Pengali (%)</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Mengalikan nilai dengan persentase tertentu, misal 1.1x (+10%).
                  </p>
                </div>
                <div className="text-[10px] font-mono text-purple-700 font-bold mt-2">
                  Rumus: Nilai × Faktor
                </div>
              </button>

              {/* Option 4: KKM Floor */}
              <button
                type="button"
                onClick={() => setMethod("kkm_floor")}
                className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  method === "kkm_floor"
                    ? "border-[#0D274C] bg-white ring-2 ring-[#0D274C] shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">Batas KKM Minimum</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Hanya mengangkat siswa di bawah KKM menjadi pas KKM.
                  </p>
                </div>
                <div className="text-[10px] font-mono text-cyan-700 font-bold mt-2">
                  Floor to KKM
                </div>
              </button>
            </div>
          </div>

          {/* Parameter Configuration Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              2. Parameter Katrol
            </div>

            {method === "flat" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Besaran Penambahan Poin (+Poin)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={flatPoints}
                      onChange={(e) => setFlatPoints(parseFloat(e.target.value) || 0)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                    <span className="text-xs text-slate-500 font-medium">Poin ke setiap siswa</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-4">
                  {[2, 5, 8, 10, 15].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setFlatPoints(pts)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono transition cursor-pointer"
                    >
                      +{pts}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "linear" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Batas Nilai Terendah (Min Target)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={targetMin}
                      onChange={(e) => setTargetMin(parseFloat(e.target.value) || 0)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                    <span className="text-xs text-slate-500 font-medium">(Default: KKM {passingScore})</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Batas Nilai Tertinggi (Max Target)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={targetMin}
                      max={100}
                      value={targetMax}
                      onChange={(e) => setTargetMax(parseFloat(e.target.value) || 100)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                    <span className="text-xs text-slate-500 font-medium">(Default: 100)</span>
                  </div>
                </div>
              </div>
            )}

            {method === "multiplier" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Faktor Multiplier Pengali
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.05}
                      min={1.0}
                      max={2.0}
                      value={multiplier}
                      onChange={(e) => setMultiplier(parseFloat(e.target.value) || 1)}
                      className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                    <span className="text-xs text-slate-500 font-medium">
                      = Kenaikan +{Math.round((multiplier - 1) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-4">
                  {[1.05, 1.1, 1.15, 1.2].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMultiplier(m)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold font-mono transition cursor-pointer"
                    >
                      {m}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "kkm_floor" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Batas Minimal Nilai KKM
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={targetKkm}
                    onChange={(e) => setTargetKkm(parseFloat(e.target.value) || passingScore)}
                    className="w-32 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#65C443]"
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    Siswa dengan nilai di bawah ini akan diangkat tepat ke {targetKkm}
                  </span>
                </div>
              </div>
            )}

            {/* Reason field */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan / Alasan Katrol (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Katrol Nilai PAS Ganjil 2026 / Penyesuaian Tingkat Kesulitan Soal"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
              />
            </div>
          </div>

          {/* Comparison Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Rata-Rata Asli</div>
              <div className="text-lg font-extrabold text-slate-700">{statsComparison.origAvg}%</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase">Rata-Rata Baru</div>
              <div className="text-lg font-extrabold text-emerald-700 flex items-center gap-1">
                <span>{statsComparison.newAvg}%</span>
                <span className="text-[11px] font-bold text-emerald-600 font-mono">
                  (+{Math.round((statsComparison.newAvg - statsComparison.origAvg) * 10) / 10})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Kelulusan Asli</div>
              <div className="text-lg font-extrabold text-slate-700">
                {statsComparison.origPassRate}% ({statsComparison.origPassCount} Siswa)
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#0D274C] uppercase">Kelulusan Baru</div>
              <div className="text-lg font-extrabold text-[#0D274C] flex items-center gap-1">
                <span>{statsComparison.newPassRate}%</span>
                <span className="text-[11px] font-bold text-emerald-600 font-mono">
                  ({statsComparison.newPassCount} Siswa)
                </span>
              </div>
            </div>
          </div>

          {/* Live Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-2">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Pratinjau Hasil Katrol ({previewData.length} Siswa)
              </span>
              <span className="text-[11px] text-slate-500">
                KKM: <strong>{passingScore}%</strong>
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 w-10 text-center">No</th>
                    <th className="py-2 px-3">Nama Siswa</th>
                    <th className="py-2 px-3 text-center">Nilai Asli</th>
                    <th className="py-2 px-3 text-center">Nilai Baru</th>
                    <th className="py-2 px-3 text-center">Selisih</th>
                    <th className="py-2 px-3 text-center">Status Baru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData.map((item, idx) => (
                    <tr key={item.studentId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{item.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">NIS: {item.nis}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">
                        {item.originalPercentage}%
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-extrabold text-emerald-700 bg-emerald-50/30">
                        {item.newPercentage}%
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-emerald-600">
                        +{item.diff}%
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.isPassedNew ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>LULUS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>REMEDIAL</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            {hasActiveAdjustment && (
              <button
                type="button"
                onClick={handleResetKatrol}
                disabled={resetting}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{resetting ? "Mereset..." : "Hapus Katrol"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyKatrol}
              disabled={submitting || previewData.length === 0}
              className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{submitting ? "Menerapkan Katrol..." : "Terapkan Katrol Nilai Sekarang"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
