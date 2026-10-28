"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Send,
  CloudCheck,
  CloudUpload,
  BookOpen,
  FileText,
  KeyRound,
  Check,
  RotateCcw,
  Sparkles,
  Award,
  Lock,
  RefreshCw,
  Maximize,
  EyeOff,
  Camera,
  Copy,
} from "lucide-react";

interface QuestionOption {
  id: string;
  label: string;
  content: {
    text: string;
    imageUrl?: string;
  };
}

interface QuestionItem {
  examinationQuestionId: string;
  sequenceNumber: number;
  type: string;
  difficulty: string;
  points: number;
  isOptional: boolean;
  content: {
    text: string;
    instructions?: string;
    imageUrl?: string | null;
  };
  options: QuestionOption[];
}

interface StudentAnswerState {
  answerValue: any;
  answerSequence: number;
  isDoubtful: boolean;
}

export default function StudentExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params?.id as string;

  // Lifecycle states: 'loading' | 'pre_exam' | 'active_exam' | 'completed' | 'error'
  const [stage, setStage] = useState<"loading" | "pre_exam" | "active_exam" | "completed" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Exam and attempt data
  const [examData, setExamData] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerState>>({});

  // Pre-exam form
  const [tokenInput, setTokenInput] = useState<string>("");
  const [startingExam, setStartingExam] = useState<boolean>(false);
  const [rulesAcknowledged, setRulesAcknowledged] = useState<boolean>(false);

  // Auto-fill token from URL query params (e.g. from StudentTokenQuickLauncher)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const qToken = urlParams.get("token");
      if (qToken) {
        setTokenInput(qToken.trim().toUpperCase());
      }
    }
  }, []);

  // Timer state (seconds remaining)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const remainingSecondsRef = useRef<number>(0);
  remainingSecondsRef.current = remainingSeconds;
  const lastKnownDeadlineRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [timeExtendedToast, setTimeExtendedToast] = useState<string | null>(null);

  // Autosave status: 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Submit modal
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Anti-cheat & live proctoring state
  const [attemptStatus, setAttemptStatus] = useState<string>("not_started");
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [warningDetail, setWarningDetail] = useState<string | null>(null);
  const [screenshotToast, setScreenshotToast] = useState<string | null>(null);
  const [acknowledgingWarning, setAcknowledgingWarning] = useState<boolean>(false);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(true);
  const [studentInfo, setStudentInfo] = useState<{ username: string; displayName: string; nis: string | null } | null>(null);
  const lastTabEventRef = useRef<number>(0);
  const hasAcknowledgedWarningRef = useRef<boolean>(false);

  const examDataRef = useRef<any>(null);
  examDataRef.current = examData;

  // Request Fullscreen Helper
  const requestFullscreenMode = async () => {
    try {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn("Fullscreen request error:", err);
    }
  };

  // 1. Initial Load: Check if attempt already exists
  const loadExamState = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setStage("loading");
      }
      setErrorMessage(null);

      const res = await fetch(`/api/student/examinations/${examId}/attempt`);
      const json = await res.json();

      if (res.ok && json.success) {
        const { attempt, examination, student, questions: qList, answers: aList, result } = json.data;

        if (student) {
          setStudentInfo(student);
        }
        setExamData(examination);
        setQuestions(qList);
        setAttemptStatus(attempt.status);
        setIncidentCount(attempt.incidentCount || 0);
        if (attempt.deadlineAt) {
          lastKnownDeadlineRef.current = attempt.deadlineAt;
        }

        // Convert answers array to map
        const ansMap: Record<string, StudentAnswerState> = {};
        for (const a of aList) {
          ansMap[a.examinationQuestionId] = {
            answerValue: a.answerValue,
            answerSequence: a.answerSequence,
            isDoubtful: a.isDoubtful || false,
          };
        }
        setAnswers(ansMap);

        if (["submitted", "grading_pending", "completed", "expired"].includes(attempt.status)) {
          setSubmissionResult({
            status: attempt.status,
            result,
          });
          setStage("completed");
          return;
        }

        // Active exam: clear any old submission result
        setSubmissionResult(null);

        if (attempt.status === "blocked") {
          setIsBlocked(true);
          setRemainingSeconds(attempt.remainingSeconds || 0);
          setStage("active_exam");
          return;
        }

        if (attempt.status === "warning") {
          setIsBlocked(false);
          setShowWarningModal(true);
          setRemainingSeconds(attempt.remainingSeconds || 0);
          setStage("active_exam");
          return;
        }

        if (attempt.status === "in_progress") {
          setIsBlocked(false);
          setRemainingSeconds(attempt.remainingSeconds || 0);
          setStage("active_exam");
          return;
        }

        setStage("pre_exam");
      } else {
        if (isInitial) {
          // If 404: No attempt yet, load basic exam details
          const listRes = await fetch(`/api/student/examinations`);
          const listJson = await listRes.json();
          if (listRes.ok && listJson.success) {
            const currentExam = listJson.data.find((e: any) => e.id === examId);
            if (currentExam) {
              setExamData(currentExam);
              setStage("pre_exam");
              return;
            }
          }
          setErrorMessage(json.error || "Gagal memuat informasi ujian.");
          setStage("error");
        }
      }
    } catch (err: any) {
      console.error("Load exam state error:", err);
      if (isInitial) {
        setErrorMessage("Terjadi kesalahan koneksi saat memuat ujian.");
        setStage("error");
      }
    }
  }, [examId]);

  useEffect(() => {
    if (examId) {
      loadExamState(true);
    }
  }, [examId, loadExamState]);

  // Periodic check if teacher granted retake while student is on completed screen
  useEffect(() => {
    if (stage !== "completed" || !examId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/examinations/${examId}/attempt`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.attempt?.status === "in_progress") {
            loadExamState(false);
          }
        }
      } catch {
        // silent fail
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [stage, examId, loadExamState]);

  // 2. Countdown Timer
  useEffect(() => {
    if (stage !== "active_exam") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  // 3. Format Timer
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 4. Handle Starting Attempt
  const handleStartExam = async () => {
    try {
      setStartingExam(true);
      setErrorMessage(null);

      // Wajib Layar Penuh pada saat mulai ujian
      await requestFullscreenMode();

      const res = await fetch(`/api/student/examinations/${examId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memulai ujian.");
      }

      // Reload fresh attempt data
      await loadExamState();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memulai ujian.");
    } finally {
      setStartingExam(false);
    }
  };

  // 5. Autosave Answer Trigger
  const triggerAutosave = useCallback(
    async (qId: string, value: any, sequence: number, isDoubtful: boolean) => {
      try {
        setSaveStatus("saving");
        const res = await fetch(`/api/student/examinations/${examId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            examinationQuestionId: qId,
            answerValue: value,
            clientSequence: sequence,
            isDoubtful,
          }),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          setSaveStatus("saved");
          setAnswers((prev) => ({
            ...prev,
            [qId]: {
              answerValue: value,
              answerSequence: json.data.answerSequence,
              isDoubtful,
            },
          }));
        } else if (res.status === 403) {
          setIsBlocked(true);
          setAttemptStatus("blocked");
          setSaveStatus("error");
        } else if (res.status === 409) {
          // Stale sequence: Reload state
          setSaveStatus("error");
          await loadExamState();
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        console.error("Autosave error:", err);
        setSaveStatus("error");
      }
    },
    [examId, loadExamState]
  );

  // 6. Handle User Updating Answer in UI
  const handleAnswerChange = (newValue: any) => {
    if (isBlocked) return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const qId = currentQ.examinationQuestionId;
    const currentAns = answers[qId] || { answerValue: null, answerSequence: 0, isDoubtful: false };

    // Update local state immediately for snappy response
    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        ...currentAns,
        answerValue: newValue,
      },
    }));

    // Debounce backend save
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      triggerAutosave(qId, newValue, currentAns.answerSequence, currentAns.isDoubtful);
    }, 400);
  };

  // 7. Toggle Doubtful
  const handleToggleDoubtful = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const qId = currentQ.examinationQuestionId;
    const currentAns = answers[qId] || { answerValue: null, answerSequence: 0, isDoubtful: false };
    const newDoubtful = !currentAns.isDoubtful;

    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        ...currentAns,
        isDoubtful: newDoubtful,
      },
    }));

    triggerAutosave(qId, currentAns.answerValue, currentAns.answerSequence, newDoubtful);
  };

  // 8. Handle Final Submission
  const handleSubmitExam = async (reason: string = "manual_submit") => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/student/examinations/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal mengumpulkan ujian.");
      }

      setSubmissionResult(json.data);
      setShowSubmitModal(false);
      setStage("completed");
    } catch (err: any) {
      alert(err.message || "Gagal mengumpulkan ujian.");
    } finally {
      setSubmitting(false);
    }
  };

  // 9. Time Expired Auto-Submit
  const handleTimeExpired = () => {
    handleSubmitExam("time_expired");
  };

  // 10. Anti-Cheat Event Reporter
  const reportAntiCheatEvent = useCallback(
    async (eventType: string, metadata?: any, customReason?: string) => {
      if (stage !== "active_exam" || isBlocked || showWarningModal) return;
      hasAcknowledgedWarningRef.current = false;
      if (customReason) {
        setWarningDetail(customReason);
      }
      try {
        const clientEventId = crypto.randomUUID();
        const res = await fetch(`/api/student/examinations/${examId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            clientEventId,
            clientTimestamp: new Date().toISOString(),
            metadata,
          }),
        });

        const json = await res.json();
        if (res.status === 403 || json.status === "blocked" || json.data?.action === "blocked") {
          setIsBlocked(true);
          setAttemptStatus("blocked");
          setShowWarningModal(false);
        } else if (
          json.data?.action === "warning" ||
          json.data?.status === "warning" ||
          (json.data?.incidentCount && json.data.incidentCount > 0)
        ) {
          setShowWarningModal(true);
          setIncidentCount(json.data?.incidentCount || 1);
        }
      } catch (err) {
        console.error("Anti-cheat report error:", err);
      }
    },
    [examId, stage, isBlocked, showWarningModal]
  );

  // 11. Anti-Cheat Browser Event Listeners
  useEffect(() => {
    if (stage !== "active_exam" || isBlocked) return;

    // Check initial fullscreen state on entering active_exam
    const isFsInitial = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    setIsFullscreen(isFsInitial);

    const shouldDebounceTabSwitch = () => {
      const now = Date.now();
      if (now - lastTabEventRef.current < 1200) {
        return true;
      }
      lastTabEventRef.current = now;
      return false;
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
      if (showWarningModal || shouldDebounceTabSwitch()) return;
      reportAntiCheatEvent(
        "focus_loss",
        { reason: "window_blur" },
        "Fokus Jendela Lembar Ujian Terlepas / Berpindah Aplikasi"
      );
    };

    const handleFocus = () => {
      setIsWindowFocused(true);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        if (showWarningModal || shouldDebounceTabSwitch()) return;
        reportAntiCheatEvent(
          "visibility_change",
          { hidden: true },
          "Berpindah Tab Browser / Minimize Jendela Lembar Ujian"
        );
      } else {
        setIsWindowFocused(true);
      }
    };

    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs && stage === "active_exam" && !showWarningModal && !isBlocked) {
        reportAntiCheatEvent(
          "fullscreen_exit",
          { exit: true, isTabSwitchEquivalent: true },
          "Keluar dari Mode Layar Penuh (Full Screen) — Dianggap Setara Pindah Tab"
        );
      }
    };

    const handleBeforeUnload = () => {
      reportAntiCheatEvent("page_unload");
    };

    const handleOffline = () => {
      reportAntiCheatEvent("network_disconnect");
    };

    // Text selection prevention
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // Right-click context menu prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Copy / Cut / Paste event prevention
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      setScreenshotToast("Tindakan salin / tempel teks (Clipboard) dinonaktifkan.");
      setTimeout(() => setScreenshotToast(null), 3500);
      reportAntiCheatEvent(
        "clipboard_copy",
        { action: e.type },
        "Percobaan Menyalin atau Menempel Teks Lembar Soal"
      );
    };

    // Keyboard Shortcuts & Screenshot Detection
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // 1. Screenshot Detection:
      // - Standard PrintScreen key (Windows/Linux)
      // - Mac Screenshot shortcuts: Cmd + Shift + 3, Cmd + Shift + 4, Cmd + Shift + 5
      // - Windows Snipping Tool shortcut: Win + Shift + S
      if (
        e.key === "PrintScreen" ||
        e.keyCode === 44 ||
        (isCtrlOrCmd && e.shiftKey && ["3", "4", "5", "s"].includes(key))
      ) {
        e.preventDefault();
        // Clear clipboard so screenshot isn't retained
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
        setScreenshotToast("Peringatan: Screenshot Terdeteksi! Dilarang mendokumentasikan soal ujian.");
        setTimeout(() => setScreenshotToast(null), 4500);
        reportAntiCheatEvent(
          "screenshot_attempt",
          {
            key: e.key,
            shortcut: `${isCtrlOrCmd ? "Ctrl/Cmd+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key}`,
          },
          "Percobaan Pengambilan Tangkapan Layar (Screenshot) Terdeteksi"
        );
        return;
      }

      // 2. Block Copy, Cut, Paste, Select All, Print, Save, View Source
      if (isCtrlOrCmd && ["a", "c", "v", "x", "p", "s", "u"].includes(key)) {
        e.preventDefault();
        if (["c", "x", "v"].includes(key)) {
          setScreenshotToast("Pintasan papan klip (Copy/Paste) dinonaktifkan.");
          setTimeout(() => setScreenshotToast(null), 3000);
          reportAntiCheatEvent(
            "clipboard_copy",
            { key: e.key },
            "Percobaan Menyalin Teks melalui Pintasan Keyboard"
          );
        }
        return;
      }

      // 3. Block Developer Tools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (e.key === "F12" || (isCtrlOrCmd && e.shiftKey && ["i", "j", "c"].includes(key))) {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleClipboard as any);
    document.addEventListener("cut", handleClipboard as any);
    document.addEventListener("paste", handleClipboard as any);
    document.addEventListener("dragstart", handleSelectStart);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleClipboard as any);
      document.removeEventListener("cut", handleClipboard as any);
      document.removeEventListener("paste", handleClipboard as any);
      document.removeEventListener("dragstart", handleSelectStart);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [stage, isBlocked, reportAntiCheatEvent]);

  // 12. Periodic Heartbeat Loop
  useEffect(() => {
    if (stage !== "active_exam") return;

    // Use 5s heartbeat for snappy proctor actions (unlock, extend-time sync, online indicator)
    const intervalSeconds = 5;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/student/examinations/${examId}/heartbeat`, {
          method: "POST",
        });
        const json = await res.json();
        if (res.ok && json.success) {
          const remoteStatus = json.data.status;
          if (remoteStatus === "blocked") {
            setIsBlocked(true);
            setAttemptStatus("blocked");
            setShowWarningModal(false);
          } else if (remoteStatus === "warning") {
            // Only show warning if student hasn't acknowledged it yet
            if (!hasAcknowledgedWarningRef.current) {
              setShowWarningModal(true);
              setIncidentCount(json.data.incidentCount || 1);
            }
          } else if (remoteStatus === "in_progress") {
            setAttemptStatus("in_progress");
            if (isBlocked) {
              // Unlocked by proctor!
              setIsBlocked(false);
              await loadExamState(false);
            }
            // Server confirmed in_progress, reset flag so subsequent new warnings can show
            hasAcknowledgedWarningRef.current = false;
          }

          // Sync timer and detect proctor time extension
          if (typeof json.data.remainingSeconds === "number") {
            const serverRemaining = json.data.remainingSeconds;
            const serverDeadline = json.data.deadlineAt;

            // Detect if proctor extended the time
            if (
              serverDeadline &&
              lastKnownDeadlineRef.current &&
              new Date(serverDeadline).getTime() > new Date(lastKnownDeadlineRef.current).getTime()
            ) {
              const diffSecs = serverRemaining - remainingSecondsRef.current;
              const addedMinutes = Math.max(1, Math.round(diffSecs / 60));
              setTimeExtendedToast(
                `Waktu ujian Anda telah ditambah +${addedMinutes} menit oleh pengawas!`
              );
              setTimeout(() => setTimeExtendedToast(null), 8000);
            }

            if (serverDeadline) {
              lastKnownDeadlineRef.current = serverDeadline;
            }

            // If time was extended or client clock drifted (> 3 seconds), sync timer directly
            if (
              serverRemaining > remainingSecondsRef.current + 2 ||
              Math.abs(serverRemaining - remainingSecondsRef.current) > 3
            ) {
              setRemainingSeconds(serverRemaining);
            }
          }
        }
      } catch {
        // Network drop handled naturally
      }
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [stage, examId, isBlocked, loadExamState]);

  // 13. Acknowledge Warning Handler
  const handleAcknowledgeWarning = async () => {
    try {
      hasAcknowledgedWarningRef.current = true;
      setShowWarningModal(false);
      setWarningDetail(null);
      setAttemptStatus("in_progress");
      setAcknowledgingWarning(true);
      await fetch(`/api/student/examinations/${examId}/acknowledge-warning`, {
        method: "POST",
      });
      await requestFullscreenMode();
    } catch {
      await requestFullscreenMode();
    } finally {
      setAcknowledgingWarning(false);
    }
  };

  // 14. Check if Proctor Has Unlocked Session
  const handleCheckUnlock = async () => {
    try {
      const res = await fetch(`/api/student/examinations/${examId}/heartbeat`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.data?.status === "in_progress") {
        setIsBlocked(false);
        setAttemptStatus("in_progress");
        await loadExamState();
      }
    } catch {
      // ignore
    }
  };

  // Answer statistics
  const answeredCount = Object.values(answers).filter(
    (a) => a.answerValue !== null && a.answerValue !== undefined && a.answerValue !== ""
  ).length;
  const doubtfulCount = Object.values(answers).filter((a) => a.isDoubtful).length;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  // =========================================================================
  // RENDER STAGE 1: LOADING
  // =========================================================================
  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-[#65C443] animate-spin" />
        </div>
        <div className="text-slate-800 font-bold text-sm">Menyiapkan Lembar Ujian...</div>
        <p className="text-slate-500 text-xs mt-1">Sinkronisasi data peserta dan server timer.</p>
      </div>
    );
  }

  // =========================================================================
  // RENDER STAGE 2: ERROR
  // =========================================================================
  if (stage === "error") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Ujian Tidak Dapat Dimulai</h2>
            <p className="text-xs text-rose-600 mt-1">{errorMessage || "Data ujian tidak valid."}</p>
          </div>
          <Link
            href="/student"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda Siswa</span>
          </Link>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER STAGE 3: PRE-EXAM ACKNOWLEDGMENT
  // =========================================================================
  if (stage === "pre_exam") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-10 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-[#0D274C] p-6 text-white text-center space-y-1.5 relative overflow-hidden">
            <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-400 font-mono text-[10px] font-semibold tracking-wider uppercase border border-white/10">
              Konfirmasi Peserta CBT
            </span>
            <h1 className="text-lg sm:text-xl font-bold leading-snug">{examData?.title || "Ujian Komputer CBT"}</h1>
            <p className="text-xs text-slate-300">
              Mata Pelajaran: <strong className="text-white">{examData?.subjectName || "Umum"}</strong>
            </p>
          </div>

          <div className="p-6 space-y-5 text-xs">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2.5 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#65C443] shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Durasi Waktu</div>
                  <div className="font-bold text-slate-900 text-sm">{examData?.durationMinutes || 90} Menit</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-[#0D274C] shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">Jumlah Soal</div>
                  <div className="font-bold text-slate-900 text-sm">{examData?.totalQuestions || 0} Butir</div>
                </div>
              </div>
            </div>

            {/* Token Input if Required */}
            {examData?.tokenRequired && (
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-800 font-bold flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-700" />
                    <span>Masukkan Token Ujian *</span>
                  </label>
                  {tokenInput.trim() && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" /> Token Terisi
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: NEXAM123"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-center tracking-widest text-sm font-bold placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
                <span className="text-[11px] text-slate-500 block">
                  Mintalah token ujian kepada Pengawas Ruang sebelum menekan tombol Mulai.
                </span>
              </div>
            )}

            {/* Anti-cheat Policy reminder */}
            <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-slate-700">
              <div className="font-bold text-amber-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Tata Tertib & Integritas Ujian</span>
              </div>
              <ul className="list-disc pl-6 sm:pl-7 space-y-2 text-slate-700 text-xs leading-relaxed marker:text-amber-600">
                <li>Waktu ujian diatur langsung oleh server dan tidak dapat dijeda.</li>
                <li>Dilarang berpindah tab peramban atau membuka aplikasi lain selama ujian.</li>
                <li>Jawaban tersimpan otomatis secara berkala (Auto-save).</li>
                <li>Pastikan menekan tombol Kumpulkan setelah selesai memeriksa semua jawaban.</li>
              </ul>
            </div>

            {/* Checkbox Acknowledgment */}
            <label className="flex items-start gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={rulesAcknowledged}
                onChange={(e) => setRulesAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#65C443] focus:ring-[#65C443] w-4 h-4 cursor-pointer"
              />
              <span className="text-slate-700 leading-snug">
                Saya telah membaca tata tertib ujian di atas dan siap mengerjakan ujian dengan jujur.
              </span>
            </label>

            {/* Schedule Notice if not yet open */}
            {examData?.status === "scheduled" && new Date() < new Date(examData.scheduledStart) && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Ujian belum dapat dimulai. Pelaksanaan ujian dijadwalkan pada{" "}
                  <strong>
                    {new Date(examData.scheduledStart).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    WIB
                  </strong>
                  .
                </span>
              </div>
            )}

            {/* Expired / Closed Notice if scheduledEnd has passed */}
            {Boolean(examData?.status === "closed" || (examData?.scheduledEnd && new Date() > new Date(examData.scheduledEnd))) && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Jadwal pengerjaan ujian ini telah berakhir dan ujian telah ditutup secara otomatis oleh sistem. Anda tidak dapat memulai ujian ini.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <Link
                href="/student"
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
              >
                Kembali
              </Link>
              <button
                type="button"
                onClick={handleStartExam}
                disabled={
                  !rulesAcknowledged ||
                  startingExam ||
                  (examData?.tokenRequired && !tokenInput.trim()) ||
                  (examData?.status === "scheduled" && new Date() < new Date(examData.scheduledStart)) ||
                  Boolean(examData?.status === "closed" || (examData?.scheduledEnd && new Date() > new Date(examData.scheduledEnd)))
                }
                className="px-6 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#52a835] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition cursor-pointer shadow-sm flex items-center gap-2"
              >
                {startingExam ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Menyiapkan Lembar...</span>
                  </>
                ) : Boolean(examData?.status === "closed" || (examData?.scheduledEnd && new Date() > new Date(examData.scheduledEnd))) ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Jadwal Ujian Telah Ditutup</span>
                  </>
                ) : examData?.status === "scheduled" && new Date() < new Date(examData.scheduledStart) ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Belum Waktunya Mulai</span>
                  </>
                ) : (
                  <>
                    <span>Mulai Kerjakan Ujian</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER STAGE 4: COMPLETED / SUBMITTED
  // =========================================================================
  if (stage === "completed") {
    const isPending =
      submissionResult?.status === "grading_pending" ||
      submissionResult?.hasPendingEssay ||
      Boolean(submissionResult?.result?.isProvisional);
    const resultData = submissionResult?.result;
    const passingScore = Number(examData?.passingScore) || 75;
    const percentage = resultData?.percentage !== undefined && resultData?.percentage !== null ? Number(resultData.percentage) : null;
    const isPassed = percentage !== null && percentage >= passingScore;

    return (
      <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-8 text-center space-y-6">
          <div
            className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto shadow-xs border ${
              isPending
                ? "bg-amber-50 border-amber-200 text-amber-600"
                : "bg-emerald-50 border-emerald-200 text-[#65C443]"
            }`}
          >
            {isPending ? <Clock className="w-8 h-8" /> : <Award className="w-8 h-8" />}
          </div>

          <div>
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 border ${
                isPending
                  ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {isPending ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dalam Penilaian Guru</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nilai Telah Diterbitkan</span>
                </>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              {isPending ? "Lembar Jawaban Dikumpulkan" : "Hasil Penilaian Ujian"}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {examData?.title || "Ujian CBT"} • {examData?.subjectName}
            </p>
          </div>

          {/* Graded Result Box */}
          {resultData && !isPending && (
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-[11px] text-slate-500 font-semibold uppercase">Nilai Akhir Ujian</div>
              <div className="text-4xl font-extrabold text-slate-900 font-mono">
                {percentage !== null ? `${percentage}%` : "-"}
              </div>
              <div className="text-xs text-slate-600 font-medium">
                Skor Perolehan: <strong>{resultData.totalScore}</strong> dari {resultData.maxScore} Poin
              </div>

              {resultData.modificationReason && (
                <div className="p-2 rounded-lg bg-emerald-50 text-[11px] text-emerald-800 font-semibold flex items-center justify-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Nilai disesuaikan ({resultData.modificationReason})</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-center gap-2">
                {percentage !== null ? (
                  isPassed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>LULUS (KKM {passingScore}%)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>REMEDIAL (KKM {passingScore}%)</span>
                    </span>
                  )
                ) : null}
              </div>
            </div>
          )}

          {/* Pending Grading Notice Box */}
          {isPending && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-left space-y-2 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Pemeriksaan Esai Sedang Berlangsung</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Jawaban esai/uraian Anda sedang menunggu pemeriksaan manual oleh Guru Pengampu. Nilai akhir resmi akan
                diterbitkan setelah seluruh butir esai selesai dinilai.
              </p>
              {resultData?.objectiveScore !== null && resultData?.objectiveScore !== undefined && (
                <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900 font-medium flex items-center justify-between">
                  <span>Skor Objektif Sementara:</span>
                  <span className="font-mono font-bold">{Number(resultData.objectiveScore)} Poin</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100">
            <Link
              href="/student"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D274C] hover:bg-[#163866] text-white font-medium text-xs transition cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Beranda Siswa</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER STAGE 5: ACTIVE EXAM TAKING VIEW
  // =========================================================================
  const currentAnswerState = currentQuestion
    ? answers[currentQuestion.examinationQuestionId]
    : undefined;
  const currentAnswerValue = currentAnswerState?.answerValue;
  const isCurrentDoubtful = currentAnswerState?.isDoubtful || false;

  const isTimerCritical = remainingSeconds <= 120; // 2 minutes
  const isTimerWarning = remainingSeconds <= 600; // 10 minutes

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] flex flex-col select-none relative"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {/* FLOATING SECURITY TOAST */}
      {screenshotToast && (
        <div className="fixed top-20 right-6 z-[120] max-w-sm bg-rose-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-200 border border-rose-400">
          <ShieldAlert className="w-5 h-5 shrink-0 text-white" />
          <span className="text-xs font-semibold">{screenshotToast}</span>
        </div>
      )}

      {/* FLOATING TIME EXTENSION TOAST */}
      {timeExtendedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[130] max-w-lg w-[92%] sm:w-auto bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300 border border-emerald-400">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-white animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Kompensasi Waktu</div>
            <div className="text-xs font-semibold text-white">{timeExtendedToast}</div>
          </div>
        </div>
      )}

      {/* 1. TOP STICKY HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0D274C] flex items-center justify-center text-white shrink-0 font-bold text-xs">
              CBT
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {examData?.title || "Ujian CBT"}
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {examData?.subjectName} • Soal {currentIndex + 1} dari {totalQuestions}
              </p>
            </div>
          </div>

          {/* Right controls: Autosave, Timer, and Submit button */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Autosave Status Pill */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              {saveStatus === "saving" ? (
                <>
                  <CloudUpload className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span className="text-[11px] text-amber-700">Menyimpan...</span>
                </>
              ) : saveStatus === "error" ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] text-rose-700">Gagal Simpan</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] text-slate-600">Tersimpan</span>
                </>
              )}
            </div>

            {/* Countdown Timer */}
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono font-bold text-xs sm:text-sm shadow-xs transition-colors ${
                isTimerCritical
                  ? "bg-rose-50 border-rose-300 text-rose-700 animate-pulse"
                  : isTimerWarning
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              <Clock className="w-4 h-4 shrink-0 text-[#65C443]" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="px-3.5 sm:px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-[#65C443]" />
              <span className="hidden sm:inline">Selesai Ujian</span>
              <span className="sm:hidden">Selesai</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN BODY: 80/20 RATIO LAYOUT (KANAN-KIRI) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-start">
        {/* LEFT COLUMN: ACTIVE QUESTION CARD (80%) */}
        <section className="w-full md:w-[78%] lg:w-[80%] min-w-0 space-y-4">
          {currentQuestion ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-7 flex flex-col justify-between min-h-[500px] relative overflow-hidden">
              {/* Forensic Anti-Leak Dynamic Watermark */}
              <div
                className="pointer-events-none absolute inset-0 z-0 opacity-[0.045] select-none flex flex-wrap gap-12 items-center justify-center p-4 overflow-hidden rotate-[-15deg]"
                aria-hidden="true"
              >
                {Array.from({ length: 15 }).map((_, idx) => (
                  <div key={idx} className="text-xs font-mono font-bold text-slate-900 whitespace-nowrap">
                    {studentInfo?.displayName || studentInfo?.username || "Siswa"} • {studentInfo?.nis ? `NIS:${studentInfo.nis}` : studentInfo?.username || ""} • {examData?.title || "Nexam CBT"}
                  </div>
                ))}
              </div>

              <div className="space-y-5 relative z-10">
                {/* Question Metadata Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0D274C] text-white font-bold font-mono text-xs">
                      No. {currentIndex + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] uppercase font-semibold border border-slate-200">
                      {currentQuestion.type.replace("_", " ")}
                    </span>
                  </div>

                  {isCurrentDoubtful && (
                    <span className="px-2.5 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-semibold flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-orange-600" />
                      <span>Ragu-ragu</span>
                    </span>
                  )}
                </div>

                {/* Optional Media Image */}
                {currentQuestion.content.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-200 max-h-72 flex items-center justify-center bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentQuestion.content.imageUrl}
                      alt="Ilustrasi Soal"
                      className="max-h-72 w-auto object-contain"
                    />
                  </div>
                )}

                {/* Question Prompt */}
                <div className="text-slate-900 text-sm sm:text-base leading-relaxed font-normal whitespace-pre-wrap">
                  {currentQuestion.content.text}
                </div>

                {/* Optional Instructions */}
                {currentQuestion.content.instructions && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs italic">
                    {currentQuestion.content.instructions}
                  </div>
                )}

                {/* QUESTION INPUTS BASED ON TYPE */}
                <div className="pt-2">
                  {/* TYPE 1: SINGLE CHOICE */}
                  {currentQuestion.type === "single_choice" && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((opt) => {
                        const isSelected =
                          currentAnswerValue === opt.id || currentAnswerValue === opt.label;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleAnswerChange(opt.id)}
                            className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer text-xs sm:text-sm ${
                              isSelected
                                ? "bg-emerald-50/50 border-[#65C443] text-slate-900 shadow-xs ring-1 ring-[#65C443]"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-0.5 ${
                                isSelected
                                  ? "bg-[#65C443] text-white"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {opt.label}
                            </span>
                            <div className="flex-1 pt-0.5 leading-relaxed">
                              {opt.content.text}
                              {opt.content.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={opt.content.imageUrl}
                                  alt="Opsi"
                                  className="mt-2 max-h-40 rounded-lg border border-slate-200"
                                />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* TYPE 2: MULTI SELECT */}
                  {currentQuestion.type === "multi_select" && (
                    <div className="space-y-2.5">
                      <div className="text-[11px] text-slate-500 mb-1">
                        * Pilihlah satu atau lebih jawaban yang menurut Anda benar.
                      </div>
                      {currentQuestion.options.map((opt) => {
                        const currentArr: string[] = Array.isArray(currentAnswerValue)
                          ? currentAnswerValue
                          : [];
                        const isSelected = currentArr.includes(opt.id) || currentArr.includes(opt.label);

                        const toggleSelect = () => {
                          let nextArr: string[];
                          if (isSelected) {
                            nextArr = currentArr.filter((x) => x !== opt.id && x !== opt.label);
                          } else {
                            nextArr = [...currentArr, opt.id];
                          }
                          handleAnswerChange(nextArr);
                        };

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={toggleSelect}
                            className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer text-xs sm:text-sm ${
                              isSelected
                                ? "bg-emerald-50/50 border-[#65C443] text-slate-900 shadow-xs ring-1 ring-[#65C443]"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${
                                isSelected
                                  ? "bg-[#65C443] border-[#65C443] text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="font-mono font-bold text-xs shrink-0 mt-0.5 text-slate-800">
                              {opt.label}.
                            </span>
                            <div className="flex-1 pt-0.5 leading-relaxed">{opt.content.text}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* TYPE 3: TRUE / FALSE */}
                  {currentQuestion.type === "true_false" && (
                    <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
                      {["Benar", "Salah"].map((val) => {
                        const isSelected = String(currentAnswerValue).toLowerCase() === val.toLowerCase();
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleAnswerChange(val)}
                            className={`p-4 rounded-xl border text-center font-bold text-sm sm:text-base transition cursor-pointer flex items-center justify-center gap-2 ${
                              isSelected
                                ? val === "Benar"
                                  ? "bg-emerald-50 border-[#65C443] text-emerald-800 ring-1 ring-[#65C443] shadow-xs"
                                  : "bg-rose-50 border-rose-400 text-rose-800 ring-1 ring-rose-400 shadow-xs"
                                : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <CheckCircle2
                              className={`w-4 h-4 ${
                                isSelected
                                  ? val === "Benar"
                                    ? "text-emerald-700"
                                    : "text-rose-600"
                                  : "text-slate-400"
                              }`}
                            />
                            <span>{val}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* TYPE 4: SHORT ANSWER */}
                  {currentQuestion.type === "short_answer" && (
                    <div className="space-y-2 pt-1 max-w-lg">
                      <label className="block text-xs font-semibold text-slate-700">
                        Tuliskan jawaban singkat Anda:
                      </label>
                      <input
                        type="text"
                        value={currentAnswerValue || ""}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder="Ketik jawaban di sini..."
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                      <span className="text-[11px] text-slate-500 block">
                        Pastikan ejaan kata tepat sesuai materi yang telah dipelajari.
                      </span>
                    </div>
                  )}

                  {/* TYPE 5: ESSAY */}
                  {currentQuestion.type === "essay" && (
                    <div className="space-y-2 pt-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Uraikan jawaban lengkap Anda:
                      </label>
                      <textarea
                        rows={6}
                        value={currentAnswerValue || ""}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        placeholder="Tuliskan uraian atau penjelasan Anda di sini..."
                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm leading-relaxed placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Gunakan tanda baca dan paragraf yang rapi untuk mempermudah penilaian guru.</span>
                        <span>{String(currentAnswerValue || "").length} Karakter</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER NAVIGATION */}
              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Sebelumnya</span>
                </button>

                {/* Doubtful toggle */}
                <button
                  type="button"
                  onClick={handleToggleDoubtful}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                    isCurrentDoubtful
                      ? "bg-orange-500 hover:bg-orange-600 border-orange-600 text-white shadow-xs"
                      : "bg-slate-50 hover:bg-orange-50/50 border-slate-200 text-slate-600 hover:text-orange-700"
                  }`}
                >
                  <HelpCircle className={`w-4 h-4 ${isCurrentDoubtful ? "text-white" : "text-orange-500"}`} />
                  <span>Ragu-ragu</span>
                </button>

                {currentIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                    className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#52a835] text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <span>Selanjutnya</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(true)}
                    className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Send className="w-4 h-4 text-[#65C443]" />
                    <span>Selesai & Kumpulkan</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
              Tidak ada butir soal yang dimuat.
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: QUESTION PALETTE GRID (20% KANAN) */}
        <aside className="w-full md:w-[22%] lg:w-[20%] shrink-0 space-y-4 sticky top-20">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#0D274C]" />
                <span>Navigasi Soal</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-500 font-bold">
                {answeredCount}/{totalQuestions}
              </span>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[10px] text-slate-600">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-slate-600 shrink-0" />
                <span>Aktif</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#65C443] shrink-0" />
                <span>Terjawab</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-orange-500 shrink-0" />
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-white border border-slate-300 shrink-0" />
                <span>Belum</span>
              </div>
            </div>

            {/* Grid Palette */}
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-4 gap-1.5 max-h-[380px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const ans = answers[q.examinationQuestionId];
                const hasValue =
                  ans?.answerValue !== null && ans?.answerValue !== undefined && ans?.answerValue !== "";
                const isDoubt = ans?.isDoubtful || false;
                const isCurrent = idx === currentIndex;

                let btnStyle = "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";

                if (isCurrent) {
                  // Soal yang sedang aktif dibuka: darkened / greyish elegan
                  btnStyle = "bg-slate-600 border-slate-700 text-white font-black shadow-inner ring-2 ring-[#0D274C] ring-offset-1";
                } else if (isDoubt) {
                  // Setelah pindah soal, jika ragu-ragu: oranye
                  btnStyle = "bg-orange-500 border-orange-600 text-white font-bold hover:bg-orange-600";
                } else if (hasValue) {
                  // Setelah pindah soal, jika terjawab: hijau
                  btnStyle = "bg-[#65C443] border-[#65C443] text-white font-bold hover:bg-[#57b237]";
                }

                return (
                  <button
                    key={q.examinationQuestionId}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg border font-mono text-xs flex items-center justify-center transition cursor-pointer relative ${btnStyle}`}
                  >
                    <span>{idx + 1}</span>
                  </button>
                );
              })}
            </div>

            {/* Progress summary bar */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Kelengkapan:</span>
                <span className="font-bold text-slate-800">
                  {totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#65C443] transition-all duration-300"
                  style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* 3. SUBMISSION CONFIRMATION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-[#0D274C]">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Konfirmasi Pengumpulan Lembar Ujian</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin mengakhiri dan mengumpulkan jawaban ujian ini sekarang?
              </p>
            </div>

            {/* Summary statistics */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Terjawab</div>
                <div className="text-base font-bold text-emerald-700">{answeredCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Belum Dijawab</div>
                <div className="text-base font-bold text-rose-600">{totalQuestions - answeredCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Ragu-ragu</div>
                <div className="text-base font-bold text-orange-600">{doubtfulCount}</div>
              </div>
            </div>

            {totalQuestions - answeredCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Masih terdapat <strong>{totalQuestions - answeredCount} butir soal</strong> yang belum Anda jawab.
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
              >
                Lanjutkan Mengerjakan
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitExam("manual_submit")}
                className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#52a835] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                {submitting ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengumpulkan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Ya, Kumpulkan Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MANDATORY FULLSCREEN GATEKEEPER OVERLAY */}
      {!isFullscreen && !isBlocked && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0D274C]/10 border border-[#0D274C]/20 flex items-center justify-center mx-auto text-[#0D274C]">
              <Maximize className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-900 text-base">Wajib Mode Layar Penuh</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ujian ini wajib dikerjakan dalam mode <strong>Layar Penuh (Full Screen)</strong>. Keluar dari mode layar penuh akan dicatat sebagai pelanggaran oleh pengawas (setara pindah tab).
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 text-left">
              ⚠️ Anda harus berada dalam mode layar penuh untuk dapat membaca soal dan memberikan jawaban.
            </div>
            <button
              type="button"
              onClick={requestFullscreenMode}
              className="w-full px-5 py-3 rounded-xl bg-[#0D274C] hover:bg-[#153e77] text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Maximize className="w-4 h-4" />
              <span>Aktifkan Layar Penuh & Lanjutkan</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. PRIVACY SCREEN (Anti-Snipping & Window Blur Protection) */}
      {!isWindowFocused && !showWarningModal && !isBlocked && (
        <div
          onClick={() => {
            window.focus();
            setIsWindowFocused(true);
          }}
          className="fixed inset-0 z-[90] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white cursor-pointer select-none"
        >
          <EyeOff className="w-14 h-14 text-rose-500 mb-4 animate-pulse" />
          <h3 className="text-lg font-bold text-white mb-2">Layar Disembunyikan (Aplikasi Tidak Aktif)</h3>
          <p className="text-xs text-slate-300 max-w-md leading-relaxed mb-6">
            Fokus jendela lembar ujian terlepas atau aplikasi luar/tangkapan layar dibuka. Tampilan soal disembunyikan otomatis untuk menjaga kerahasiaan soal ujian.
          </p>
          <div className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition">
            Klik di sini untuk mengaktifkan kembali lembar ujian
          </div>
        </div>
      )}

      {/* 6. ANTI-CHEAT WARNING OVERLAY (Neutral, Non-Accusatory per PRD §17) */}
      {showWarningModal && !isBlocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-amber-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Pemberitahuan Sistem Integritas</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {warningDetail || "Perubahan fokus jendela aplikasi atau aktivitas di luar browser terdeteksi oleh sistem pengawasan."}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Insiden Tercatat:</span>
                <span className="font-bold text-amber-700">
                  {incidentCount} dari {examData?.policySettings?.blockThreshold || 3} kali toleransi
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Harap tetap berada pada jendela lembar ujian ini dalam mode layar penuh. Jika batas toleransi tercapai, sesi ujian akan ditangguhkan untuk ditinjau oleh pengawas.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={acknowledgingWarning}
                onClick={handleAcknowledgeWarning}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>{acknowledgingWarning ? "Menyimpan..." : "Saya Mengerti dan Kembali ke Layar Penuh"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ANTI-CHEAT BLOCKED OVERLAY */}
      {isBlocked && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-2xl border border-rose-200 shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-900 text-base">Sesi Ujian Ditangguhkan Sementara</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Akses pengerjaan ujian Anda saat ini dikunci karena batas toleransi integritas tercapai atau penangguhan oleh pengawas.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left space-y-2">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#0D274C]" />
                Petunjuk Peserta:
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
                <li>Angkat tangan dan beri tahu guru pengawas di ruangan Anda.</li>
                <li>Pengawas akan meninjau catatan sistem dan dapat membuka kembali kunci sesi Anda.</li>
                <li>Jawaban yang telah Anda simpan sebelumnya tetap tersimpan aman.</li>
              </ul>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleCheckUnlock}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cek Status Pembukaan Kunci</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
