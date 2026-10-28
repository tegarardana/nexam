"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  FolderArchive,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  CheckSquare,
  HelpCircle,
  AlignLeft,
  ImageIcon,
  Trash2,
  Edit3,
  Pencil,
  ArrowLeft,
  Upload,
  ChevronRight,
  Sliders,
  Sparkles,
  Download,
  FileSpreadsheet,
  X,
  FileUp,
  AlertTriangle,
} from "lucide-react";

interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  major?: { id: string; code: string; name: string } | null;
}

interface Teacher {
  id: string;
  displayName: string;
  nip?: string | null;
  username: string;
}

interface QuestionBank {
  id: string;
  code: string;
  title: string;
  subjectId: string;
  gradeLevel: number;
  teacherId?: string | null;
  totalQuestions: number;
  singleChoiceCount: number;
  singleChoiceWeight: number;
  complexMultipleChoiceCount: number;
  complexMultipleChoiceWeight: number;
  trueFalseCount: number;
  trueFalseWeight: number;
  shortAnswerCount: number;
  shortAnswerWeight: number;
  essayCount: number;
  essayWeight: number;
  status: string;
  createdAt: string;
  subject?: Subject;
  teacher?: Teacher | null;
  actualQuestionsCount?: number;
  actualTypeCounts?: Record<string, number>;
}

interface QuestionBankPageContentProps {
  subject: Subject;
  isAdmin: boolean;
  teachers?: Teacher[];
  currentTeacherId?: string;
  backUrl: string;
  backLabel: string;
}

