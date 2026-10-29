"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Upload,
  Calendar,
  Clock,
  ShieldAlert,
  Users,
  ChevronRight,
  Trash2,
  Edit,
  Eye,
  Layers,
  Sparkles,
  Check,
  X,
  FileText,
  CheckSquare,
  AlignLeft,
  FolderArchive,
  ImageIcon,
  RotateCcw,
  Award,
  PlayCircle,
  KeyRound,
  Copy,
  Activity,
  PieChart,
  Radio,
  AlertTriangle,
  Tag,
} from "lucide-react";

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface QuestionCategory {
  id: string;
  name: string;
  subjectId?: string | null;
}

interface QuestionOption {
  id?: string;
  label: string;
  text: string;
  imageUrl?: string;
  isCorrect: boolean;
  sortOrder?: number;
}

interface Question {
  id: string;
  type: string;
  difficulty: string;
  status: string;
  subjectId?: string | null;
  categoryId?: string | null;
  subject?: Subject;
  category?: QuestionCategory;
  versions: Array<{
    id: string;
    versionNumber: number;
    content: {
      text: string;
      instructions?: string;
      rubric?: string;
      imageUrl?: string;
    };
    gradingConfig: {
      points: number;
      answerKey?: any;
      acceptableAnswers?: string[];
    };
    explanation?: string;
    options: Array<{
      id: string;
      label: string;
      content: { text: string; imageUrl?: string };
      isCorrect: boolean;
    }>;
  }>;
}

interface Examination {
  id: string;
  title: string;
  description?: string;
  subjectId?: string | null;
  academicYearId: string;
  semesterId: string;
  durationMinutes: number;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  totalPoints: number;
  passingScore?: number;
  subject?: Subject;
  examinationType?: { id: string; name: string; code: string } | null;
  examinationTypeId?: string | null;
  session?: { id: string; name: string; code: string; startTime?: string; endTime?: string } | null;
  sessionId?: string | null;
  policySettings?: {
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
    maxTabSwitches: number;
    fullScreenRequired: boolean;
    blockOnViolation: boolean;
    tokenRequired: boolean;
    globalToken?: string;
  };
  participants?: Array<{
    classGroupId?: string | null;
    classGroup?: { id: string; name: string; gradeLevel?: number | null } | null;
  }>;
  attempts?: Array<{
    id: string;
    status: string;
    incidentCount?: number;
  }>;
  _count?: {
    questions: number;
    participants: number;
  };
}

interface TeacherExaminationPanelProps {
  subjects: Subject[];
  academicYears: Array<{ id: string; name: string; status?: string }>;
  semesters: Array<{ id: string; name: string; status?: string; academicYearId?: string }>;
  classGroups?: Array<any>;
  classes?: Array<any>;
  activeYearId?: string | null;
  assignments?: any[];
  currentTeacherId?: string;
  activeYearName?: string | null;
  userRoles?: string[];
  teachers?: Array<{ id: string; name?: string; username?: string; displayName?: string | null; email?: string; nip?: string | null }>;
  viewMode?: "schedule" | "monitoring" | "results" | "analysis" | "grades";
}

const QUESTION_TYPES = [
  { id: "single_choice", label: "Pilihan Ganda Tunggal", icon: CheckCircle2, badge: "PG Tunggal" },
  { id: "multi_select", label: "Pilihan Ganda Kompleks", icon: CheckSquare, badge: "PG Kompleks" },
  { id: "true_false", label: "Benar / Salah", icon: HelpCircle, badge: "Benar/Salah" },
  { id: "short_answer", label: "Isian Singkat", icon: AlignLeft, badge: "Isian Singkat" },
  { id: "essay", label: "Uraian / Esai", icon: FileText, badge: "Uraian / Esai" },
  { id: "image_based", label: "Berbasis Gambar", icon: ImageIcon, badge: "Gambar" },
];

