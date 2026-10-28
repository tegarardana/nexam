"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ShieldAlert,
  Award,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  PenTool,
  FileText,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { RichTextRenderer } from "@/components/ui/RichTextRenderer";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  examinationId: string;
  attemptId: string | null;
  studentName?: string;
  onGradeSaved?: () => void;
  initialFilter?: "all" | "essay";
}

export default function StudentReviewModal({
  isOpen,
  onClose,
  examinationId,
  attemptId,
  studentName,
  onGradeSaved,
  initialFilter = "all",
}: ReviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active question index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filterMode, setFilterMode] = useState<"all" | "essay" | "wrong">(initialFilter);

  // Essay grading state: map of examinationQuestionId -> { rawScore, teacherFeedback }
  const [essayGrades, setEssayGrades] = useState<Record<string, { rawScore: number; feedback: string }>>({});
  const [savingGrade, setSavingGrade] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Fetch review data
  useEffect(() => {
    if (!isOpen || !attemptId) return;

    setLoading(true);
    setErrorMsg(null);
    setSaveToast(null);

    fetch(`/api/examinations/${examinationId}/attempts/${attemptId}/review`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          throw new Error(json.error || "Gagal memuat lembar jawaban siswa.");
        }
        setData(json.data);

        // Pre-fill existing essay grades
        const initialGrades: Record<string, { rawScore: number; feedback: string }> = {};
        json.data.questions.forEach((q: any) => {
          if (q.questionType === "essay") {
            initialGrades[q.examinationQuestionId] = {
              rawScore: q.gradingRecord?.rawScore !== null ? q.gradingRecord?.rawScore : 0,
              feedback: q.gradingRecord?.teacherFeedback || "",
            };
          }
        });
        setEssayGrades(initialGrades);

        // If initialFilter was essay, find first essay question
        if (initialFilter === "essay") {
          const firstEssayIdx = json.data.questions.findIndex((q: any) => q.questionType === "essay");
          if (firstEssayIdx !== -1) {
            setCurrentIndex(firstEssayIdx);
          }
        } else {
          setCurrentIndex(0);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setErrorMsg(err.message || "Terjadi kesalahan saat memuat lembar jawaban.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, examinationId, attemptId, initialFilter]);

  // Filtered questions
  const displayedQuestions = useMemo(() => {
    if (!data?.questions) return [];
    if (filterMode === "essay") {
      return data.questions.filter((q: any) => q.questionType === "essay");
    }
    if (filterMode === "wrong") {
      return data.questions.filter((q: any) => {
        const raw = q.gradingRecord?.rawScore;
        const max = q.maxScore;
        return raw !== null && raw < max && q.questionType !== "essay";
      });
    }
    return data.questions;
  }, [data?.questions, filterMode]);

  // Ensure current question is valid
  const currentQuestion = displayedQuestions[currentIndex] || displayedQuestions[0];

  // Helper to determine question status badge
  const getQuestionStatus = (q: any) => {
    if (q.questionType === "essay") {
      if (q.gradingRecord?.gradingStatus === "finalized") {
        return { label: "Esai Dinilai", color: "bg-blue-100 text-blue-800 border-blue-200" };
      }
      return { label: "Perlu Dinilai", color: "bg-amber-100 text-amber-800 border-amber-200" };
    }

    const raw = q.gradingRecord?.rawScore;
    const max = q.maxScore;
    if (raw === null || raw === undefined) {
      return { label: "Belum Dinilai", color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
    if (raw >= max) {
      return { label: "Benar", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (raw > 0) {
      return { label: "Parsial", color: "bg-cyan-100 text-cyan-800 border-cyan-200" };
    }
    return { label: "Salah", color: "bg-rose-100 text-rose-800 border-rose-200" };
  };

  // Save current essay grade or all essay grades
  const handleSaveEssayGrade = async (targetQuestionId?: string) => {
    if (!attemptId) return;

    setSavingGrade(true);
    setSaveToast(null);

    try {
      const gradesToSubmit = targetQuestionId
        ? [
            {
              examinationQuestionId: targetQuestionId,
              rawScore: essayGrades[targetQuestionId]?.rawScore ?? 0,
              teacherFeedback: essayGrades[targetQuestionId]?.feedback || "",
            },
          ]
        : Object.entries(essayGrades).map(([qId, val]) => ({
            examinationQuestionId: qId,
            rawScore: val.rawScore,
            teacherFeedback: val.feedback,
          }));

      const res = await fetch(`/api/examinations/${examinationId}/attempts/${attemptId}/grade-essay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: gradesToSubmit }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan penilaian esai.");
      }

      setSaveToast("Nilai esai berhasil disimpan!");
      setTimeout(() => setSaveToast(null), 3500);

      // Update local question data
      setData((prev: any) => {
        if (!prev) return prev;
        const updatedQuestions = prev.questions.map((q: any) => {
          const match = gradesToSubmit.find((g) => g.examinationQuestionId === q.examinationQuestionId);
          if (match) {
            return {
              ...q,
              gradingRecord: {
                ...q.gradingRecord,
                rawScore: match.rawScore,
                teacherFeedback: match.teacherFeedback,
                gradingStatus: "finalized",
              },
            };
          }
          return q;
        });

        return {
          ...prev,
          result: {
            ...prev.result,
            totalScore: json.data.totalScore,
            essayScore: json.data.essayScore,
            percentage: json.data.percentage,
            isProvisional: !json.data.isCompleted,
          },
          questions: updatedQuestions,
        };
      });

      if (onGradeSaved) {
        onGradeSaved();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Terjadi kesalahan saat menyimpan penilaian.");
    } finally {
      setSavingGrade(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:px-6 border-b border-slate-200 bg-[#0D274C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#65C443]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Tinjauan Lembar Jawaban Siswa
                </h3>
                {data?.result?.isProvisional && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                    Menunggu Penilaian Esai
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {data?.student?.displayName || studentName || "Siswa"} • NIS: {data?.student?.nis || "-"} • Kelas: {data?.student?.className || "-"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data?.result && (
              <div className="hidden sm:flex items-center gap-3 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/15 text-xs">
                <div>
                  <span className="text-slate-300 block text-[10px]">Nilai Akhir:</span>
                  <span className="font-extrabold font-mono text-[#65C443] text-sm">
                    {data.result.percentage}%
                  </span>
                </div>
                <div className="h-6 w-px bg-white/20" />
                <div>
                  <span className="text-slate-300 block text-[10px]">Objektif:</span>
                  <span className="font-bold text-white text-xs">{data.result.objectiveScore ?? "-"}</span>
                </div>
                <div className="h-6 w-px bg-white/20" />
                <div>
                  <span className="text-slate-300 block text-[10px]">Esai:</span>
                  <span className="font-bold text-amber-300 text-xs">{data.result.essayScore ?? "-"}</span>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Tutup Tinjauan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
            <div className="w-10 h-10 border-4 border-[#0D274C]/20 border-t-[#0D274C] rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold">Memuat data lembar jawaban & hasil penilaian...</p>
          </div>
        ) : errorMsg || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
            <h4 className="text-sm font-bold text-slate-800">Gagal Memuat Lembar Jawaban</h4>
            <p className="text-xs text-slate-500 mt-1">{errorMsg}</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Question Navigation Sidebar (Desktop: 30%, Mobile: Top) */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
              {/* Filter Tabs */}
              <div className="p-3 border-b border-slate-200 flex gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("all");
                    setCurrentIndex(0);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                    filterMode === "all"
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Semua ({data.questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("essay");
                    setCurrentIndex(0);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                    filterMode === "essay"
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Esai ({data.questions.filter((q: any) => q.questionType === "essay").length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("wrong");
                    setCurrentIndex(0);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition cursor-pointer ${
                    filterMode === "wrong"
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Salah ({data.questions.filter((q: any) => {
                    const raw = q.gradingRecord?.rawScore;
                    return raw !== null && raw < q.maxScore && q.questionType !== "essay";
                  }).length})
                </button>
              </div>

              {/* Grid of Question Numbers */}
              <div className="flex-1 overflow-y-auto p-3.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Daftar Nomor Soal
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {displayedQuestions.map((q: any, idx: number) => {
                    const isActive = idx === currentIndex;
                    const status = getQuestionStatus(q);
                    const isEssay = q.questionType === "essay";

                    return (
                      <button
                        key={q.examinationQuestionId}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-10 rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center relative transition cursor-pointer border ${
                          isActive
                            ? "ring-2 ring-[#0D274C] border-[#0D274C] bg-white shadow-sm"
                            : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span>{q.sequenceNumber}</span>
                        <span
                          className={`w-2 h-2 rounded-full mt-0.5 ${
                            isEssay
                              ? q.gradingRecord?.gradingStatus === "finalized"
                                ? "bg-blue-500"
                                : "bg-amber-500"
                              : q.gradingRecord?.rawScore >= q.maxScore
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-slate-200 space-y-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Jawaban Benar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>Jawaban Salah</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Esai (Menunggu Penilaian)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Esai (Telah Dinilai)</span>
                  </div>
                </div>
              </div>

              {/* Left Bottom: Save All Essays Button */}
              {data.questions.some((q: any) => q.questionType === "essay") && (
                <div className="p-3 border-t border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => handleSaveEssayGrade()}
                    disabled={savingGrade}
                    className="w-full py-2 px-3 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingGrade ? "Menyimpan..." : "Simpan Semua Nilai Esai"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: Question Review & Grading Detail */}
            <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 bg-white">
              {currentQuestion ? (
                <div className="space-y-6 max-w-3xl">
                  {/* Top Bar of Current Question */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-xl bg-[#0D274C] text-white text-xs font-mono font-bold">
                        Soal No. {currentQuestion.sequenceNumber}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 capitalize">
                        {currentQuestion.questionType.replace("_", " ")}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Bobot: <strong>{currentQuestion.maxScore} Poin</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {(() => {
                        const status = getQuestionStatus(currentQuestion);
                        return (
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Toast Alert */}
                  {saveToast && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{saveToast}</span>
                    </div>
                  )}

                  {/* Question Content / Stimulus */}
                  <div className="space-y-3">
                    <RichTextRenderer
                      content={currentQuestion.content?.text || "Pertanyaan"}
                      className="text-sm font-semibold text-slate-900 leading-relaxed"
                    />
                  </div>

                  {/* Rendering Options for Objective Questions */}
                  {["single_choice", "multi_select", "true_false"].includes(currentQuestion.questionType) && (
                    <div className="space-y-2.5 pt-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Pilihan Jawaban & Hasil
                      </div>
                      <div className="space-y-2">
                        {currentQuestion.options.map((opt: any) => {
                          const studentAns = currentQuestion.studentAnswer;
                          const isSelectedByStudent =
                            currentQuestion.questionType === "multi_select"
                              ? Array.isArray(studentAns) && studentAns.includes(opt.id)
                              : String(studentAns) === opt.id || String(studentAns).toUpperCase() === opt.label.toUpperCase();
                          const isCorrectKey = Boolean(opt.isCorrect);

                          let borderBg = "border-slate-200 bg-white hover:bg-slate-50";
                          if (isSelectedByStudent && isCorrectKey) {
                            borderBg = "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200";
                          } else if (isSelectedByStudent && !isCorrectKey) {
                            borderBg = "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200";
                          } else if (!isSelectedByStudent && isCorrectKey) {
                            borderBg = "border-emerald-200 bg-emerald-50/20";
                          }

                          return (
                            <div
                              key={opt.id}
                              className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 transition ${borderBg}`}
                            >
                              <div className="flex items-start gap-2.5 flex-1 overflow-hidden">
                                <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold font-mono flex items-center justify-center shrink-0">
                                  {opt.label}
                                </span>
                                <div className="text-slate-800 pt-0.5 leading-relaxed flex-1 overflow-hidden">
                                  <RichTextRenderer
                                    asInline
                                    content={opt.content?.text || "-"}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                {isSelectedByStudent && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0D274C] text-white">
                                    Jawaban Siswa
                                  </span>
                                )}
                                {isCorrectKey && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Kunci Benar</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rendering Short Answer Question */}
                  {currentQuestion.questionType === "short_answer" && (
                    <div className="space-y-4 pt-2">
                      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Jawaban Siswa
                        </div>
                        <div className="text-sm font-bold text-slate-900 font-mono">
                          {currentQuestion.studentAnswer || "(Tidak dijawab)"}
                        </div>
                      </div>

                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                          Kunci Jawaban Resmi
                        </div>
                        <div className="text-xs font-semibold text-emerald-900 font-mono">
                          {Array.isArray(currentQuestion.answerKey)
                            ? currentQuestion.answerKey.join(" / ")
                            : String(currentQuestion.answerKey || "-")}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rendering Essay Question & Grading Form */}
                  {currentQuestion.questionType === "essay" && (
                    <div className="space-y-5 pt-2">
                      {/* Student's Essay Text */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-slate-500" />
                          <span>Lembar Jawaban Esai Siswa</span>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 font-mono leading-relaxed whitespace-pre-wrap min-h-[120px]">
                          {currentQuestion.studentAnswer ? (
                            currentQuestion.studentAnswer
                          ) : (
                            <span className="text-slate-400 italic">Siswa tidak menuliskan jawaban untuk pertanyaan ini.</span>
                          )}
                        </div>
                      </div>

                      {/* Rubric Reference (if available) */}
                      {currentQuestion.answerKey && (
                        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 text-xs text-blue-900 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-blue-800">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Panduan Penskoran / Rubrik Guru</span>
                          </div>
                          <p className="text-[11px] text-blue-800/90 whitespace-pre-wrap">
                            {currentQuestion.answerKey}
                          </p>
                        </div>
                      )}

                      {/* Teacher Grading Box */}
                      <div className="p-5 rounded-2xl border-2 border-[#0D274C]/20 bg-[#F8FAFC] space-y-4 shadow-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PenTool className="w-4 h-4 text-[#0D274C]" />
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              Formulir Penilaian Guru
                            </h4>
                          </div>
                          <span className="text-xs font-semibold text-slate-600">
                            Skor Maksimal: <strong>{currentQuestion.maxScore} Poin</strong>
                          </span>
                        </div>

                        {/* Quick Score Chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 font-semibold mr-1">Skor Cepat:</span>
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                            const val = Math.round(currentQuestion.maxScore * ratio * 10) / 10;
                            return (
                              <button
                                key={ratio}
                                type="button"
                                onClick={() => {
                                  setEssayGrades((prev) => ({
                                    ...prev,
                                    [currentQuestion.examinationQuestionId]: {
                                      rawScore: val,
                                      feedback: prev[currentQuestion.examinationQuestionId]?.feedback || "",
                                    },
                                  }));
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold font-mono transition cursor-pointer"
                              >
                                {val} ({Math.round(ratio * 100)}%)
                              </button>
                            );
                          })}
                        </div>

                        {/* Input Score & Feedback */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Nilai / Skor Diperoleh
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={currentQuestion.maxScore}
                              step={0.5}
                              value={essayGrades[currentQuestion.examinationQuestionId]?.rawScore ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setEssayGrades((prev) => ({
                                  ...prev,
                                  [currentQuestion.examinationQuestionId]: {
                                    rawScore: val,
                                    feedback: prev[currentQuestion.examinationQuestionId]?.feedback || "",
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#65C443] transition"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Catatan Evaluasi Guru (Opsional)
                            </label>
                            <input
                              type="text"
                              placeholder="Misal: Penjelasan cukup lengkap dan tepat..."
                              value={essayGrades[currentQuestion.examinationQuestionId]?.feedback ?? ""}
                              onChange={(e) => {
                                const text = e.target.value;
                                setEssayGrades((prev) => ({
                                  ...prev,
                                  [currentQuestion.examinationQuestionId]: {
                                    rawScore: prev[currentQuestion.examinationQuestionId]?.rawScore ?? 0,
                                    feedback: text,
                                  },
                                }));
                              }}
                              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#65C443] transition"
                            />
                          </div>
                        </div>

                        {/* Save Single Question Grade Button */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEssayGrade(currentQuestion.examinationQuestionId)}
                            disabled={savingGrade}
                            className="px-4 py-2 rounded-xl bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{savingGrade ? "Menyimpan Nilai..." : "Simpan Penilaian Soal Ini"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Footer */}
                  <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Soal Sebelumnya</span>
                    </button>

                    <span className="text-xs font-medium text-slate-400">
                      Soal {currentIndex + 1} dari {displayedQuestions.length}
                    </span>

                    <button
                      type="button"
                      disabled={currentIndex === displayedQuestions.length - 1}
                      onClick={() => setCurrentIndex((prev) => Math.min(displayedQuestions.length - 1, prev + 1))}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span>Soal Berikutnya</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
                  Tidak ada soal pada kategori filter ini.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