export default function QuestionBankPageContent({
  subject,
  isAdmin,
  teachers = [],
  currentTeacherId,
  backUrl,
  backLabel,
}: QuestionBankPageContentProps) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "form" | "manage_questions">("list");
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [activeBank, setActiveBank] = useState<QuestionBank | null>(null);

  // Form State for Bank Soal
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    gradeLevel: 10,
    teacherId: currentTeacherId || "",
    totalQuestions: 40,
    singleChoiceCount: 20,
    singleChoiceWeight: 40,
    complexMultipleChoiceCount: 5,
    complexMultipleChoiceWeight: 20,
    trueFalseCount: 5,
    trueFalseWeight: 10,
    shortAnswerCount: 5,
    shortAnswerWeight: 15,
    essayCount: 5,
    essayWeight: 15,
    status: "active",
  });

  // Question Form inside Active Bank
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [qType, setQType] = useState<"single_choice" | "multi_select" | "true_false" | "short_answer" | "essay">("single_choice");
  const [qDifficulty, setQDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [qText, setQText] = useState("");
  const [qInstructions, setQInstructions] = useState("");
  const [qRubric, setQRubric] = useState("");
  const [qImageUrl, setQImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [qPoints, setQPoints] = useState(1);
  const [qAnswerKey, setQAnswerKey] = useState("");
  const [qOptions, setQOptions] = useState([
    { label: "A", text: "", isCorrect: true },
    { label: "B", text: "", isCorrect: false },
    { label: "C", text: "", isCorrect: false },
    { label: "D", text: "", isCorrect: false },
  ]);
  const [questionSubmitting, setQuestionSubmitting] = useState(false);

  // Import Question Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importRawText, setImportRawText] = useState("");
  const [importTab, setImportTab] = useState<"file" | "paste">("file");
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Global Escape key listener to close modal or inline forms
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showImportModal) {
          setShowImportModal(false);
          return;
        }
        if (showAddQuestionForm) {
          setShowAddQuestionForm(false);
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showImportModal, showAddQuestionForm]);

  // Fetch Banks for this Subject
  const fetchBanks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/question-banks?subjectId=${subject.id}`);
      if (!res.ok) throw new Error("Gagal mengambil daftar bank soal");
      const data = await res.json();
      setBanks(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, [subject.id]);

  // Calculations
  const totalAllocatedQuestions = useMemo(() => {
    return (
      Number(formData.singleChoiceCount || 0) +
      Number(formData.complexMultipleChoiceCount || 0) +
      Number(formData.trueFalseCount || 0) +
      Number(formData.shortAnswerCount || 0) +
      Number(formData.essayCount || 0)
    );
  }, [formData]);

  const totalAllocatedWeight = useMemo(() => {
    return (
      Number(formData.singleChoiceWeight || 0) +
      Number(formData.complexMultipleChoiceWeight || 0) +
      Number(formData.trueFalseWeight || 0) +
      Number(formData.shortAnswerWeight || 0) +
      Number(formData.essayWeight || 0)
    );
  }, [formData]);

  const isQuestionsCountMatch = totalAllocatedQuestions === Number(formData.totalQuestions || 0);
  const isWeightMatch = Math.abs(totalAllocatedWeight - 100) < 0.05;

  // Open Create Form
  const handleOpenCreateForm = () => {
    const generatedCode = `BS-${subject.code || "MAPEL"}${formData.gradeLevel}-${Date.now().toString().slice(-4)}`.toUpperCase();
    setEditingBankId(null);
    setFormData({
      code: generatedCode,
      title: `Bank Soal ${subject.name} Kelas ${formData.gradeLevel}`,
      gradeLevel: 10,
      teacherId: currentTeacherId || (teachers[0]?.id || ""),
      totalQuestions: 40,
      singleChoiceCount: 20,
      singleChoiceWeight: 40,
      complexMultipleChoiceCount: 5,
      complexMultipleChoiceWeight: 20,
      trueFalseCount: 5,
      trueFalseWeight: 10,
      shortAnswerCount: 5,
      shortAnswerWeight: 15,
      essayCount: 5,
      essayWeight: 15,
      status: "active",
    });
    setError(null);
    setView("form");
  };

  // Open Edit Form
  const handleOpenEditForm = (bank: QuestionBank) => {
    setEditingBankId(bank.id);
    setFormData({
      code: bank.code,
      title: bank.title,
      gradeLevel: bank.gradeLevel,
      teacherId: bank.teacherId || "",
      totalQuestions: bank.totalQuestions,
      singleChoiceCount: bank.singleChoiceCount,
      singleChoiceWeight: bank.singleChoiceWeight,
      complexMultipleChoiceCount: bank.complexMultipleChoiceCount,
      complexMultipleChoiceWeight: bank.complexMultipleChoiceWeight,
      trueFalseCount: bank.trueFalseCount,
      trueFalseWeight: bank.trueFalseWeight,
      shortAnswerCount: bank.shortAnswerCount,
      shortAnswerWeight: bank.shortAnswerWeight,
      essayCount: bank.essayCount,
      essayWeight: bank.essayWeight,
      status: bank.status,
    });
    setError(null);
    setView("form");
  };

  // Presets
  const applyPreset = (type: "standard40" | "short25" | "essayFocus") => {
    if (type === "standard40") {
      setFormData((prev) => ({
        ...prev,
        totalQuestions: 40,
        singleChoiceCount: 25,
        singleChoiceWeight: 50,
        complexMultipleChoiceCount: 5,
        complexMultipleChoiceWeight: 15,
        trueFalseCount: 5,
        trueFalseWeight: 15,
        shortAnswerCount: 3,
        shortAnswerWeight: 10,
        essayCount: 2,
        essayWeight: 10,
      }));
    } else if (type === "short25") {
      setFormData((prev) => ({
        ...prev,
        totalQuestions: 25,
        singleChoiceCount: 15,
        singleChoiceWeight: 60,
        complexMultipleChoiceCount: 5,
        complexMultipleChoiceWeight: 20,
        trueFalseCount: 5,
        trueFalseWeight: 20,
        shortAnswerCount: 0,
        shortAnswerWeight: 0,
        essayCount: 0,
        essayWeight: 0,
      }));
    } else if (type === "essayFocus") {
      setFormData((prev) => ({
        ...prev,
        totalQuestions: 20,
        singleChoiceCount: 10,
        singleChoiceWeight: 30,
        complexMultipleChoiceCount: 3,
        complexMultipleChoiceWeight: 15,
        trueFalseCount: 2,
        trueFalseWeight: 10,
        shortAnswerCount: 3,
        shortAnswerWeight: 20,
        essayCount: 2,
        essayWeight: 25,
      }));
    }
  };

  // Save Bank
  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isQuestionsCountMatch) {
      setError(`Jumlah alokasi tipe soal (${totalAllocatedQuestions}) belum cocok dengan total target soal (${formData.totalQuestions})`);
      return;
    }

    if (!isWeightMatch) {
      setError(`Total persentase bobot soal harus tepat 100% (saat ini ${totalAllocatedWeight}%)`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        subjectId: subject.id,
      };

      const url = editingBankId ? `/api/question-banks/${editingBankId}` : "/api/question-banks";
      const method = editingBankId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || resData.message || "Gagal menyimpan bank soal");
      }

      await fetchBanks();
      setView("list");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete Bank
  const handleDeleteBank = async (bankId: string, code: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus Bank Soal '${code}' beserta butir-butir soal di dalamnya?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/question-banks/${bankId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menghapus bank soal");
      }
      await fetchBanks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Questions Manager
  const handleOpenQuestionsManager = async (bank: QuestionBank) => {
    setActiveBank(bank);
    setView("manage_questions");
    setShowAddQuestionForm(false);
    setEditingQuestionId(null);
    setLoadingQuestions(true);
    try {
      const res = await fetch(`/api/questions?questionBankId=${bank.id}`);
      const data = await res.json();
      if (data.success) {
        setBankQuestions(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleOpenAddQuestion = () => {
    setEditingQuestionId(null);
    setQType("single_choice");
    setQDifficulty("medium");
    setQPoints(1);
    setQText("");
    setQInstructions("");
    setQRubric("");
    setQImageUrl("");
    setQAnswerKey("");
    setQOptions([
      { label: "A", text: "", isCorrect: true },
      { label: "B", text: "", isCorrect: false },
      { label: "C", text: "", isCorrect: false },
      { label: "D", text: "", isCorrect: false },
    ]);
    setShowAddQuestionForm(true);
  };

  const handleOpenEditQuestion = (q: any) => {
    setEditingQuestionId(q.id);
    setQType(q.type || "single_choice");
    setQDifficulty(q.difficulty || "medium");
    const version = q.versions?.[0] || {};
    setQPoints(version.gradingConfig?.points ?? 1);
    setQText(version.content?.text || "");
    setQInstructions(version.content?.instructions || "");
    setQRubric(version.content?.rubric || version.explanation || "");
    setQImageUrl(version.content?.imageUrl || "");

    if (q.type === "single_choice" || q.type === "multi_select") {
      if (version.options && version.options.length > 0) {
        setQOptions(
          version.options.map((opt: any, idx: number) => ({
            label: opt.label || String.fromCharCode(65 + idx),
            text: opt.content?.text || opt.text || "",
            isCorrect: Boolean(opt.isCorrect),
          }))
        );
      } else {
        setQOptions([
          { label: "A", text: "", isCorrect: true },
          { label: "B", text: "", isCorrect: false },
          { label: "C", text: "", isCorrect: false },
          { label: "D", text: "", isCorrect: false },
        ]);
      }
    } else if (q.type === "true_false") {
      const correctOpt = version.options?.find((o: any) => o.isCorrect);
      setQAnswerKey(correctOpt ? correctOpt.label : (version.gradingConfig?.answerKey || "Benar"));
    } else if (q.type === "short_answer") {
      setQAnswerKey(version.gradingConfig?.answerKey || "");
    } else if (q.type === "essay") {
      setQRubric(version.content?.rubric || version.explanation || "");
    }

    setShowAddQuestionForm(true);
    setTimeout(() => {
      const formEl = document.getElementById("question-editor-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus butir soal ini?")) return;
    try {
      const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus butir soal");
      if (activeBank) {
        const refreshRes = await fetch(`/api/questions?questionBankId=${activeBank.id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          setBankQuestions(refreshData.data || []);
        }
        fetchBanks();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Upload Image Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah gambar");
      setQImageUrl(data.url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Save Question inside Active Bank (Create or Update)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBank) return;

    setQuestionSubmitting(true);
    try {
      let finalOptions: any[] = [];
      let gradingConfig: any = { points: qPoints };

      if (qType === "single_choice" || qType === "multi_select") {
        finalOptions = qOptions.map((o, idx) => ({
          label: o.label,
          text: o.text,
          isCorrect: o.isCorrect,
          sortOrder: idx,
        }));
      } else if (qType === "true_false") {
        finalOptions = [
          { label: "Benar", text: "Benar", isCorrect: qAnswerKey === "Benar", sortOrder: 0 },
          { label: "Salah", text: "Salah", isCorrect: qAnswerKey === "Salah", sortOrder: 1 },
        ];
      } else if (qType === "short_answer") {
        gradingConfig.answerKey = qAnswerKey;
      }

      const payload = {
        subjectId: activeBank.subjectId,
        questionBankId: activeBank.id,
        type: qType,
        difficulty: qDifficulty,
        status: "published",
        points: Number(qPoints) > 0 ? Number(qPoints) : 1,
        content: {
          text: qText,
          instructions: qInstructions || undefined,
          rubric: qRubric || undefined,
          imageUrl: qImageUrl || undefined,
        },
        options: finalOptions,
        gradingConfig,
      };

      const url = editingQuestionId ? `/api/questions/${editingQuestionId}` : "/api/questions";
      const method = editingQuestionId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || (editingQuestionId ? "Gagal memperbarui butir soal" : "Gagal menyimpan soal"));
      }

      setShowAddQuestionForm(false);
      setEditingQuestionId(null);
      setQText("");
      setQInstructions("");
      setQRubric("");
      setQImageUrl("");
      setQAnswerKey("");
      setQPoints(1);
      setQOptions([
        { label: "A", text: "", isCorrect: true },
        { label: "B", text: "", isCorrect: false },
        { label: "C", text: "", isCorrect: false },
        { label: "D", text: "", isCorrect: false },
      ]);

      const refreshRes = await fetch(`/api/questions?questionBankId=${activeBank.id}`);
      const refreshData = await refreshRes.json();
      if (refreshData.success) {
        setBankQuestions(refreshData.data || []);
      }
      fetchBanks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setQuestionSubmitting(false);
    }
  };

  // CSV Question Parser
  const parseCsvQuestions = (text: string) => {
    if (!text || !text.trim()) return [];

    // Support direct JSON array as well
    if (text.trim().startsWith("[")) {
      try {
        const jsonArr = JSON.parse(text);
        if (Array.isArray(jsonArr)) {
          return jsonArr.map((item: any, idx: number) => ({
            id: `json-${idx}`,
            type: item.type || "single_choice",
            text: item.text || item.content?.text || "",
            difficulty: item.difficulty || "medium",
            points: Number(item.points) || 1,
            imageUrl: item.imageUrl || item.content?.imageUrl,
            instructions: item.instructions,
            rubric: item.rubric,
            options: item.options || [],
            answerKey: item.answerKey,
            explanation: item.explanation,
            isValid: !!(item.text || item.content?.text),
            warning: !(item.text || item.content?.text) ? "Pertanyaan tidak boleh kosong" : null,
          }));
        }
      } catch {
        // Not valid JSON, continue with CSV parsing
      }
    }

    const lines: string[] = [];
    let currentLine = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
        currentLine += char;
      } else if ((char === "\n" || (char === "\r" && text[i + 1] === "\n")) && !insideQuotes) {
        if (char === "\r") i++;
        lines.push(currentLine);
        currentLine = "";
      } else {
        currentLine += char;
      }
    }
    if (currentLine.trim()) lines.push(currentLine);

    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const cells: string[] = [];
      let cell = "";
      let inQuotes = false;
      const delimiter = line.includes("\t") ? "\t" : line.includes(";") && !line.includes(",") ? ";" : ",";
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cell += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === delimiter && !inQuotes) {
          cells.push(cell.trim());
          cell = "";
        } else {
          cell += c;
        }
      }
      cells.push(cell.trim());
      return cells;
    };

    const headerCells = parseLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    const parsed: any[] = [];

    for (let lIdx = 1; lIdx < lines.length; lIdx++) {
      const row = lines[lIdx];
      if (!row.trim()) continue;
      const values = parseLine(row);
      const rowObj: Record<string, string> = {};
      headerCells.forEach((h, idx) => {
        rowObj[h] = values[idx] || "";
      });

      const getVal = (keys: string[]) => {
        for (const k of keys) {
          const cleanK = k.replace(/[^a-z0-9]/g, "");
          const found = Object.keys(rowObj).find((rk) => rk.includes(cleanK));
          if (found && rowObj[found]) return rowObj[found];
        }
        return "";
      };

      // Get type code (supports numeric 1-5 or textual names)
      const rawType = String(
        getVal(["kodetipesoal", "tipesoal", "tipe", "type", "kode"])
      ).trim().toLowerCase();

      let type = "single_choice";
      if (rawType === "1" || rawType === "pg" || rawType.includes("tunggal")) {
        type = "single_choice";
      } else if (rawType === "2" || rawType.includes("kompleks") || rawType.includes("multi")) {
        type = "multi_select";
      } else if (rawType === "3" || rawType.includes("benar") || rawType.includes("false") || rawType === "bs") {
        type = "true_false";
      } else if (rawType === "4" || rawType.includes("singkat") || rawType.includes("isian") || rawType === "short") {
        type = "short_answer";
      } else if (rawType === "5" || rawType.includes("esai") || rawType.includes("essay") || rawType.includes("uraian")) {
        type = "essay";
      }

      const questionText = getVal(["pertanyaan", "text", "soal", "question"]);
      if (!questionText) continue;

      const optA = getVal(["opsia", "a"]);
      const optB = getVal(["opsib", "b"]);
      const optC = getVal(["opsic", "c"]);
      const optD = getVal(["opsid", "d"]);
      const optE = getVal(["opsie", "e"]);
      const answerKey = getVal(["kunci", "jawaban", "kuncijawaban", "key", "answer"]);
      const points = Number(getVal(["poin", "bobot", "points"])) || 1;
      const difficultyRaw = String(
        getVal(["kesulitan", "tingkat", "tingkatkesulitan", "difficulty"])
      ).toLowerCase().trim();
      let difficulty = "medium";
      if (difficultyRaw === "1" || difficultyRaw.includes("mudah") || difficultyRaw.includes("easy")) difficulty = "easy";
      if (difficultyRaw === "3" || difficultyRaw.includes("sulit") || difficultyRaw.includes("hard")) difficulty = "hard";

      const imageUrl = getVal(["urlgambar", "gambar", "image", "imageurl"]);
      const explanation = getVal(["pembahasan", "penjelasan", "explanation", "rubrik", "rubric"]);

      const options: any[] = [];
      if (type === "single_choice" || type === "multi_select") {
        const correctKeys = answerKey
          .toUpperCase()
          .split(/[,;\s]+/)
          .map((k) => k.trim())
          .filter(Boolean);

        const rawOpts = [
          { label: "A", text: optA },
          { label: "B", text: optB },
          { label: "C", text: optC },
          { label: "D", text: optD },
          { label: "E", text: optE },
        ].filter((o) => o.text.trim().length > 0);

        rawOpts.forEach((o, idx) => {
          options.push({
            label: o.label,
            text: o.text,
            isCorrect: correctKeys.includes(o.label),
            sortOrder: idx,
          });
        });
      }

      const isValid =
        questionText.length > 0 &&
        (type !== "single_choice" || options.some((o) => o.isCorrect)) &&
        (type !== "multi_select" || options.some((o) => o.isCorrect)) &&
        (type !== "true_false" || !!answerKey) &&
        (type !== "short_answer" || !!answerKey);

      let warning: string | null = null;
      if (type === "single_choice" && !options.some((o) => o.isCorrect)) {
        warning = "Kunci jawaban belum cocok dengan opsi A-E";
      } else if (type === "multi_select" && !options.some((o) => o.isCorrect)) {
        warning = "Belum ada opsi benar yang dicentang";
      } else if (type === "true_false" && !answerKey) {
        warning = "Kunci jawaban Benar/Salah belum diisi";
      } else if (type === "short_answer" && !answerKey) {
        warning = "Kunci jawaban isian singkat belum diisi";
      }

      parsed.push({
        id: `row-${lIdx}`,
        type,
        text: questionText,
        difficulty,
        points,
        imageUrl: imageUrl || undefined,
        answerKey: answerKey || undefined,
        explanation: explanation || undefined,
        options,
        isValid,
        warning,
      });
    }

    return parsed;
  };

  // Download Excel (.xlsx) Template with 2 Sheets (Template Soal + Panduan Lengkap)
  const downloadExcelTemplate = () => {
    // Sheet 1: Template Soal
    const templateHeaders = [
      "Kode Tipe Soal",
      "Pertanyaan",
      "Opsi A",
      "Opsi B",
      "Opsi C",
      "Opsi D",
      "Opsi E",
      "Kunci Jawaban",
      "Poin",
      "Tingkat Kesulitan",
      "URL Gambar",
      "Pembahasan",
    ];

    const sampleRows = [
      [
        1,
        "Manakah dari pernyataan berikut yang merupakan prinsip utama pemrograman berorientasi objek?",
        "Enkapsulasi",
        "Kompilasi",
        "Interpretasi",
        "Normalisasi Data",
        "Indexing",
        "A",
        1,
        "Mudah",
        "",
        "Enkapsulasi adalah salah satu pilar utama OOP bersama inheritance dan polymorphism.",
      ],
      [
        2,
        "Pilihlah dua pilar utama dalam pemrograman berorientasi objek (OOP) di bawah ini:",
        "Polymorphism",
        "Procedural Flow",
        "Inheritance",
        "Waterfall Model",
        "Agile Loop",
        "A,C",
        2,
        "Sedang",
        "",
        "Polymorphism dan Inheritance adalah pilar dasar OOP.",
      ],
      [
        3,
        "Pada bahasa pemrograman Java, sebuah class dapat melakukan Multiple Inheritance secara langsung dari dua class induk sekaligus.",
        "",
        "",
        "",
        "",
        "",
        "Salah",
        1,
        "Mudah",
        "",
        "Java tidak mendukung multiple inheritance antar class secara langsung, melainkan melalui interface.",
      ],
      [
        4,
        "Keyword apakah di JavaScript/TypeScript yang digunakan untuk mendeklarasikan variabel yang nilainya konstan tidak dapat di-reassign?",
        "",
        "",
        "",
        "",
        "",
        "const",
        2,
        "Sedang",
        "",
        "Keyword const membuat binding variabel tidak dapat di-reassign.",
      ],
      [
        5,
        "Jelaskan perbedaan mendasar antara Abstract Class dan Interface dalam perancangan arsitektur perangkat lunak!",
        "",
        "",
        "",
        "",
        "",
        "Kriteria: memaparkan keberadaan method konkret/state pada abstract class vs kontrak murni pada interface.",
        4,
        "Sulit",
        "",
        "Abstract class dapat memiliki default implementation dan state atribut konkret, sedangkan interface adalah kontrak method murni.",
      ],
    ];

    const wsTemplate = XLSX.utils.aoa_to_sheet([templateHeaders, ...sampleRows]);

    // Set column widths for Sheet 1
    wsTemplate["!cols"] = [
      { wch: 16 }, // Kode Tipe Soal
      { wch: 45 }, // Pertanyaan
      { wch: 20 }, // Opsi A
      { wch: 20 }, // Opsi B
      { wch: 20 }, // Opsi C
      { wch: 20 }, // Opsi D
      { wch: 20 }, // Opsi E
      { wch: 18 }, // Kunci Jawaban
      { wch: 10 }, // Poin
      { wch: 18 }, // Tingkat Kesulitan
      { wch: 25 }, // URL Gambar
      { wch: 35 }, // Pembahasan
    ];

    // Sheet 2: Panduan Penggunaan
    const guideData = [
      ["PANDUAN LENGKAP TEMPLATE IMPORT BUTIR SOAL - CBT NEXAM"],
      [""],
      ["1. DAFTAR KODE NUMERIK TIPE SOAL (KOLOM A):"],
      ["Kode", "Tipe Soal", "Ketentuan Opsi Pilihan", "Format Kunci Jawaban"],
      ["1", "Pilihan Ganda Tunggal", "Wajib isi Opsi A s.d. D (atau E)", "1 huruf kapital: A, B, C, D, atau E"],
      ["2", "Pilihan Ganda Kompleks", "Wajib isi Opsi A s.d. D (atau E)", "Huruf dipisah koma (contoh: A,C atau B,D,E)"],
      ["3", "Benar / Salah", "Kosongkan Opsi A s.d. E", "Tulis kata 'Benar' atau 'Salah'"],
      ["4", "Isian Singkat", "Kosongkan Opsi A s.d. E", "Tulis kata kunci jawaban teks eksak (contoh: Fotosintesis)"],
      ["5", "Uraian / Esai", "Kosongkan Opsi A s.d. E", "Tulis pedoman / kriteria penilaian (opsional)"],
      [""],
      ["2. PANDUAN KOLOM LAINNYA:"],
      ["Kolom", "Deskripsi / Ketentuan"],
      ["URL Gambar", "Fitur gambar tersedia universal untuk SEMUA tipe soal (1 s.d. 5). Isi URL gambar visual bila ada."],
      ["Poin", "Bobot angka skor butir soal (contoh: 1, 2, 5). Default bernilai 1 jika dikosongkan."],
      ["Tingkat Kesulitan", "Isi dengan 'Mudah', 'Sedang', atau 'Sulit' (atau angka 1 = Mudah, 2 = Sedang, 3 = Sulit)."],
      ["Pembahasan", "Penjelasan kunci atau catatan pedoman koreksi untuk pengajar."],
      [""],
      ["3. LANGKAH-LANGKAH PENGGUNAAN:"],
      ["Langkah 1", "Buka berkas ini di Microsoft Excel, Google Sheets, atau WPS Office."],
      ["Langkah 2", "Masukkan butir-butir soal Anda pada sheet 'Template Soal' mulai dari baris 2."],
      ["Langkah 3", "Simpan berkas Excel ini (.xlsx)."],
      ["Langkah 4", "Pada panel Nexam, klik tombol 'Impor Soal', lalu pilih atau seret berkas ini."],
      ["Langkah 5", "Periksa pratinjau soal, lalu klik 'Impor Butir Soal'."],
    ];

    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    wsGuide["!cols"] = [
      { wch: 18 },
      { wch: 25 },
      { wch: 35 },
      { wch: 45 },
    ];

    // Create workbook with both sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Template Soal");
    XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan Penggunaan");

    XLSX.writeFile(wb, `template_import_bank_soal_${activeBank?.code || "nexam"}.xlsx`);
  };

  // Handle File Selected for Import (Supports .xlsx, .xls, .csv, .tsv, .txt, .json)
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError(null);
    setImportSuccess(null);

    try {
      const isExcel =
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel";

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames.includes("Template Soal")
          ? "Template Soal"
          : workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawCsv = XLSX.utils.sheet_to_csv(worksheet);
        setImportRawText(rawCsv);
        const parsed = parseCsvQuestions(rawCsv);
        setParsedQuestions(parsed);
        if (parsed.length === 0) {
          setImportError("Tidak ada baris butir soal yang valid ditemukan pada sheet 'Template Soal'.");
        }
      } else {
        const text = await file.text();
        setImportRawText(text);
        const parsed = parseCsvQuestions(text);
        setParsedQuestions(parsed);
        if (parsed.length === 0) {
          setImportError("Tidak ada baris butir soal yang valid ditemukan dalam berkas.");
        }
      }
    } catch (err: any) {
      setImportError("Gagal membaca berkas Excel/CSV. Pastikan format berkas valid: " + err.message);
    }
  };

  // Handle Raw Text Change
  const handleRawTextChange = (text: string) => {
    setImportRawText(text);
    setImportError(null);
    setImportSuccess(null);
    const parsed = parseCsvQuestions(text);
    setParsedQuestions(parsed);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!activeBank) return;
    const validQuestions = parsedQuestions.filter((q) => q.isValid);
    if (validQuestions.length === 0) {
      setImportError("Tidak ada butir soal yang memenuhi syarat validasi untuk diimpor.");
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const payload = {
        questions: validQuestions.map((q) => ({
          type: q.type,
          difficulty: q.difficulty,
          points: q.points,
          text: q.text,
          imageUrl: q.imageUrl,
          instructions: q.instructions,
          rubric: q.rubric,
          options: q.options,
          answerKey: q.answerKey,
          explanation: q.explanation,
        })),
      };

      const res = await fetch(`/api/question-banks/${activeBank.id}/import-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengimpor butir soal");
      }

      setImportSuccess(data.message || `Berhasil mengimpor ${validQuestions.length} butir soal!`);

      // Refresh question list
      const refreshRes = await fetch(`/api/questions?questionBankId=${activeBank.id}`);
      const refreshData = await refreshRes.json();
      if (refreshData.success) {
        setBankQuestions(refreshData.data || []);
      }
      fetchBanks();

      // Reset import state after delay
      setTimeout(() => {
        setShowImportModal(false);
        setImportFileName("");
        setImportRawText("");
        setParsedQuestions([]);
        setImportSuccess(null);
      }, 1200);
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {view === "list" ? (
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                } else {
                  router.push(backUrl);
                }
              }}
              className="p-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>{backLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setView("list");
                setShowAddQuestionForm(false);
              }}
              className="p-2 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Kembali ke Bank Soal</span>
            </button>
          )}
        </div>

        {view === "list" && (
          <button
            onClick={handleOpenCreateForm}
            className="px-4 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold shadow-sm flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Bank Soal Baru</span>
          </button>
        )}
      </div>

      {/* Subject Header Banner */}
      <div
        className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20 font-mono text-xs font-bold">
              {subject.code}
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {subject.name}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              {subject.major?.name ? `Jurusan ${subject.major.code}` : "Umum (Semua Jurusan)"}
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {subject.description || "Manajemen bank soal ujian terstruktur berdasarkan tingkat kelas, kuota tipe soal, dan persentase bobot nilai."}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-xl self-start md:self-auto">
          <FolderArchive className="w-6 h-6 text-[#65C443]" />
          <div>
            <div className="text-[11px] text-slate-500">Total Bank Soal Mapel</div>
            <div className="text-base font-bold text-slate-900 font-mono">{banks.length} Bank Soal</div>
          </div>
        </div>
      </div>

      {/* VIEW 1: DAFTAR BANK SOAL */}
      {view === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-[#65C443]" />
              <span>Daftar Bank Soal Mata Pelajaran ({banks.length})</span>
            </h2>
            <span className="text-xs text-slate-500">
              Setiap bank soal dipisahkan oleh kode bank soal unik.
            </span>
          </div>

          {loading ? (
            <div
              className="py-16 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-sm"
            >
              Memuat bank soal...
            </div>
          ) : banks.length === 0 ? (
            <div
              className="p-12 rounded-2xl bg-white border-2 border-dashed border-slate-300 text-center space-y-3"
            >
              <FolderArchive className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Belum Ada Bank Soal pada Mapel Ini</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Anda dapat membuat lebih dari 1 bank soal untuk mata pelajaran ini (misal Bank Soal PAS Kelas 10, UTS Kelas 11, dsb).
              </p>
              <button
                onClick={handleOpenCreateForm}
                className="px-5 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold shadow-sm inline-flex items-center gap-2 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Bank Soal Sekarang</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {banks.map((bank) => {
                const actualCount = bank.actualQuestionsCount || 0;
                const isComplete = actualCount >= bank.totalQuestions;

                return (
                  <div
                    key={bank.id}
                    className="rounded-2xl p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-[#65C443] transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="px-2 py-0.5 rounded bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20 font-mono text-xs font-bold">
                          {bank.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                            Tingkat {bank.gradeLevel}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              bank.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {bank.status === "active" ? "Aktif" : "Draft"}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-slate-900 text-base leading-snug">{bank.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Guru Pengampu:{" "}
                          <strong className="text-slate-800">
                            {bank.teacher?.displayName || "Belum Ditentukan"}
                          </strong>
                        </p>
                      </div>

                      {/* Breakdown Box */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-2">
                        <div className="flex items-center justify-between text-slate-600 border-b border-slate-200 pb-1.5 font-medium">
                          <span>Target: <strong className="text-slate-900 font-mono">{bank.totalQuestions} Soal</strong></span>
                          <span className="text-[#0D274C] font-bold">Bobot: 100%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700 text-[10px]">
                          <div>• PG Tunggal: <strong>{bank.singleChoiceCount}</strong> ({bank.singleChoiceWeight}%)</div>
                          <div>• PG Kompleks: <strong>{bank.complexMultipleChoiceCount}</strong> ({bank.complexMultipleChoiceWeight}%)</div>
                          <div>• Benar/Salah: <strong>{bank.trueFalseCount}</strong> ({bank.trueFalseWeight}%)</div>
                          <div>• Isian Singkat: <strong>{bank.shortAnswerCount}</strong> ({bank.shortAnswerWeight}%)</div>
                          <div className="col-span-2">• Uraian / Esai: <strong>{bank.essayCount}</strong> ({bank.essayWeight}%)</div>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-slate-500">Progres Pengisian:</span>
                        <span className={`font-bold font-mono ${isComplete ? "text-emerald-700" : "text-amber-700"}`}>
                          {actualCount} / {bank.totalQuestions} Butir Soal
                        </span>
                      </div>
                    </div>

                    {/* Actions - Guaranteed single row */}
                    <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-nowrap">
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleOpenEditForm(bank)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-medium transition cursor-pointer text-xs flex items-center gap-1"
                          title="Edit Konfigurasi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBank(bank.id, bank.code)}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition cursor-pointer text-xs font-medium"
                          title="Hapus Bank Soal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveBank(bank);
                            setShowImportModal(true);
                            setImportError(null);
                            setImportSuccess(null);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap"
                          title="Impor Butir Soal Massal (Excel .xlsx / CSV)"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Impor Soal</span>
                        </button>

                        <button
                          onClick={() => handleOpenQuestionsManager(bank)}
                          className="px-4 py-1.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#52a835] text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm whitespace-nowrap"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Kelola Butir Soal ({actualCount})</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FORM KONFIGURASI BANK SOAL */}
      {view === "form" && (
        <form onSubmit={handleSaveBank} className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#0D274C]" />
                <span>{editingBankId ? "Edit Konfigurasi Bank Soal" : "Buat Bank Soal Baru"}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tentukan kode, tingkatan kelas, guru pengampu, kuota tiap tipe soal, serta persentase bobot nilai.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setView("list")}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
            >
              Batal
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Information */}
          <div
            className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-xs"
          >
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <FolderArchive className="w-4 h-4 text-[#65C443]" />
              <span>Identitas & Sasaran Bank Soal</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 mb-1.5 font-semibold">Kode Bank Soal *</label>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Contoh: BS-MAT10-2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Kode unik pembeda bank soal.</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 mb-1.5 font-semibold">Judul Bank Soal *</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Penilaian Akhir Semester Ganjil Matematika X"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 mb-1.5 font-semibold">Tingkat Kelas *</label>
                <select
                  value={formData.gradeLevel}
                  onChange={(e) => setFormData({ ...formData, gradeLevel: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value={10}>Kelas 10 (X)</option>
                  <option value={11}>Kelas 11 (XI)</option>
                  <option value={12}>Kelas 12 (XII)</option>
                  <option value={13}>Kelas 13 (XIII)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1.5 font-semibold">
                  Guru Pengampu {isAdmin ? "(Pilih Guru) *" : ""}
                </label>
                {isAdmin ? (
                  <select
                    value={formData.teacherId}
                    onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="">-- Pilih Guru Pengampu --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.displayName} ({t.nip || t.username})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value="Ditugaskan kepada Anda (Guru Pengampu)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 italic"
                  />
                )}
              </div>

              <div>
                <label className="block text-slate-700 mb-1.5 font-semibold">Status Bank Soal</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="active">Aktif Digunakan</option>
                  <option value="draft">Draft (Persiapan)</option>
                  <option value="archived">Diarsipkan</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Distribution and Scoring Configuration */}
          <div
            className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#0D274C]" />
                  <span>Distribusi Tipe Soal & Bobot Nilai (%)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Setiap tipe soal mendukung fitur penyematan gambar / ilustrasi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-medium">Preset Cepat:</span>
                <button
                  type="button"
                  onClick={() => applyPreset("standard40")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 transition cursor-pointer font-medium"
                >
                  Standar 40 Soal
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("short25")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 transition cursor-pointer font-medium"
                >
                  Objektif 25 Soal
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("essayFocus")}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] text-slate-700 transition cursor-pointer font-medium"
                >
                  Fokus Uraian 20 Soal
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="font-bold text-slate-900 text-xs">Total Target Jumlah Soal</div>
                <div className="text-[11px] text-slate-500">
                  Jumlah keseluruhan soal yang akan diujikan pada bank soal ini.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={formData.totalQuestions}
                  onChange={(e) => setFormData({ ...formData, totalQuestions: Number(e.target.value) })}
                  className="w-24 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-bold text-center focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
                <span className="text-slate-500 text-xs font-medium">Butir</span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Tipe Soal</th>
                    <th className="py-3 px-4 w-44 text-center">Jumlah Soal (Butir)</th>
                    <th className="py-3 px-4 w-44 text-center">Bobot Nilai (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {/* 1. PG Tunggal */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-slate-900 font-bold">Pilihan Ganda Tunggal</div>
                        <div className="text-[10px] text-slate-500">1 jawaban benar dari opsi A, B, C, D, dsb.</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        value={formData.singleChoiceCount}
                        onChange={(e) => setFormData({ ...formData, singleChoiceCount: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.singleChoiceWeight}
                          onChange={(e) => setFormData({ ...formData, singleChoiceWeight: Number(e.target.value) })}
                          className="w-20 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* 2. PG Kompleks */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <CheckSquare className="w-4 h-4 text-[#0D274C] shrink-0" />
                      <div>
                        <div className="text-slate-900 font-bold">Pilihan Ganda Kompleks</div>
                        <div className="text-[10px] text-slate-500">Bisa memilih lebih dari satu jawaban benar.</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        value={formData.complexMultipleChoiceCount}
                        onChange={(e) => setFormData({ ...formData, complexMultipleChoiceCount: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.complexMultipleChoiceWeight}
                          onChange={(e) => setFormData({ ...formData, complexMultipleChoiceWeight: Number(e.target.value) })}
                          className="w-20 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* 3. Benar / Salah */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-slate-900 font-bold">Benar / Salah</div>
                        <div className="text-[10px] text-slate-500">Pernyataan dengan pilihan Benar atau Salah.</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        value={formData.trueFalseCount}
                        onChange={(e) => setFormData({ ...formData, trueFalseCount: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.trueFalseWeight}
                          onChange={(e) => setFormData({ ...formData, trueFalseWeight: Number(e.target.value) })}
                          className="w-20 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* 4. Isian Singkat */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <AlignLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-slate-900 font-bold">Isian Singkat</div>
                        <div className="text-[10px] text-slate-500">Jawaban kata kunci tepat (auto-graded).</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        value={formData.shortAnswerCount}
                        onChange={(e) => setFormData({ ...formData, shortAnswerCount: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.shortAnswerWeight}
                          onChange={(e) => setFormData({ ...formData, shortAnswerWeight: Number(e.target.value) })}
                          className="w-20 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                  </tr>

                  {/* 5. Uraian / Esai */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                      <div>
                        <div className="text-slate-900 font-bold">Uraian / Esai</div>
                        <div className="text-[10px] text-slate-500">Jawaban deskriptif dengan rubrik penilaian manual.</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        min={0}
                        value={formData.essayCount}
                        onChange={(e) => setFormData({ ...formData, essayCount: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={formData.essayWeight}
                          onChange={(e) => setFormData({ ...formData, essayWeight: Number(e.target.value) })}
                          className="w-20 px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-center font-bold focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>

                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-900 text-xs font-bold">Total Keseluruhan</span>
                        {isQuestionsCountMatch && isWeightMatch ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sesuai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Belum Sesuai
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block whitespace-nowrap px-3 py-1 rounded-md text-xs font-mono font-bold ${
                          isQuestionsCountMatch
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {totalAllocatedQuestions} / {formData.totalQuestions} Soal
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-block whitespace-nowrap px-3 py-1 rounded-md text-xs font-mono font-bold ${
                          isWeightMatch
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {totalAllocatedWeight}% / 100%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={() => setView("list")}
              className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition shadow-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || !isQuestionsCountMatch || !isWeightMatch}
              className="px-6 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#52a835] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{saving ? "Menyimpan Konfigurasi..." : "Simpan Konfigurasi Bank Soal"}</span>
            </button>
          </div>
        </form>
      )}

      {/* VIEW 3: KELOLA BUTIR SOAL DI BANK SOAL */}
      {view === "manage_questions" && activeBank && (
        <div className="space-y-6">
          {/* Active Bank Header */}
          <div
            className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-[#0D274C] px-2.5 py-1 rounded-lg bg-[#0D274C]/10 border border-[#0D274C]/20">
                  {activeBank.code}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{activeBank.title}</h2>
              </div>
              <div className="flex items-center gap-3 text-slate-500 text-xs mt-1.5 flex-wrap">
                <span>Tingkat {activeBank.gradeLevel}</span>
                <span>•</span>
                <span>Guru: <strong className="text-slate-800">{activeBank.teacher?.displayName || "Belum Ditugaskan"}</strong></span>
                <span>•</span>
                <span>Target: <strong className="text-[#65C443] font-mono">{activeBank.totalQuestions} Soal</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  setImportError(null);
                  setImportSuccess(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#0D274C]" />
                <span>Impor Butir Soal</span>
              </button>
              <button
                onClick={handleOpenAddQuestion}
                className="px-4 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Butir Soal Baru</span>
              </button>
            </div>
          </div>

          {/* Quota Progress per Type */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "PG Tunggal", target: activeBank.singleChoiceCount, type: "single_choice" },
              { label: "PG Kompleks", target: activeBank.complexMultipleChoiceCount, type: "multi_select" },
              { label: "Benar / Salah", target: activeBank.trueFalseCount, type: "true_false" },
              { label: "Isian Singkat", target: activeBank.shortAnswerCount, type: "short_answer" },
              { label: "Uraian / Esai", target: activeBank.essayCount, type: "essay" },
            ].map((item) => {
              const count = bankQuestions.filter((q) => q.type === item.type).length;
              const isFulfilled = count >= item.target;
              return (
                <div
                  key={item.type}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs text-center space-y-1"
                >
                  <div className="text-[11px] text-slate-500 font-medium">{item.label}</div>
                  <div className={`font-mono font-bold text-base ${isFulfilled ? "text-[#65C443]" : "text-amber-600"}`}>
                    {count} / {item.target}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Add/Edit Question Form */}
          {showAddQuestionForm && (
            <form
              id="question-editor-form"
              onSubmit={handleSaveQuestion}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 text-xs text-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#0D274C]" />
                  <span>
                    {editingQuestionId
                      ? `Edit Butir Soal (${activeBank.code})`
                      : `Input Butir Soal Baru (${activeBank.code})`}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddQuestionForm(false);
                    setEditingQuestionId(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Tipe Soal *</label>
                  <select
                    value={qType}
                    onChange={(e: any) => setQType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="single_choice">Pilihan Ganda Tunggal</option>
                    <option value="multi_select">Pilihan Ganda Kompleks</option>
                    <option value="true_false">Benar / Salah</option>
                    <option value="short_answer">Isian Singkat</option>
                    <option value="essay">Uraian / Esai</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Tingkat Kesulitan</label>
                  <select
                    value={qDifficulty}
                    onChange={(e: any) => setQDifficulty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="easy">Mudah (Easy)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="hard">Sukar / HOTS (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Poin / Bobot Soal *</label>
                  <input
                    type="number"
                    min={1}
                    value={qPoints}
                    onChange={(e) => setQPoints(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Isi Pertanyaan / Kasus Soal *</label>
                <textarea
                  required
                  rows={3}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Ketik narasi pertanyaan atau kasus soal di sini..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              {/* Gambar / Media Attachment - ALL QUESTION TYPES */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Sematkan Gambar / Ilustrasi (Semua Tipe Soal)</span>
                  </label>
                  {qImageUrl && (
                    <button
                      type="button"
                      onClick={() => setQImageUrl("")}
                      className="text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      Hapus Gambar
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    value={qImageUrl}
                    onChange={(e) => setQImageUrl(e.target.value)}
                    placeholder="Tempel URL Gambar (e.g. https://...)"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] text-xs"
                  />
                  <label className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer flex items-center justify-center gap-2 text-xs transition">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>{uploadingImage ? "Mengunggah..." : "Upload File Gambar dari Komputer"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {qImageUrl && (
                  <div className="pt-2">
                    <div className="text-[10px] text-slate-500 mb-1">Preview Gambar Tersemat:</div>
                    <div className="rounded-lg overflow-hidden border border-slate-200 max-w-sm">
                      <img src={qImageUrl} alt="Preview" className="w-full h-auto max-h-48 object-cover" />
                    </div>
                  </div>
                )}
              </div>

              {/* Options Section */}
              {(qType === "single_choice" || qType === "multi_select") && (
                <div className="space-y-2.5">
                  <label className="block text-slate-700 font-medium">
                    Pilihan Jawaban (Centang opsi yang benar):
                  </label>
                  {qOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      <input
                        type={qType === "single_choice" ? "radio" : "checkbox"}
                        name="correctOption"
                        checked={opt.isCorrect}
                        onChange={(e) => {
                          if (qType === "single_choice") {
                            setQOptions(
                              qOptions.map((o, i) => ({ ...o, isCorrect: i === idx }))
                            );
                          } else {
                            const updated = [...qOptions];
                            updated[idx].isCorrect = e.target.checked;
                            setQOptions(updated);
                          }
                        }}
                        className="w-4 h-4 rounded text-[#65C443] accent-[#65C443]"
                      />
                      <span className="w-6 text-center font-bold text-slate-600">{opt.label}.</span>
                      <input
                        required
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...qOptions];
                          updated[idx].text = e.target.value;
                          setQOptions(updated);
                        }}
                        placeholder={`Teks opsi jawaban ${opt.label}...`}
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {qType === "true_false" && (
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Kunci Jawaban Benar / Salah *</label>
                  <select
                    required
                    value={qAnswerKey}
                    onChange={(e) => setQAnswerKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="">-- Tentukan Kunci Jawaban --</option>
                    <option value="Benar">Pernyataan Bernilai BENAR</option>
                    <option value="Salah">Pernyataan Bernilai SALAH</option>
                  </select>
                </div>
              )}

              {qType === "short_answer" && (
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Kunci Kata Jawaban Singkat *</label>
                  <input
                    required
                    type="text"
                    value={qAnswerKey}
                    onChange={(e) => setQAnswerKey(e.target.value)}
                    placeholder="Contoh: Fotosintesis"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              )}

              {qType === "essay" && (
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Rubrik Penilaian / Kunci Jawaban Esai</label>
                  <textarea
                    rows={2}
                    value={qRubric}
                    onChange={(e) => setQRubric(e.target.value)}
                    placeholder="Pedoman penskoran atau poin-poin yang harus dijawab siswa..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddQuestionForm(false);
                    setEditingQuestionId(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={questionSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium transition cursor-pointer shadow-sm"
                >
                  {questionSubmitting
                    ? (editingQuestionId ? "Memperbarui..." : "Menyimpan...")
                    : (editingQuestionId ? "Simpan Perubahan Soal" : "Simpan Butir Soal")}
                </button>
              </div>
            </form>
          )}

          {/* Questions Roster */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0D274C]" />
              <span>Daftar Butir Soal ({bankQuestions.length})</span>
            </h3>

            {loadingQuestions ? (
              <div
                className="py-12 rounded-2xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-sm"
              >
                Memuat butir soal...
              </div>
            ) : bankQuestions.length === 0 ? (
              <div
                className="p-10 rounded-2xl bg-white border-2 border-dashed border-slate-300 text-center space-y-2 text-slate-500 text-xs"
              >
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="font-semibold text-slate-800">Belum Ada Soal di Bank Ini</div>
                <p className="text-slate-500">
                  Klik tombol &apos;Tambah Butir Soal Baru&apos; atau &apos;Impor Butir Soal&apos; untuk mulai mengisi bank soal.
                </p>
                <div className="flex items-center justify-center gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(true);
                      setImportError(null);
                      setImportSuccess(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#0D274C]" />
                    <span>Impor via Berkas CSV/Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddQuestion}
                    className="px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Susun Manual</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {bankQuestions.map((q, qIdx) => {
                  const version = q.versions?.[0];
                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-400">#{qIdx + 1}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono uppercase font-semibold border border-slate-200">
                            {q.type.replace("_", " ")}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20 font-medium">
                            {q.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 font-mono text-[11px] mr-1.5">
                            Poin: {version?.gradingConfig?.points || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditQuestion(q)}
                            className="p-1 px-2.5 rounded-lg bg-slate-100 hover:bg-[#0D274C] hover:text-white text-slate-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold border border-slate-200 shadow-2xs"
                            title="Edit Butir Soal"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold border border-rose-200 shadow-2xs"
                            title="Hapus Butir Soal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-slate-900 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                        {version?.content?.text}
                      </p>

                      {version?.content?.imageUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 max-w-sm">
                          <img
                            src={version.content.imageUrl}
                            alt="Ilustrasi Soal"
                            className="w-full h-auto object-cover max-h-48"
                          />
                        </div>
                      )}

                      {version?.options && version.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {version.options.map((opt: any) => (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                                opt.isCorrect
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <span className="w-5 h-5 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-700 text-[10px] font-bold">
                                {opt.label}
                              </span>
                              <span className="truncate">{opt.content?.text || opt.text}</span>
                              {opt.isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-[#65C443] ml-auto" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: IMPOR BUTIR SOAL MASSAL                           */}
      {/* ======================================================== */}
      {showImportModal && activeBank && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-800"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0D274C]/10 border border-[#0D274C]/20 flex items-center justify-center text-[#0D274C]">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Impor Butir Soal Massal</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#0D274C]/10 text-[#0D274C] border border-[#0D274C]/20">
                      {activeBank.code}
                    </span>
                  </h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Mendukung 5 tipe soal, opsi gambar di semua tipe, dan format CSV/Excel.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Unduh Template Excel (.xlsx) Lengkap Dengan Panduan & Contoh Soal"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Quick Guide Card: Numeric Types */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0D274C] text-[11px] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Panduan Kode Numerik Tipe Soal (Kolom A di Template Excel):</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Sheet &apos;Panduan Penggunaan&apos; tersedia di Excel</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[10px] pt-1">
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                    <strong className="text-slate-900 font-mono">Kode 1:</strong> PG Tunggal (Kunci: A/B/C/D)
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                    <strong className="text-slate-900 font-mono">Kode 2:</strong> PG Kompleks (Kunci: A,C)
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                    <strong className="text-slate-900 font-mono">Kode 3:</strong> Benar / Salah
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                    <strong className="text-slate-900 font-mono">Kode 4:</strong> Isian Singkat
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-700">
                    <strong className="text-slate-900 font-mono">Kode 5:</strong> Uraian / Esai
                  </div>
                </div>
              </div>

              {/* Tab Selector: Upload vs Paste */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setImportTab("file")}
                  className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    importTab === "file"
                      ? "bg-[#65C443] text-white shadow-md shadow-[#65C443]/30"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Unggah Berkas Excel (.xlsx) / CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportTab("paste")}
                  className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    importTab === "paste"
                      ? "bg-[#65C443] text-white shadow-md shadow-[#65C443]/30"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Tempel Teks (Paste)</span>
                </button>
              </div>

              {/* Tab 1: File Upload */}
              {importTab === "file" && (
                <div className="space-y-3">
                  <label
                    htmlFor="question-import-file-input"
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 hover:border-[#65C443] rounded-2xl bg-slate-50 hover:bg-emerald-50/20 cursor-pointer transition text-center group"
                  >
                    <FileSpreadsheet className="w-10 h-10 text-slate-400 group-hover:text-emerald-600 mb-2 transition" />
                    <span className="font-bold text-slate-800 text-sm">
                      {importFileName ? importFileName : "Pilih atau Drag & Drop Berkas Excel (.xlsx / .xls) atau CSV Soal"}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Mendukung format berkas Excel .xlsx, .xls, atau .csv
                    </span>
                    <input
                      id="question-import-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv,.txt,.json"
                      onChange={handleImportFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Tab 2: Paste Raw CSV/JSON */}
              {importTab === "paste" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tempelkan data teks CSV (dengan baris header) atau array JSON di bawah:</span>
                    <button
                      type="button"
                      onClick={() => handleRawTextChange("")}
                      className="text-slate-500 hover:text-slate-700 font-mono text-[10px]"
                    >
                      Bersihkan
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={importRawText}
                    onChange={(e) => handleRawTextChange(e.target.value)}
                    placeholder="Tipe Soal,Pertanyaan,Opsi A,Opsi B,Opsi C,Opsi D,Opsi E,Kunci Jawaban,Poin,Tingkat Kesulitan,URL Gambar,Pembahasan&#10;single_choice,Berapa hasil 2+2?,3,4,5,6,,B,1,easy,,Dua ditambah dua adalah empat."
                    className="w-full p-3.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-mono text-[11px] focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              )}

              {/* Error & Success Messages */}
              {importError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="leading-relaxed">{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="leading-relaxed">{importSuccess}</span>
                </div>
              )}

              {/* Parsed Preview Section */}
              {parsedQuestions.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-xs">
                        Pratinjau Hasil Pembacaan: {parsedQuestions.length} Soal Terdeteksi
                      </h4>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        {parsedQuestions.filter((q) => q.isValid).length} Siap Diimpor
                      </span>
                      {parsedQuestions.some((q) => !q.isValid) && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          {parsedQuestions.filter((q) => !q.isValid).length} Perlu Penyesuaian
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Type Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500">PG Tunggal:</span>
                      <strong className="text-slate-900 font-mono">
                        {parsedQuestions.filter((q) => q.type === "single_choice").length}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500">PG Kompleks:</span>
                      <strong className="text-slate-900 font-mono">
                        {parsedQuestions.filter((q) => q.type === "multi_select").length}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500">Benar / Salah:</span>
                      <strong className="text-slate-900 font-mono">
                        {parsedQuestions.filter((q) => q.type === "true_false").length}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500">Isian Singkat:</span>
                      <strong className="text-slate-900 font-mono">
                        {parsedQuestions.filter((q) => q.type === "short_answer").length}
                      </strong>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500">Esai / Uraian:</span>
                      <strong className="text-slate-900 font-mono">
                        {parsedQuestions.filter((q) => q.type === "essay").length}
                      </strong>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3 w-28">Tipe</th>
                          <th className="py-2.5 px-3">Pertanyaan & Media</th>
                          <th className="py-2.5 px-3 w-48">Opsi / Kunci</th>
                          <th className="py-2.5 px-3 w-20 text-center">Poin</th>
                          <th className="py-2.5 px-3 w-28 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {parsedQuestions.map((q, qIdx) => (
                          <tr key={q.id || qIdx} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{qIdx + 1}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] uppercase font-bold">
                                {q.type.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 space-y-1">
                              <div className="text-slate-900 line-clamp-2">{q.text}</div>
                              {q.imageUrl && (
                                <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-mono">
                                  <ImageIcon className="w-3 h-3" />
                                  <span className="truncate max-w-xs">{q.imageUrl}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 space-y-0.5">
                              {q.type === "single_choice" || q.type === "multi_select" ? (
                                <div>
                                  <div className="text-slate-800">{q.options?.length || 0} Opsi</div>
                                  <div className="text-[#0D274C] font-mono text-[10px]">
                                    Kunci: {q.options?.filter((o: any) => o.isCorrect).map((o: any) => o.label).join(", ") || "-"}
                                  </div>
                                </div>
                              ) : (
                                <div className="font-mono text-[#0D274C] text-[10px] truncate max-w-[180px]">
                                  {q.answerKey || "-"}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-800 font-bold">{q.points}</td>
                            <td className="py-2.5 px-3 text-center">
                              {q.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px]">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Valid</span>
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-amber-600 text-[10px]"
                                  title={q.warning || "Format tidak valid"}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Cek Kunci</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Tekan tombol <kbd className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">ESC</kbd> untuk menutup
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={importing || parsedQuestions.filter((q) => q.isValid).length === 0}
                  onClick={handleExecuteImport}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white font-bold cursor-pointer shadow-sm flex items-center gap-2 transition"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {importing
                      ? "Mengimpor Soal..."
                      : `Impor ${parsedQuestions.filter((q) => q.isValid).length} Butir Soal`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