export default function TeacherExaminationPanel({
  subjects,
  academicYears,
  semesters,
  classGroups = [],
  classes = [],
  activeYearId,
  assignments = [],
  currentTeacherId,
  activeYearName,
  userRoles = [],
  teachers = [],
  viewMode = "schedule",
}: TeacherExaminationPanelProps) {
  const availableClasses = (classGroups && classGroups.length > 0) ? classGroups : (classes || []);
  const isAdmin = userRoles.includes("administrator");
  const [activeTab, setActiveTab] = useState<"questions" | "examinations">("examinations");
  const [activeTeacherTab, setActiveTeacherTab] = useState<"examinations" | "classes">("examinations");

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionSearch, setQuestionSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");

  // Question Modal State
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [qType, setQType] = useState("single_choice");
  const [qSubjectId, setQSubjectId] = useState(subjects[0]?.id || "");
  const [qCategoryId, setQCategoryId] = useState("");
  const [qDifficulty, setQDifficulty] = useState("medium");
  const [qPoints, setQPoints] = useState(1);
  const [qText, setQText] = useState("");
  const [qInstructions, setQInstructions] = useState("");
  const [qRubric, setQRubric] = useState("");
  const [qImageUrl, setQImageUrl] = useState("");
  const [qExplanation, setQExplanation] = useState("");
  const [qShortAnswerKey, setQShortAnswerKey] = useState("");
  const [qOptions, setQOptions] = useState<QuestionOption[]>([
    { label: "A", text: "", isCorrect: true },
    { label: "B", text: "", isCorrect: false },
    { label: "C", text: "", isCorrect: false },
    { label: "D", text: "", isCorrect: false },
  ]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSubjectId, setNewCatSubjectId] = useState(subjects[0]?.id || "");

  // Examinations State
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [loadingExams, setLoadingLoadingExams] = useState(false);
  const [showExamWizard, setShowExamWizard] = useState(false);
  const [examCategoryFilter, setExamCategoryFilter] = useState<"all" | "in_progress" | "upcoming" | "closed" | "draft">("all");
  const [examSearchFilter, setExamSearchFilter] = useState("");
  const [examSubjectFilter, setExamSubjectFilter] = useState("all");
  const [examClassFilter, setExamClassFilter] = useState("all");
  const [examTypeFilter, setExamTypeFilter] = useState("all");

  // Exam Wizard Form State
  const [examTitle, setExamTitle] = useState("");
  const [examDesc, setExamDesc] = useState("");
  const [examSubjectId, setExamSubjectId] = useState(subjects[0]?.id || "");
  const [examTeacherId, setExamTeacherId] = useState(currentTeacherId || "");
  const [teacherOptions, setTeacherOptions] = useState<any[]>(teachers || []);
  const [examYearId, setExamYearId] = useState(activeYearId || academicYears[0]?.id || "");
  const [examSemesterId, setExamSemesterId] = useState("");
  const [examDuration, setExamDuration] = useState(90);
  const [examPassingScore, setExamPassingScore] = useState(75);
  const [examScheduledStart, setExamScheduledStart] = useState("");
  const [examScheduledEnd, setExamScheduledEnd] = useState("");
  // Examination Type & Question Bank Selection
  const [examinationTypes, setExaminationTypes] = useState<any[]>([]);
  const [examTypeId, setExamTypeId] = useState<string>("");
  const [examBankId, setExamBankId] = useState<string>("");
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  // Policy settings
  const [polRandomizeQ, setPolRandomizeQ] = useState(true);
  const [polRandomizeOpt, setPolRandomizeOpt] = useState(true);
  const [polMaxTabSwitches, setPolMaxTabSwitches] = useState(3);
  const [polFullScreen, setPolFullScreen] = useState(true);
  const [polBlockViolation, setPolBlockViolation] = useState(true);
  const [polTokenReq, setPolTokenReq] = useState(false);
  const [polGlobalToken, setPolGlobalToken] = useState("");
  const [wizardSelectedClassIds, setWizardSelectedClassIds] = useState<string[]>([]);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Load available examination types
  useEffect(() => {
    fetch("/api/examinations/types")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setExaminationTypes(json.data);
        }
      })
      .catch((err) => console.error("Gagal memuat tipe ujian:", err));
  }, []);

  // Load question banks when subject changes
  useEffect(() => {
    if (examSubjectId) {
      setLoadingBanks(true);
      fetch(`/api/question-banks?subjectId=${examSubjectId}`)
        .then((res) => res.json())
        .then((json) => {
          const list = Array.isArray(json) ? json : (json.data || []);
          setAvailableBanks(list);
        })
        .catch(() => setAvailableBanks([]))
        .finally(() => setLoadingBanks(false));
    } else {
      setAvailableBanks([]);
    }
  }, [examSubjectId]);

  // Adjust default category filter based on viewMode
  useEffect(() => {
    if (viewMode === "monitoring") {
      setExamCategoryFilter("in_progress");
    } else if (viewMode === "results") {
      setExamCategoryFilter("closed");
    } else if (viewMode === "schedule") {
      setExamCategoryFilter("all");
    }
  }, [viewMode]);

  const generateRandomToken = (len = 6) => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let res = "";
    for (let i = 0; i < len; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const handleCopyToken = (token: string, examId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(examId);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  // Exam Assign Questions State
  const [managingExamQuestions, setManagingExamQuestions] = useState<Examination | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [savingExamQuestions, setSavingExamQuestions] = useState(false);
  const [examModalGradeFilter, setExamModalGradeFilter] = useState<number | "all">("all");
  const [examModalBankFilter, setExamModalBankFilter] = useState("all");
  const [examModalBanks, setExamModalBanks] = useState<any[]>([]);
  const [subjectQuestions, setSubjectQuestions] = useState<Question[]>([]);
  const [loadingSubjectQuestions, setLoadingSubjectQuestions] = useState(false);

  // Exam Assign Classes State
  const [managingExamParticipants, setManagingExamParticipants] = useState<Examination | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [savingParticipants, setSavingParticipants] = useState(false);

  const [wizardSaving, setWizardSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load questions
  const loadQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject !== "all") params.append("subjectId", filterSubject);
      if (filterType !== "all") params.append("type", filterType);
      if (filterDifficulty !== "all") params.append("difficulty", filterDifficulty);
      if (questionSearch) params.append("search", questionSearch);

      const res = await fetch(`/api/questions?${params.toString()}`);
      const json = await res.json();
      if (json.success) setQuestions(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Load categories
  const loadCategories = async () => {
    try {
      const res = await fetch("/api/questions/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load examinations
  const loadExaminations = async (isBackground = false) => {
    if (!isBackground) setLoadingLoadingExams(true);
    try {
      const res = await fetch("/api/examinations");
      const json = await res.json();
      if (json.success) setExaminations(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!isBackground) setLoadingLoadingExams(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    loadCategories();
    loadExaminations();
  }, [filterSubject, filterType, filterDifficulty]);

  // Periodic polling so exams auto-start seamlessly when schedule period arrives
  useEffect(() => {
    const timer = setInterval(() => {
      loadExaminations(true);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (teachers && teachers.length > 0) {
      setTeacherOptions(teachers);
    } else if (isAdmin) {
      fetch("/api/users?role=teacher&limit=100")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            setTeacherOptions(res.data);
          }
        })
        .catch((err) => console.error(err));
    }
  }, [isAdmin, teachers]);

  // Global ESC listener to close active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showQuestionModal) {
          setShowQuestionModal(false);
          return;
        }
        if (showExamWizard) {
          setShowExamWizard(false);
          return;
        }
        if (managingExamQuestions) {
          setManagingExamQuestions(null);
          return;
        }
        if (managingExamParticipants) {
          setManagingExamParticipants(null);
          return;
        }
        if (showCategoryModal) {
          setShowCategoryModal(false);
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showQuestionModal,
    showExamWizard,
    managingExamQuestions,
    managingExamParticipants,
    showCategoryModal,
  ]);

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setQImageUrl(json.data.url);
      } else {
        alert(json.error || "Gagal mengunggah gambar");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengunggah gambar");
    } finally {
      setUploadingImage(false);
    }
  };

  // Setup options when question type changes
  const handleTypeChange = (newType: string) => {
    setQType(newType);
    if (newType === "true_false") {
      setQOptions([
        { label: "A", text: "Benar", isCorrect: true },
        { label: "B", text: "Salah", isCorrect: false },
      ]);
    } else if (newType === "single_choice" || newType === "multi_select" || newType === "image_based") {
      if (qOptions.length < 2) {
        setQOptions([
          { label: "A", text: "", isCorrect: true },
          { label: "B", text: "", isCorrect: false },
          { label: "C", text: "", isCorrect: false },
          { label: "D", text: "", isCorrect: false },
        ]);
      }
    }
  };

  // Save Question
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingQuestion(true);
    setErrorMsg(null);

    const payload: any = {
      subjectId: qSubjectId || null,
      categoryId: qCategoryId || null,
      type: qType,
      difficulty: qDifficulty,
      points: Number(qPoints),
      content: {
        text: qText,
        instructions: qInstructions || undefined,
        rubric: qRubric || undefined,
        imageUrl: qImageUrl || undefined,
      },
      explanation: qExplanation || undefined,
    };

    if (qType === "single_choice" || qType === "multi_select" || qType === "true_false" || qType === "image_based") {
      payload.options = qOptions.map((o, idx) => ({
        label: o.label || String.fromCharCode(65 + idx),
        text: o.text,
        isCorrect: o.isCorrect,
        imageUrl: o.imageUrl,
        sortOrder: idx,
      }));
    } else if (qType === "short_answer") {
      payload.gradingConfig = {
        answerKey: qShortAnswerKey,
        acceptableAnswers: [qShortAnswerKey],
        caseSensitive: false,
      };
    } else if (qType === "essay") {
      payload.gradingConfig = {
        points: Number(qPoints),
        manualGrading: true,
      };
    }

    try {
      const url = editingQuestion ? `/api/questions/${editingQuestion.id}` : "/api/questions";
      const method = editingQuestion ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || "Gagal menyimpan soal");
        return;
      }

      setShowQuestionModal(false);
      setEditingQuestion(null);
      resetQuestionForm();
      loadQuestions();
      setSuccessMsg("Butir soal berhasil disimpan!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan server");
    } finally {
      setSavingQuestion(false);
    }
  };

  const resetQuestionForm = () => {
    setQText("");
    setQInstructions("");
    setQRubric("");
    setQImageUrl("");
    setQExplanation("");
    setQShortAnswerKey("");
    setQPoints(1);
    setQType("single_choice");
    setQOptions([
      { label: "A", text: "", isCorrect: true },
      { label: "B", text: "", isCorrect: false },
      { label: "C", text: "", isCorrect: false },
      { label: "D", text: "", isCorrect: false },
    ]);
  };

  // Open Edit Modal
  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setQType(q.type);
    setQSubjectId(q.subjectId || "");
    setQCategoryId(q.categoryId || "");
    setQDifficulty(q.difficulty || "medium");

    const v = q.versions[0];
    if (v) {
      setQText(v.content.text || "");
      setQInstructions(v.content.instructions || "");
      setQRubric(v.content.rubric || "");
      setQImageUrl(v.content.imageUrl || "");
      setQExplanation(v.explanation || "");
      setQPoints(v.gradingConfig.points || 1);
      if (q.type === "short_answer") {
        setQShortAnswerKey(v.gradingConfig.answerKey || "");
      }
      if (v.options && v.options.length > 0) {
        setQOptions(
          v.options.map((opt) => ({
            label: opt.label,
            text: opt.content.text,
            imageUrl: opt.content.imageUrl,
            isCorrect: opt.isCorrect,
          }))
        );
      }
    }
    setShowQuestionModal(true);
  };

  // Archive Question
  const handleArchiveQuestion = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin mengarsipkan butir soal ini?")) return;
    try {
      const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        loadQuestions();
        setSuccessMsg("Soal berhasil diarsipkan");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/questions/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCatName,
          subjectId: newCatSubjectId || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCategoryModal(false);
        setNewCatName("");
        loadCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Exam Wizard
  const handleSaveExamWizard = async (e: React.FormEvent) => {
    e.preventDefault();
    setWizardSaving(true);
    setErrorMsg(null);

    const payload = {
      title: examTitle,
      description: examDesc || undefined,
      subjectId: examSubjectId || null,
      examinationTypeId: examTypeId || undefined,
      questionBankId: examBankId || undefined,
      academicYearId: examYearId,
      semesterId: examSemesterId || semesters[0]?.id,
      durationMinutes: Number(examDuration),
      passingScore: Number(examPassingScore),
      scheduledStart: new Date(examScheduledStart).toISOString(),
      scheduledEnd: new Date(examScheduledEnd).toISOString(),
      teacherId: isAdmin && examTeacherId ? examTeacherId : undefined,
      policySettings: {
        randomizeQuestions: polRandomizeQ,
        randomizeOptions: polRandomizeOpt,
        maxTabSwitches: Number(polMaxTabSwitches),
        fullScreenRequired: polFullScreen,
        blockOnViolation: polBlockViolation,
        tokenRequired: polTokenReq,
        globalToken: polGlobalToken || undefined,
      },
      classGroupIds: wizardSelectedClassIds.length > 0 ? wizardSelectedClassIds : undefined,
    };

    try {
      const res = await fetch("/api/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error || "Gagal membuat ujian");
        return;
      }

      setShowExamWizard(false);
      setPolTokenReq(false);
      setPolGlobalToken("");
      setExamTypeId("");
      setExamBankId("");
      loadExaminations();
      setSuccessMsg("Jadwal ujian baru berhasil dibuat dalam status Draft!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan server");
    } finally {
      setWizardSaving(false);
    }
  };

  // State Transition (e.g. Draft -> Ready -> Scheduled)
  const handleTransitionStatus = async (examId: string, targetStatus: string) => {
    try {
      const res = await fetch(`/api/examinations/${examId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Transisi status gagal");
        return;
      }
      loadExaminations();
      setSuccessMsg(`Status ujian berhasil diubah menjadi '${targetStatus}'`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Gagal memproses transisi status");
    }
  };

  // Open Questions Assignment Modal
  const openManageQuestions = async (exam: Examination) => {
    setManagingExamQuestions(exam);
    setSelectedQuestionIds([]);
    setExamModalGradeFilter("all");
    setExamModalBankFilter("all");
    setLoadingSubjectQuestions(true);

    try {
      // 1. Fetch Question Banks strictly for this subject
      const bankUrl = exam.subjectId
        ? `/api/question-banks?subjectId=${exam.subjectId}`
        : "/api/question-banks";
      const bankRes = await fetch(bankUrl);
      const bankJson = await bankRes.json();
      const banksList = Array.isArray(bankJson) ? bankJson : (bankJson.data || []);
      setExamModalBanks(banksList);

      // 2. Fetch Questions strictly for this subject
      const qUrl = exam.subjectId
        ? `/api/questions?subjectId=${exam.subjectId}`
        : "/api/questions";
      const qRes = await fetch(qUrl);
      const qJson = await qRes.json();
      if (qJson.success) {
        setSubjectQuestions(qJson.data || []);
      }

      // 3. Pre-select existing questions in this exam
      const examDetailRes = await fetch(`/api/examinations/${exam.id}`);
      const examDetailJson = await examDetailRes.json();
      if (examDetailJson.success && examDetailJson.data?.questions) {
        const preSelected = examDetailJson.data.questions.map((eq: any) => eq.questionId);
        setSelectedQuestionIds(preSelected);
      }
    } catch (err) {
      console.error("Error loading subject questions for exam modal:", err);
    } finally {
      setLoadingSubjectQuestions(false);
    }
  };

  // Re-open / Reschedule Exam (Adakan Ulang Ujian)
  const handleReopenExam = async (exam: Examination) => {
    const confirmReopen = window.confirm(
      `Apakah Anda ingin mengadakan ulang ujian "${exam.title}"? Status akan dikembalikan ke 'scheduled' agar dapat dijadwalkan dan dikerjakan kembali oleh siswa.`
    );
    if (!confirmReopen) return;

    await handleTransitionStatus(exam.id, "scheduled");
  };

  // Delete Closed Exam (Khusus Admin)
  const handleDeleteClosedExam = async (exam: Examination) => {
    if (!isAdmin) {
      alert("Hanya Administrator yang memiliki wewenang untuk menghapus ujian yang telah ditutup.");
      return;
    }

    const confirmDelete = window.confirm(
      `PERINGATAN: Apakah Anda yakin ingin menghapus ujian "${exam.title}" yang telah ditutup ini secara permanen? Seluruh riwayat data dan lembar jawaban pada ujian ini akan dihapus.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/examinations/${exam.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Gagal menghapus ujian");
        return;
      }
      loadExaminations();
      setSuccessMsg("Ujian berhasil dihapus secara permanen oleh Administrator.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error("Delete exam error:", err);
      alert("Terjadi kesalahan server saat menghapus ujian.");
    }
  };

  // Submit Assigned Questions
  const handleSaveExamQuestions = async () => {
    if (!managingExamQuestions) return;
    setSavingExamQuestions(true);

    const payload = {
      questions: selectedQuestionIds.map((qId, idx) => ({
        questionId: qId,
        points: 2,
        sequenceOrder: idx + 1,
        isOptional: false,
      })),
    };

    try {
      const res = await fetch(`/api/examinations/${managingExamQuestions.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Gagal memasangkan butir soal");
        return;
      }
      setManagingExamQuestions(null);
      loadExaminations();
      setSuccessMsg("Butir soal berhasil dipasangkan ke ujian!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan server");
    } finally {
      setSavingExamQuestions(false);
    }
  };

  // Open Participants Assignment Modal
  const openManageParticipants = async (exam: Examination) => {
    setManagingExamParticipants(exam);
    setSelectedClassIds([]);
    try {
      const res = await fetch(`/api/examinations/${exam.id}`);
      const json = await res.json();
      if (json.success && json.data?.participants) {
        const preSelected = Array.from(
          new Set(
            json.data.participants
              .map((p: any) => p.classGroupId)
              .filter(Boolean)
          )
        ) as string[];
        setSelectedClassIds(preSelected);
      }
    } catch (err) {
      console.error("Error preloading exam participants:", err);
    }
  };

  // Submit Assigned Classes
  const handleSaveParticipants = async () => {
    if (!managingExamParticipants) return;
    setSavingParticipants(true);

    try {
      const res = await fetch(`/api/examinations/${managingExamParticipants.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classGroupIds: selectedClassIds }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || "Gagal menetapkan peserta ujian");
        return;
      }
      setManagingExamParticipants(null);
      loadExaminations();
      setSuccessMsg("Peserta kelas berhasil didaftarkan ke ujian!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan server");
    } finally {
      setSavingParticipants(false);
    }
  };

  // Grouping and filtering for Examinations Tab
  const { groupedExaminations, categoryCounts, totalMatches } = useMemo(() => {
    const now = new Date();

    // Counts across all examinations (unfiltered by search/subject)
    const counts = {
      in_progress: 0,
      upcoming: 0,
      closed: 0,
      draft: 0,
      all: examinations.length,
    };

    examinations.forEach((exam) => {
      const isPastSchedule = Boolean(exam.scheduledEnd && now > new Date(exam.scheduledEnd));
      const isDraft = exam.status === "draft";
      const isClosed = exam.status === "closed" || exam.status === "finalized" || exam.status === "archived" || isPastSchedule;
      const hasReachedStart = Boolean(exam.scheduledStart && now >= new Date(exam.scheduledStart));
      const isWindowActive = hasReachedStart && !isPastSchedule;
      const isAutoStarted = exam.status === "scheduled" && isWindowActive;
      const effectiveInProgress = !isClosed && (exam.status === "in_progress" || isAutoStarted);

      if (isDraft) {
        counts.draft++;
      } else if (effectiveInProgress) {
        counts.in_progress++;
      } else if (isClosed) {
        counts.closed++;
      } else {
        counts.upcoming++;
      }
    });

    const inProgressList: Examination[] = [];
    const upcomingList: Examination[] = [];
    const closedList: Examination[] = [];
    const draftList: Examination[] = [];

    const searchLower = examSearchFilter.trim().toLowerCase();

    examinations.forEach((exam) => {
      // Search filter
      if (searchLower) {
        const matchesTitle = exam.title.toLowerCase().includes(searchLower);
        const matchesDesc = Boolean(exam.description && exam.description.toLowerCase().includes(searchLower));
        const matchesSubjectName = Boolean(exam.subject?.name && exam.subject.name.toLowerCase().includes(searchLower));
        const matchesSubjectCode = Boolean(exam.subject?.code && exam.subject.code.toLowerCase().includes(searchLower));
        if (!matchesTitle && !matchesDesc && !matchesSubjectName && !matchesSubjectCode) {
          return;
        }
      }

      // Subject filter
      if (examSubjectFilter !== "all" && exam.subjectId !== examSubjectFilter) {
        return;
      }

      // Class filter
      if (examClassFilter !== "all") {
        const hasClass = exam.participants?.some((p) => p.classGroupId === examClassFilter);
        if (!hasClass) return;
      }

      // Examination Type filter
      if (examTypeFilter !== "all" && exam.examinationTypeId !== examTypeFilter) {
        return;
      }

      const isPastSchedule = Boolean(exam.scheduledEnd && now > new Date(exam.scheduledEnd));
      const isDraft = exam.status === "draft";
      const isClosed = exam.status === "closed" || exam.status === "finalized" || exam.status === "archived" || isPastSchedule;
      const hasReachedStart = Boolean(exam.scheduledStart && now >= new Date(exam.scheduledStart));
      const isWindowActive = hasReachedStart && !isPastSchedule;
      const isAutoStarted = exam.status === "scheduled" && isWindowActive;
      const effectiveInProgress = !isClosed && (exam.status === "in_progress" || isAutoStarted);

      if (isDraft) {
        draftList.push(exam);
      } else if (effectiveInProgress) {
        inProgressList.push(exam);
      } else if (isClosed) {
        closedList.push(exam);
      } else {
        upcomingList.push(exam);
      }
    });

    const total = inProgressList.length + upcomingList.length + closedList.length + draftList.length;

    return {
      groupedExaminations: {
        in_progress: inProgressList,
        upcoming: upcomingList,
        closed: closedList,
        draft: draftList,
      },
      categoryCounts: counts,
      totalMatches: total,
    };
  }, [examinations, examSearchFilter, examSubjectFilter, examClassFilter, examTypeFilter]);

  // Available classes for filtering
  const allAvailableClasses = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (Array.isArray(classes)) {
      classes.forEach((c) => {
        if (c?.id && c?.name) map.set(c.id, { id: c.id, name: c.name });
      });
    }
    examinations.forEach((e) => {
      e.participants?.forEach((p) => {
        if (p?.classGroup?.id && p?.classGroup?.name) {
          map.set(p.classGroup.id, { id: p.classGroup.id, name: p.classGroup.name });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, examinations]);

  // Grouping by Examination Type for monitoring view
  const groupedByTypeExaminations = useMemo(() => {
    const now = new Date();

    // Collect all matching examinations for monitoring
    const matchingExams = examinations.filter((exam) => {
      // 1. Search filter
      if (examSearchFilter.trim()) {
        const q = examSearchFilter.trim().toLowerCase();
        const matchesTitle = exam.title.toLowerCase().includes(q);
        const matchesDesc = Boolean(exam.description && exam.description.toLowerCase().includes(q));
        const matchesSubjectName = Boolean(exam.subject?.name && exam.subject.name.toLowerCase().includes(q));
        const matchesSubjectCode = Boolean(exam.subject?.code && exam.subject.code.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesSubjectName && !matchesSubjectCode) return false;
      }
      // 2. Subject filter
      if (examSubjectFilter !== "all" && exam.subjectId !== examSubjectFilter) return false;
      // 3. Class filter
      if (examClassFilter !== "all") {
        const hasClass = exam.participants?.some((p) => p.classGroupId === examClassFilter);
        if (!hasClass) return false;
      }
      // 4. Type filter
      if (examTypeFilter !== "all" && exam.examinationTypeId !== examTypeFilter) return false;

      // 5. Status filter (examCategoryFilter)
      const isPastSchedule = Boolean(exam.scheduledEnd && now > new Date(exam.scheduledEnd));
      const isDraft = exam.status === "draft";
      const isClosed = exam.status === "closed" || exam.status === "finalized" || exam.status === "archived" || isPastSchedule;
      const hasReachedStart = Boolean(exam.scheduledStart && now >= new Date(exam.scheduledStart));
      const isWindowActive = hasReachedStart && !isPastSchedule;
      const isAutoStarted = exam.status === "scheduled" && isWindowActive;
      const effectiveInProgress = !isClosed && (exam.status === "in_progress" || isAutoStarted);
      const effectiveScheduled = !isClosed && !effectiveInProgress && (exam.status === "scheduled" || exam.status === "ready");

      if (examCategoryFilter === "in_progress" && !effectiveInProgress) return false;
      if (examCategoryFilter === "upcoming" && !effectiveScheduled) return false;
      if (examCategoryFilter === "closed" && !isClosed) return false;
      if (examCategoryFilter === "draft" && !isDraft) return false;

      return true;
    });

    // Group matching exams by examinationType
    const typeGroupsMap = new Map<string, {
      typeId: string;
      typeName: string;
      typeCode: string;
      exams: Examination[];
      activeStudentsCount: number;
      totalParticipantsCount: number;
    }>();

    matchingExams.forEach((exam) => {
      const typeId = exam.examinationType?.id || "other";
      const typeName = exam.examinationType?.name || "Ujian Standar / Tanpa Tipe";
      const typeCode = exam.examinationType?.code || "UMUM";

      if (!typeGroupsMap.has(typeId)) {
        typeGroupsMap.set(typeId, {
          typeId,
          typeName,
          typeCode,
          exams: [],
          activeStudentsCount: 0,
          totalParticipantsCount: 0,
        });
      }

      const group = typeGroupsMap.get(typeId)!;
      group.exams.push(exam);

      // Student counts
      const inProgressCount = exam.attempts?.filter(
        (a) => a.status === "in_progress" || a.status === "warning" || a.status === "blocked"
      ).length || 0;
      group.activeStudentsCount += inProgressCount;
      group.totalParticipantsCount += exam._count?.participants || 0;
    });

    return Array.from(typeGroupsMap.values());
  }, [examinations, examSearchFilter, examSubjectFilter, examClassFilter, examTypeFilter, examCategoryFilter]);

  const renderMonitoringExamCard = (exam: Examination) => {
    const now = new Date();
    const isPastSchedule = Boolean(exam.scheduledEnd && now > new Date(exam.scheduledEnd));
    const isClosed = exam.status === "closed" || exam.status === "finalized" || exam.status === "archived" || isPastSchedule;
    const hasReachedStart = Boolean(exam.scheduledStart && now >= new Date(exam.scheduledStart));
    const isWindowActive = hasReachedStart && !isPastSchedule;
    const isAutoStarted = exam.status === "scheduled" && isWindowActive;
    const effectiveInProgress = !isClosed && (exam.status === "in_progress" || isAutoStarted);
    const effectiveScheduled = !isClosed && !effectiveInProgress && (exam.status === "scheduled" || exam.status === "ready");

    // Student attempt progress calculation
    const attempts = exam.attempts || [];
    const inProgressCount = attempts.filter((a) => a.status === "in_progress" || a.status === "warning" || a.status === "blocked").length;
    const submittedCount = attempts.filter((a) => a.status === "submitted" || a.status === "completed" || a.status === "grading_pending").length;
    const totalParticipants = exam._count?.participants || 0;
    const notStartedCount = Math.max(0, totalParticipants - (inProgressCount + submittedCount));
    const incidentCount = attempts.filter((a) => (a.incidentCount || 0) > 0 || a.status === "warning" || a.status === "blocked").length;

    // Percentages for progress bar
    const submittedPct = totalParticipants > 0 ? (submittedCount / totalParticipants) * 100 : 0;
    const inProgressPct = totalParticipants > 0 ? (inProgressCount / totalParticipants) * 100 : 0;

    // Participating classes
    const classList = exam.participants?.map((p) => p.classGroup).filter(Boolean) || [];

    return (
      <div
        key={exam.id}
        className={`bg-white p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md ${
          effectiveInProgress
            ? "border-emerald-300 ring-1 ring-emerald-400/25"
            : effectiveScheduled
            ? "border-blue-200"
            : isClosed
            ? "border-slate-200 bg-slate-50/60"
            : "border-slate-200"
        }`}
      >
        {/* Top Header: Status, Subject, Session, Token */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  effectiveInProgress
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                    : effectiveScheduled
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : isClosed
                    ? "bg-slate-100 text-slate-700 border border-slate-200"
                    : "bg-amber-50 text-amber-800 border border-amber-200"
                }`}
              >
                {effectiveInProgress && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
                <span>
                  {effectiveInProgress
                    ? "Sedang Berlangsung Live"
                    : effectiveScheduled
                    ? "Akan Datang (Terjadwal)"
                    : isClosed
                    ? "Selesai"
                    : exam.status}
                </span>
              </span>

              {exam.subject && (
                <span className="text-xs font-bold text-[#0D274C]">
                  {exam.subject.name} ({exam.subject.code})
                </span>
              )}

              {exam.examinationType && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px] tracking-wide">
                  {exam.examinationType.code}
                </span>
              )}

              {exam.session && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium text-[11px]">
                  {exam.session.name} ({exam.session.startTime} - {exam.session.endTime} WIB)
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>

            {/* Target Classes / Rombel */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] font-semibold text-slate-500">Target Rombel:</span>
              {classList.length > 0 ? (
                classList.map((c: any) => (
                  <span
                    key={c.id}
                    className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-[11px] font-medium"
                  >
                    {c.name}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 text-[11px] italic">Belum ada kelas terdaftar</span>
              )}
            </div>
          </div>

          {/* Quick Exam State Control & Token */}
          <div className="flex items-center gap-2 flex-wrap">
            {exam.policySettings?.tokenRequired && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-slate-600 font-medium">Token:</span>
                <span className="font-mono font-bold text-emerald-900 tracking-wider bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {exam.policySettings.globalToken || "AKTIF"}
                </span>
                {exam.policySettings.globalToken && (
                  <button
                    type="button"
                    onClick={() => handleCopyToken(exam.policySettings!.globalToken!, exam.id)}
                    className="p-1 rounded hover:bg-emerald-100 text-emerald-700 transition cursor-pointer"
                    title="Salin Token"
                  >
                    {copiedTokenId === exam.id ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}

            {effectiveScheduled && (
              <button
                onClick={() => handleTransitionStatus(exam.id, "in_progress")}
                className="px-3 py-1.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                title="Mulai sesi ujian sekarang lebih awal dari jadwal"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Mulai Sekarang</span>
              </button>
            )}

            {effectiveInProgress && (
              <button
                onClick={() => handleTransitionStatus(exam.id, "closed")}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                title="Tutup sesi ujian yang sedang berlangsung"
              >
                <span>Tutup Ujian</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Student Progress Bar & Counters */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold flex-wrap gap-2">
            <span className="text-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Progres Peserta: <strong className="text-slate-900">{totalParticipants} Siswa Terdaftar</strong>
            </span>
            <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
              <span className="text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {inProgressCount} Sedang Mengerjakan
              </span>
              <span className="text-blue-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {submittedCount} Selesai
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                {notStartedCount} Belum Mulai
              </span>
              {incidentCount > 0 && (
                <span className="text-rose-700 flex items-center gap-1 font-bold">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  {incidentCount} Terkendala
                </span>
              )}
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
            <div
              style={{ width: `${submittedPct}%` }}
              className="h-full bg-blue-500 transition-all duration-300"
              title={`Selesai: ${submittedCount}`}
            />
            <div
              style={{ width: `${inProgressPct}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
              title={`Sedang Mengerjakan: ${inProgressCount}`}
            />
          </div>
        </div>

        {/* Bottom Actions: Pengawasan Live & Rekap Nilai */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/teacher/examinations/${exam.id}/proctor`}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs ${
                effectiveInProgress
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-200"
                  : "bg-[#0D274C] hover:bg-[#163866] text-white"
              }`}
            >
              <Radio className={`w-4 h-4 ${effectiveInProgress ? "animate-pulse text-white" : "text-emerald-400"}`} />
              <span>Masuk Pengawasan Live</span>
            </Link>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {new Date(exam.scheduledStart).toLocaleDateString("id-ID")}
              {exam.session ? (
                <> • <strong className="text-indigo-700">{exam.session.name}</strong></>
              ) : (
                <> • {new Date(exam.scheduledStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                {exam.scheduledEnd && (
                  <> s/d {new Date(exam.scheduledEnd).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</>
                )}</>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderExamCard = (exam: Examination) => {
    const now = new Date();
    const isPastSchedule = Boolean(exam.scheduledEnd && now > new Date(exam.scheduledEnd));
    const isDraft = exam.status === "draft";
    const isReady = exam.status === "ready";
    const isClosed = exam.status === "closed" || exam.status === "finalized" || exam.status === "archived" || isPastSchedule;

    const hasReachedStart = Boolean(exam.scheduledStart && now >= new Date(exam.scheduledStart));
    const isWindowActive = hasReachedStart && !isPastSchedule;

    const isAutoStarted = exam.status === "scheduled" && isWindowActive;
    const effectiveInProgress = !isClosed && (exam.status === "in_progress" || isAutoStarted);
    const effectiveScheduled = !isClosed && !effectiveInProgress && (exam.status === "scheduled" || exam.status === "ready");

    return (
      <div
        key={exam.id}
        className={`bg-white p-5 rounded-xl border transition flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md ${
          effectiveInProgress
            ? "border-emerald-300 ring-1 ring-emerald-400/25"
            : effectiveScheduled
            ? "border-blue-200"
            : isClosed
            ? "border-slate-200 bg-slate-50/60"
            : "border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDraft
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : isReady
                    ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                    : isClosed
                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                    : effectiveInProgress
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse"
                    : effectiveScheduled
                    ? "bg-blue-50 text-blue-800 border border-blue-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {effectiveInProgress && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                )}
                <span>
                  {isClosed
                    ? (exam.status === "closed" ? "Selesai (Closed)" : "Selesai (Waktu Habis)")
                    : isAutoStarted
                    ? "Sedang Berjalan (Otomatis)"
                    : effectiveInProgress
                    ? "Sedang Berjalan"
                    : effectiveScheduled
                    ? (exam.status === "ready" ? "Siap Dijadwalkan" : "Akan Datang (Terjadwal)")
                    : exam.status}
                </span>
              </span>
              {exam.subject && (
                <span className="text-xs font-semibold text-[#0D274C]">
                  {exam.subject.name} ({exam.subject.code})
                </span>
              )}
              {exam.examinationType && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-[11px] tracking-wide">
                  {exam.examinationType.code}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">{exam.title}</h3>
            {exam.description && (
              <p className="text-xs text-slate-600 mt-0.5">{exam.description}</p>
            )}
          </div>

          {/* State Machine Transition Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {isDraft && (
              <button
                onClick={() => handleTransitionStatus(exam.id, "ready")}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Setujui (Ready)
              </button>
            )}
            {(isDraft || isReady) && (
              <button
                onClick={() => handleTransitionStatus(exam.id, "scheduled")}
                className="px-3 py-1.5 rounded-lg bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Jadwalkan (Scheduled)
              </button>
            )}
            {effectiveScheduled && (
              <button
                onClick={() => handleTransitionStatus(exam.id, "in_progress")}
                className="px-3 py-1.5 rounded-lg bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                title="Mulai sesi ujian sekarang lebih awal dari jadwal"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Mulai Sekarang</span>
              </button>
            )}
            {effectiveInProgress && (
              <button
                onClick={() => handleTransitionStatus(exam.id, "closed")}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span>Tutup Ujian (Closed)</span>
              </button>
            )}
            {isClosed && (
              <button
                onClick={() => handleReopenExam(exam)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Adakan Ulang</span>
              </button>
            )}
            {isClosed && isAdmin && (
              <button
                onClick={() => handleDeleteClosedExam(exam)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Ujian</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadata Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Durasi: <strong className="text-slate-900">{exam.durationMinutes} Menit</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-[#0D274C]" />
            <span>Soal: <strong className="text-slate-900">{exam._count?.questions || 0} Butir</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#65C443]" />
            <span>Peserta: <strong className="text-slate-900">{exam._count?.participants || 0} Siswa</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Anti-Cheat: <strong className="text-slate-900">Aktif ({exam.policySettings?.maxTabSwitches || 3}x Tab)</strong></span>
          </div>
        </div>

        {/* Token Badge if required */}
        {exam.policySettings?.tokenRequired && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
                <KeyRound className="w-3.5 h-3.5" />
              </span>
              <span className="text-slate-600 font-medium">Token Akses Siswa:</span>
              <span className="font-mono font-bold text-sm text-emerald-900 tracking-widest bg-white px-2 py-0.5 rounded border border-emerald-300">
                {exam.policySettings.globalToken || "AKTIF"}
              </span>
            </div>
            {exam.policySettings.globalToken && (
              <button
                type="button"
                onClick={() => handleCopyToken(exam.policySettings!.globalToken!, exam.id)}
                className="px-2 py-1 rounded bg-white hover:bg-emerald-100 border border-emerald-200 text-[11px] font-semibold text-emerald-800 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                title="Salin Kode Token"
              >
                {copiedTokenId === exam.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-emerald-600" />
                    <span>Salin Token</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openManageQuestions(exam)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0D274C]" />
              <span>Pilih Soal ({exam._count?.questions || 0})</span>
            </button>

            <button
              onClick={() => openManageParticipants(exam)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-[#65C443]" />
              <span>Daftarkan Kelas ({exam._count?.participants || 0})</span>
            </button>

            <Link
              href={`/teacher/examinations/${exam.id}/proctor`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                effectiveInProgress
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
              title="Buka Dasbor Pengawasan Live (Real-Time Proctoring)"
            >
              <Eye className={`w-3.5 h-3.5 ${effectiveInProgress ? "text-white" : "text-[#65C443]"}`} />
              <span>Pengawasan Live</span>
            </Link>

            <Link
              href={`/teacher/examinations/${exam.id}/results`}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Buka Rekapitulasi Hasil & Nilai Siswa"
            >
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span>Rekap Nilai</span>
            </Link>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Jadwal: {new Date(exam.scheduledStart).toLocaleDateString("id-ID")}
              {exam.session ? (
                <> • <span className="font-semibold text-indigo-700">{exam.session.name} ({exam.session.startTime} - {exam.session.endTime} WIB)</span></>
              ) : (
                <> • {new Date(exam.scheduledStart).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                {exam.scheduledEnd && (
                  <> s/d {new Date(exam.scheduledEnd).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</>
                )}</>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      )}

      {/* TAB CONTENT 1: Assigned Subjects & Classes with Bank Soal buttons */}
      {activeTeacherTab === "classes" && assignments && assignments.length > 0 && (
        <div className="space-y-4 pb-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0D274C]" />
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Mata Pelajaran & Kelas yang Diampu</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {assignments.length}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar rombongan belajar yang Anda ampu beserta akses langsung ke bank soal masing-masing mata pelajaran.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTeacherTab("examinations")}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0D274C]" />
              <span>Kembali ke Paket Ujian ({examinations.length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignments.map((item: any) => (
              <div
                key={item.id}
                className="rounded-xl p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#65C443] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                    <span className="px-2 py-0.5 rounded bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20 font-mono text-[11px] font-bold">
                      {item.subjectOffering.subject.code}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {item.subjectOffering.classGroup._count?.studentEnrollments || 0} Siswa
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {item.subjectOffering.subject.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Kelas: <strong className="text-slate-800">{item.subjectOffering.classGroup.name}</strong>{" "}
                    {item.subjectOffering.classGroup.major &&
                      `(${item.subjectOffering.classGroup.major.name})`}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-[#65C443] flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aktif Mengajar
                  </span>
                  <Link
                    href={`/teacher/question-banks/${item.subjectOffering.subject.id}`}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 hover:text-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-[#65C443]" />
                    <span>Bank Soal</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: Section Header: Paket Ujian & Asesmen / Jadwal */}
      {activeTeacherTab === "examinations" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                {viewMode === "schedule" ? (
                  <Calendar className="w-5 h-5 text-[#0D274C]" />
                ) : viewMode === "monitoring" ? (
                  <Activity className="w-5 h-5 text-emerald-600" />
                ) : viewMode === "results" ? (
                  <Award className="w-5 h-5 text-purple-600" />
                ) : viewMode === "analysis" ? (
                  <PieChart className="w-5 h-5 text-indigo-600" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5 text-[#0D274C]" />
                )}
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {viewMode === "schedule"
                      ? "Jadwal Pelaksanaan Ujian"
                      : viewMode === "monitoring"
                      ? "Status Siswa & Pemantauan Ujian Live"
                      : viewMode === "results"
                      ? "Hasil & Rekapitulasi Nilai Ujian"
                      : viewMode === "analysis"
                      ? "Analisis Butir Soal Ujian"
                      : viewMode === "grades"
                      ? "Rekap Nilai Siswa"
                      : "Paket Ujian & Asesmen"}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {examinations.length}
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {viewMode === "schedule"
                  ? "Kelola jadwal ujian yang akan diadakan, pilih bank soal, tipe ujian, alokasi kelas, dan konfigurasi anti-cheat."
                  : viewMode === "monitoring"
                  ? "Pantau status pengerjaan peserta ujian, koneksi live, dan insiden anti-cheat secara real-time."
                  : viewMode === "results"
                  ? "Rekapitulasi skor ujian peserta didik, koreksi jawaban esai, dan ekspor nilai."
                  : viewMode === "analysis"
                  ? "Analisis butir soal, daya pembeda, dan tingkat kesukaran soal."
                  : viewMode === "grades"
                  ? "Rekap nilai akhir per rombongan belajar untuk pelaporan raport."
                  : "Penyusunan jadwal asesmen, distribusi butir soal, dan konfigurasi proteksi anti-cheat ujian CBT."}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {assignments && assignments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTeacherTab("classes")}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kelas Diampu ({assignments.length})</span>
                </button>
              )}

              {viewMode === "schedule" && (
                <Link
                  href={isAdmin ? "/admin/examinations/create" : "/teacher/examinations/create"}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white text-xs font-medium flex items-center gap-2 transition shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Jadwal Ujian Baru</span>
                </Link>
              )}

              {viewMode === "monitoring" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Monitoring Live Aktif</span>
                </div>
              )}
            </div>
          </div>

      {/* ========================================================= */}
      {/* TAB 1: BANK SOAL                                          */}
      {/* ========================================================= */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cari teks pertanyaan..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadQuestions()}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#65C443]"
              />
            </div>

            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#65C443]"
            >
              <option value="all">Semua Mata Pelajaran</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#65C443]"
            >
              <option value="all">Semua Tipe Soal (6 Tipe)</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-[#65C443]"
            >
              <option value="all">Semua Tingkat Kesulitan</option>
              <option value="easy">Mudah (Easy)</option>
              <option value="medium">Sedang (Medium)</option>
              <option value="hard">Sulit (Hard)</option>
            </select>
          </div>

          {/* Question Cards Grid */}
          {loadingQuestions ? (
            <div className="p-12 text-center text-sm text-slate-400">Memuat butir soal...</div>
          ) : questions.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm text-slate-500 space-y-3">
              <BookOpen className="w-10 h-10 mx-auto text-slate-400" />
              <div className="font-semibold text-slate-800">Belum Ada Soal di Bank Soal</div>
              <p className="text-xs max-w-md mx-auto">
                Buat butir soal pertama Anda dengan mengeklik tombol <strong>Buat Soal Baru</strong> di atas. Mendukung 6 tipe soal lengkap!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const currentVersion = q.versions[0];
                const typeObj = QUESTION_TYPES.find((t) => t.id === q.type);

                return (
                  <div
                    key={q.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-[#0D274C] border border-slate-200">
                          {typeObj?.badge || q.type}
                        </span>
                        {q.difficulty && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                              q.difficulty === "easy"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : q.difficulty === "hard"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {q.difficulty}
                          </span>
                        )}
                        {q.subject && (
                          <span className="text-xs text-slate-600 font-medium">
                            • {q.subject.name}
                          </span>
                        )}
                        {q.category && (
                          <span className="text-[11px] text-slate-400">({q.category.name})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">
                          Poin: <strong className="text-slate-900">{currentVersion?.gradingConfig.points || 1}</strong>
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          v{currentVersion?.versionNumber || 1}
                        </span>
                        <button
                          onClick={() => openEditModal(q)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#0D274C] transition cursor-pointer"
                          title="Edit Soal"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleArchiveQuestion(q.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                          title="Arsipkan Soal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="text-sm text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">
                      {currentVersion?.content.text}
                    </div>

                    {/* Image Preview if image_based */}
                    {currentVersion?.content.imageUrl && (
                      <div className="rounded-lg overflow-hidden border border-slate-200 max-w-sm">
                        <img
                          src={currentVersion.content.imageUrl}
                          alt="Ilustrasi Soal"
                          className="w-full h-auto object-cover max-h-48"
                        />
                      </div>
                    )}

                    {/* Options Preview for Choice Types */}
                    {currentVersion?.options && currentVersion.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {currentVersion.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                              opt.isCorrect
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold"
                                : "bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                              {opt.label}
                            </span>
                            <span className="flex-1">{opt.content.text}</span>
                            {opt.isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Short Answer Preview */}
                    {q.type === "short_answer" && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                        Kunci Jawaban Isian: <strong className="text-[#0D274C] font-mono">{currentVersion?.gradingConfig.answerKey}</strong>
                      </div>
                    )}

                    {/* Essay Instructions Preview */}
                    {q.type === "essay" && currentVersion?.content.rubric && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                        Pedoman Koreksi / Rubrik: <span className="text-slate-800">{currentVersion.content.rubric}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MANAJEMEN UJIAN & ASESMEN                           */}
      {/* ========================================================= */}
      {activeTab === "examinations" && (
        <div className="space-y-4">
          {/* Filter Bar: Status Pills & Search */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {viewMode !== "monitoring" && (
                <button
                  type="button"
                  onClick={() => setExamCategoryFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    examCategoryFilter === "all"
                      ? "bg-[#0D274C] text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <span>Semua Ujian</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    examCategoryFilter === "all" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {categoryCounts.all}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setExamCategoryFilter("in_progress")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  examCategoryFilter === "in_progress"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span>Sedang Berjalan</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  examCategoryFilter === "in_progress" ? "bg-white/25 text-white" : "bg-emerald-200 text-emerald-900"
                }`}>
                  {categoryCounts.in_progress}
                </span>
              </button>

              {viewMode !== "monitoring" && (
                <button
                  type="button"
                  onClick={() => setExamCategoryFilter("upcoming")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    examCategoryFilter === "upcoming"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Akan Datang</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    examCategoryFilter === "upcoming" ? "bg-white/25 text-white" : "bg-blue-200 text-blue-900"
                  }`}>
                    {categoryCounts.upcoming}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setExamCategoryFilter("closed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  examCategoryFilter === "closed"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{viewMode === "monitoring" ? "Sudah Selesai" : "Selesai"}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  examCategoryFilter === "closed" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {categoryCounts.closed}
                </span>
              </button>

              {viewMode !== "monitoring" && categoryCounts.draft > 0 && (
                <button
                  type="button"
                  onClick={() => setExamCategoryFilter("draft")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    examCategoryFilter === "draft"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                  }`}
                >
                  <span>Draft</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    examCategoryFilter === "draft" ? "bg-white/25 text-white" : "bg-amber-200 text-amber-900"
                  }`}>
                    {categoryCounts.draft}
                  </span>
                </button>
              )}
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ujian / mapel..."
                  value={examSearchFilter}
                  onChange={(e) => setExamSearchFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#65C443]"
                />
                {examSearchFilter && (
                  <button
                    onClick={() => setExamSearchFilter("")}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Kelas / Rombel */}
              <select
                value={examClassFilter}
                onChange={(e) => setExamClassFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#65C443] max-w-[170px]"
              >
                <option value="all">Semua Kelas / Rombel</option>
                {allAvailableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Filter Jenis Ujian */}
              {examinationTypes.length > 0 && (
                <select
                  value={examTypeFilter}
                  onChange={(e) => setExamTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#65C443] max-w-[170px]"
                >
                  <option value="all">Semua Jenis Ujian</option>
                  {examinationTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.code}] {t.name}
                    </option>
                  ))}
                </select>
              )}

              {subjects.length > 1 && (
                <select
                  value={examSubjectFilter}
                  onChange={(e) => setExamSubjectFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#65C443] max-w-[150px]"
                >
                  <option value="all">Semua Mapel</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code || s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Examinations List / Groups */}
          {loadingExams ? (
            <div className="p-12 text-center text-sm text-slate-400">Memuat paket ujian...</div>
          ) : examinations.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm text-slate-500 space-y-3">
              <Activity className="w-10 h-10 mx-auto text-slate-400" />
              <div className="font-semibold text-slate-800">Belum Ada Sesi Ujian</div>
              <p className="text-xs max-w-md mx-auto">
                {viewMode === "monitoring"
                  ? "Sesi ujian yang dijadwalkan akan muncul di sini untuk pengawasan status live peserta."
                  : "Klik tombol Buat Jadwal Ujian Baru untuk menyusun paket asesmen lengkap."}
              </p>
            </div>
          ) : viewMode === "monitoring" ? (
            groupedByTypeExaminations.length === 0 ? (
              <div className="bg-white p-10 text-center rounded-xl border border-slate-200 shadow-sm text-slate-500 space-y-3">
                <Search className="w-8 h-8 mx-auto text-slate-300" />
                <div className="font-semibold text-slate-800">Tidak Ada Ujian yang Sesuai Filter</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Tidak ditemukan sesi ujian yang sesuai dengan kriteria filter kelas, jenis ujian, status, atau pencarian Anda.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setExamSearchFilter("");
                    setExamSubjectFilter("all");
                    setExamClassFilter("all");
                    setExamTypeFilter("all");
                    setExamCategoryFilter(viewMode === "monitoring" ? "in_progress" : "all");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedByTypeExaminations.map((group) => (
                  <div key={group.typeId} className="space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-mono font-bold text-xs tracking-wider">
                          {group.typeCode}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <span>{group.typeName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {group.exams.length} Ujian
                          </span>
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {group.activeStudentsCount > 0 ? (
                          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            {group.activeStudentsCount} Siswa Aktif Live
                          </span>
                        ) : (
                          <span className="text-slate-500">{group.totalParticipantsCount} Peserta Terdaftar</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {group.exams.map(renderMonitoringExamCard)}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : totalMatches === 0 ? (
            <div className="bg-white p-10 text-center rounded-xl border border-slate-200 shadow-sm text-slate-500 space-y-3">
              <Search className="w-8 h-8 mx-auto text-slate-300" />
              <div className="font-semibold text-slate-800">Tidak Ada Ujian yang Cocok</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tidak ditemukan paket ujian yang sesuai dengan kriteria filter atau pencarian Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setExamSearchFilter("");
                  setExamSubjectFilter("all");
                  setExamClassFilter("all");
                  setExamTypeFilter("all");
                  setExamCategoryFilter("all");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION: SEDANG BERJALAN */}
              {(examCategoryFilter === "in_progress" || (examCategoryFilter === "all" && groupedExaminations.in_progress.length > 0)) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Sedang Berjalan</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {groupedExaminations.in_progress.length} Ujian
                        </span>
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      Siswa dapat mengakses dan mengerjakan ujian sekarang
                    </span>
                  </div>

                  {groupedExaminations.in_progress.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-white">
                      Tidak ada ujian yang sedang berjalan saat ini.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {groupedExaminations.in_progress.map(renderExamCard)}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: AKAN DATANG */}
              {(examCategoryFilter === "upcoming" || (examCategoryFilter === "all" && groupedExaminations.upcoming.length > 0)) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Akan Datang (Terjadwal)</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          {groupedExaminations.upcoming.length} Ujian
                        </span>
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      Menunggu waktu jadwal pelaksanaan ujian dibuka
                    </span>
                  </div>

                  {groupedExaminations.upcoming.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-white">
                      Tidak ada ujian terjadwal yang akan datang.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {groupedExaminations.upcoming.map(renderExamCard)}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: SELESAI */}
              {(examCategoryFilter === "closed" || (examCategoryFilter === "all" && groupedExaminations.closed.length > 0)) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-500" />
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Selesai (Ditutup)</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          {groupedExaminations.closed.length} Ujian
                        </span>
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      Ujian telah berakhir. Rekap nilai dan evaluasi siap diakses.
                    </span>
                  </div>

                  {groupedExaminations.closed.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-white">
                      Belum ada riwayat ujian yang selesai.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {groupedExaminations.closed.map(renderExamCard)}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: KONSEP / DRAFT */}
              {(examCategoryFilter === "draft" || (examCategoryFilter === "all" && groupedExaminations.draft.length > 0)) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>Konsep / Draft</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {groupedExaminations.draft.length} Draft
                        </span>
                      </h4>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      Paket ujian belum disetujui atau dijadwalkan
                    </span>
                  </div>

                  {groupedExaminations.draft.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-white">
                      Tidak ada draf ujian.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {groupedExaminations.draft.map(renderExamCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )}

      {/* ========================================================= */}
      {/* MODAL: BUAT / EDIT BUTIR SOAL                             */}
      {/* ========================================================= */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0D274C]" />
                <span>{editingQuestion ? "Edit Butir Soal" : "Buat Butir Soal Baru"}</span>
              </h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              {/* Type, Subject, Difficulty Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-700 font-semibold block mb-1">Tipe Soal *</label>
                  <select
                    value={qType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold block mb-1">Mata Pelajaran</label>
                  <select
                    value={qSubjectId}
                    onChange={(e) => setQSubjectId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                  >
                    <option value="">Umum (Tanpa Mapel)</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-700 font-semibold block mb-1">Kesulitan & Poin</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={qDifficulty}
                      onChange={(e) => setQDifficulty(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                    >
                      <option value="easy">Mudah</option>
                      <option value="medium">Sedang</option>
                      <option value="hard">Sulit</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={qPoints}
                      onChange={(e) => setQPoints(Number(e.target.value))}
                      placeholder="Poin"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Teks Pertanyaan / Soal *</label>
                <textarea
                  rows={3}
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Tuliskan pertanyaan soal secara lengkap..."
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                />
              </div>

              {/* Image Upload for ALL Question Types */}
              <div className="space-y-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#0D274C]" />
                    <span>Sematkan Gambar / Ilustrasi (Opsional - Semua Tipe Soal)</span>
                  </label>
                  {qImageUrl && (
                    <button
                      type="button"
                      onClick={() => setQImageUrl("")}
                      className="text-xs text-rose-600 hover:underline cursor-pointer font-medium"
                    >
                      Hapus Gambar
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50 cursor-pointer shadow-xs"
                  />
                  {uploadingImage && <span className="text-xs text-slate-500 animate-pulse">Mengunggah...</span>}
                </div>
                {qImageUrl && (
                  <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden max-w-xs shadow-xs">
                    <img src={qImageUrl} alt="Preview" className="w-full h-auto object-cover max-h-36" />
                  </div>
                )}
              </div>

              {/* Options Section for Choice Types */}
              {(qType === "single_choice" || qType === "multi_select" || qType === "true_false" || qType === "image_based") && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">
                      Pilihan Jawaban {qType === "single_choice" && "(Pilih 1 Kunci Benar)"}
                    </label>
                    {qType !== "true_false" && (
                      <button
                        type="button"
                        onClick={() =>
                          setQOptions([
                            ...qOptions,
                            {
                              label: String.fromCharCode(65 + qOptions.length),
                              text: "",
                              isCorrect: false,
                            },
                          ])
                        }
                        className="text-[11px] text-[#0D274C] hover:text-[#163866] flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tambah Opsi
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {qOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (qType === "single_choice" || qType === "true_false") {
                              setQOptions(qOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
                            } else {
                              setQOptions(qOptions.map((o, i) => (i === idx ? { ...o, isCorrect: !o.isCorrect } : o)));
                            }
                          }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition ${
                            opt.isCorrect
                              ? "bg-[#65C443] text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                          }`}
                          title={opt.isCorrect ? "Kunci Benar" : "Tandai Benar"}
                        >
                          {opt.label}
                        </button>

                        <input
                          type="text"
                          required
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...qOptions];
                            updated[idx].text = e.target.value;
                            setQOptions(updated);
                          }}
                          placeholder={`Pilihan ${opt.label}...`}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                        />

                        {qType !== "true_false" && qOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setQOptions(qOptions.filter((_, i) => i !== idx))}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Short Answer Input */}
              {qType === "short_answer" && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="text-xs text-slate-700 font-semibold block mb-1">Kunci Jawaban Isian Singkat *</label>
                  <input
                    type="text"
                    required
                    value={qShortAnswerKey}
                    onChange={(e) => setQShortAnswerKey(e.target.value)}
                    placeholder="Contoh: Soekarno"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Pemeriksaan auto-grading tidak sensitif huruf besar/kecil (case-insensitive).
                  </span>
                </div>
              )}

              {/* Essay Rubric */}
              {qType === "essay" && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block mb-1">Petunjuk Menjawab Siswa</label>
                    <input
                      type="text"
                      value={qInstructions}
                      onChange={(e) => setQInstructions(e.target.value)}
                      placeholder="Contoh: Minimal 3 paragraf..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-700 font-semibold block mb-1">Pedoman Koreksi / Rubrik Nilai Guru</label>
                    <textarea
                      rows={2}
                      value={qRubric}
                      onChange={(e) => setQRubric(e.target.value)}
                      placeholder="Panduan aspek penilaian untuk pengoreksi..."
                      className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>
                </div>
              )}

              {/* Explanation Note */}
              <div className="pt-2 border-t border-slate-200">
                <label className="text-xs text-slate-700 font-semibold block mb-1">Pembahasan / Catatan Soal (Opsional)</label>
                <input
                  type="text"
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Penjelasan jawaban setelah ujian selesai..."
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {savingQuestion ? "Menyimpan..." : "Simpan ke Bank Soal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ========================================================= */}
      {/* MODAL: PILIH SOAL UNTUK UJIAN                             */}
      {/* ========================================================= */}
      {managingExamQuestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#0D274C]" />
                  <span>Pasangkan Soal: {managingExamQuestions.title}</span>
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <span>Mata Pelajaran:</span>
                  <span className="font-semibold text-[#0D274C] px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                    {managingExamQuestions.subject?.name || "Mata Pelajaran"} ({managingExamQuestions.subject?.code || "-"})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setManagingExamQuestions(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bank Soal Filter & Quick Select Bar */}
            {(() => {
              const rawList = subjectQuestions.length > 0
                ? subjectQuestions
                : questions.filter(
                    (q) => !managingExamQuestions.subjectId || q.subjectId === managingExamQuestions.subjectId
                  );

              const displayedModalBanks =
                examModalGradeFilter === "all"
                  ? examModalBanks
                  : examModalBanks.filter((b) => b.gradeLevel === Number(examModalGradeFilter));

              const displayedQuestions = (() => {
                if (examModalBankFilter !== "all") {
                  return rawList.filter((q) => (q as any).questionBankId === examModalBankFilter);
                }
                if (examModalGradeFilter !== "all") {
                  const allowedBankIds = new Set(displayedModalBanks.map((b) => b.id));
                  return rawList.filter((q) => allowedBankIds.has((q as any).questionBankId));
                }
                return rawList;
              })();

              return (
                <>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 flex-wrap text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">Tingkat:</span>
                        <select
                          value={examModalGradeFilter}
                          onChange={(e) => {
                            const val = e.target.value === "all" ? "all" : Number(e.target.value);
                            setExamModalGradeFilter(val);
                            setExamModalBankFilter("all");
                          }}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#65C443] font-medium"
                        >
                          <option value="all">Semua Tingkat</option>
                          <option value={10}>Tingkat 10 (X)</option>
                          <option value={11}>Tingkat 11 (XI)</option>
                          <option value={12}>Tingkat 12 (XII)</option>
                          <option value={13}>Tingkat 13 (XIII)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">Bank Soal:</span>
                        <select
                          value={examModalBankFilter}
                          onChange={(e) => setExamModalBankFilter(e.target.value)}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#65C443]"
                        >
                          <option value="all">
                            {examModalGradeFilter === "all"
                              ? `Semua Bank Soal (${managingExamQuestions.subject?.name || "Mapel Ini"})`
                              : `Semua Bank Soal Tingkat ${examModalGradeFilter}`}
                          </option>
                          {displayedModalBanks.map((b) => (
                            <option key={b.id} value={b.id}>
                              [Tingkat {b.gradeLevel}] {b.title} ({b.code}) - {b.actualQuestionsCount ?? b.questions?.length ?? b.totalQuestions ?? b._count?.questions ?? 0} Soal
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = displayedQuestions.map((q) => q.id);
                          setSelectedQuestionIds(Array.from(new Set([...selectedQuestionIds, ...allIds])));
                        }}
                        className="text-[11px] font-semibold text-[#0D274C] hover:underline cursor-pointer"
                      >
                        Pilih Semua ({displayedQuestions.length})
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => {
                          const currDisplayedIds = new Set(displayedQuestions.map((q) => q.id));
                          setSelectedQuestionIds(selectedQuestionIds.filter((id) => !currDisplayedIds.has(id)));
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Batal Pilih
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {loadingSubjectQuestions ? (
                      <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 animate-spin text-[#65C443]" />
                        <span>Memuat bank soal mata pelajaran...</span>
                      </div>
                    ) : displayedQuestions.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                        <div className="font-semibold text-slate-700">
                          Belum ada butir soal pada mata pelajaran {managingExamQuestions.subject?.name || ""}.
                        </div>
                        <p className="text-slate-400">
                          Hanya butir soal yang sesuai dengan mata pelajaran ujian ini yang ditampilkan. Silakan buat
                          butir soal baru pada mata pelajaran ini di tab Bank Soal.
                        </p>
                      </div>
                    ) : (
                      displayedQuestions.map((q, idx) => {
                        const isSelected = selectedQuestionIds.includes(q.id);
                        const ver = q.versions[0];
                        return (
                          <div
                            key={q.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== q.id));
                              } else {
                                setSelectedQuestionIds([...selectedQuestionIds, q.id]);
                              }
                            }}
                            className={`p-3.5 rounded-xl border text-xs cursor-pointer transition flex items-start gap-3 ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium shadow-xs"
                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-1 rounded accent-[#65C443] cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono font-bold text-slate-500">#{idx + 1}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 border border-slate-300 uppercase font-semibold">
                                  {q.type}
                                </span>
                                <span className="text-slate-500 font-mono">
                                  Poin: {ver?.gradingConfig.points || 1}
                                </span>
                                {q.subject && (
                                  <span className="text-[10px] text-[#0D274C] font-semibold bg-[#0D274C]/10 px-1.5 py-0.5 rounded">
                                    {q.subject.name}
                                  </span>
                                )}
                              </div>
                              <div className="truncate font-medium">{ver?.content.text}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              );
            })()}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-600">
                Terpilih: <strong className="text-slate-900 font-mono">{selectedQuestionIds.length} Butir Soal</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingExamQuestions(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveExamQuestions}
                  disabled={savingExamQuestions || selectedQuestionIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {savingExamQuestions ? "Menyimpan..." : "Simpan Butir Soal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DAFTARKAN PESERTA KELAS KE UJIAN                   */}
      {/* ========================================================= */}
      {managingExamParticipants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0D274C]" />
                  <span>Daftarkan Kelas ke: {managingExamParticipants.title}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seluruh siswa aktif di kelas yang dipilih akan didaftarkan sebagai peserta.
                </p>
              </div>
              <button
                onClick={() => setManagingExamParticipants(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {availableClasses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada kelas rombel yang terdaftar.
                </div>
              ) : (
                availableClasses.map((cg) => {
                  const isChecked = selectedClassIds.includes(cg.id);
                  return (
                    <label
                      key={cg.id}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center gap-3 ${
                        isChecked
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedClassIds(selectedClassIds.filter((id) => id !== cg.id));
                          } else {
                            setSelectedClassIds([...selectedClassIds, cg.id]);
                          }
                        }}
                        className="rounded accent-[#65C443]"
                      />
                      <span>Kelas: {cg.name}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-600">
                Terpilih: <strong className="text-slate-900 font-mono">{selectedClassIds.length} Kelas</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingExamParticipants(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveParticipants}
                  disabled={savingParticipants || selectedClassIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {savingParticipants ? "Mendaftarkan..." : "Daftarkan Peserta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TAMBAH KATEGORI SOAL                               */}
      {/* ========================================================= */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#0D274C]" />
                <span>Tambah Kategori Soal</span>
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Nama Kategori / Bab *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Contoh: Bab 1 - Aljabar Linier"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-semibold block mb-1">Mata Pelajaran Terkait</label>
                <select
                  value={newCatSubjectId}
                  onChange={(e) => setNewCatSubjectId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#65C443]"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer shadow-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Simpan Kategori
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
