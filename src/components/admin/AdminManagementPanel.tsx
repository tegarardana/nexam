"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AdminSidebar, { AdminTab } from "@/components/admin/AdminSidebar";
import Header from "@/components/layout/Header";
import {
  GraduationCap,
  BookOpen,
  Calendar,
  Layers,
  History,
  Plus,
  Upload,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  ShieldAlert,
  UserCheck,
  Tag,
  Briefcase,
  UserX,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Info,
  CheckSquare,
  Square,
  Trash2,
  Filter,
  ArrowUpRight,
  Users,
  Pencil,
  Download,
  Key,
  FolderArchive,
  FileSpreadsheet,
  ShieldCheck,
  LayoutDashboard,
  Activity,
  FileQuestion,
} from "lucide-react";
import TeacherExaminationPanel from "@/components/teacher/TeacherExaminationPanel";
import * as XLSX from "xlsx";

interface AdminStats {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalMajors: number;
}

async function safeFetchJson(url: string, options?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, ...data };
    }
    const text = await res.text();
    return {
      ok: res.ok,
      success: res.ok,
      status: res.status,
      error: res.ok ? undefined : text.slice(0, 200) || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      success: false,
      status: 0,
      error: err.message || "Network error",
    };
  }
}

export default function AdminManagementPanel({
  initialStats,
  activeYearId,
  activeYearName,
  activeSemesterName,
  user,
}: {
  initialStats: AdminStats;
  activeYearId: string | null;
  activeYearName?: string | null;
  activeSemesterName?: string | null;
  user?: {
    username: string;
    displayName: string;
    roles: string[];
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Sidebar & Responsive State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Tab State (Default: Dashboard)
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams.toString());
    if (tab === "dashboard") {
      newParams.delete("tab");
    } else {
      newParams.set("tab", tab);
    }
    const newUrl = newParams.toString() ? `/admin?${newParams.toString()}` : "/admin";
    router.replace(newUrl, { scroll: false });
  };

  // User Management State - Guru
  const [userTeacherSearch, setUserTeacherSearch] = useState("");
  const [userTeacherStatusFilter, setUserTeacherStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUserTeacherIds, setSelectedUserTeacherIds] = useState<string[]>([]);
  const [userTeacherBulkLoading, setUserTeacherBulkLoading] = useState(false);

  // User Management State - Siswa
  const [userStudentSearch, setUserStudentSearch] = useState("");
  const [userStudentClassFilter, setUserStudentClassFilter] = useState("all");
  const [userStudentStatusFilter, setUserStudentStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUserStudentIds, setSelectedUserStudentIds] = useState<string[]>([]);
  const [userStudentBulkLoading, setUserStudentBulkLoading] = useState(false);

  // Bank Soal Search State
  const [qbSearchTerm, setQbSearchTerm] = useState("");
  const [qbCategoryFilter, setQbCategoryFilter] = useState("all");

  const getTabCategory = (tab: AdminTab): string => {
    switch (tab) {
      case "academic_years":
      case "subjects":
      case "majors":
      case "students":
      case "classes":
      case "teachers":
        return "Data Umum";
      case "question_banks":
        return "Data Ujian";
      case "exam_status":
      case "exam_results":
      case "exam_analysis":
      case "exam_grades":
      case "examinations":
        return "Pelaksanaan Ujian";
      case "user_teachers":
      case "user_students":
      case "admins":
        return "Pengaturan > User Management";
      case "audit":
        return "Pengaturan > Log Sistem";
      default:
        return "Ringkasan";
    }
  };

  const getTabTitle = (tab: AdminTab): string => {
    switch (tab) {
      case "academic_years":
        return "Tahun Pelajaran";
      case "subjects":
        return "Mata Pelajaran";
      case "majors":
        return "Program Keahlian / Jurusan";
      case "students":
        return "Data Akademik Siswa";
      case "classes":
        return "Rombel & Kelas";
      case "teachers":
        return "Data Tenaga Pendidik / Guru";
      case "question_banks":
        return "Bank Soal Ujian";
      case "exam_status":
        return "Status Siswa (Monitoring Ujian)";
      case "exam_results":
        return "Hasil Ujian Peserta";
      case "exam_analysis":
        return "Analisis Butir Soal";
      case "exam_grades":
        return "Rekap Nilai Siswa";
      case "examinations":
        return "Jadwal & Pelaksanaan Ujian";
      case "user_teachers":
        return "User Management (Guru)";
      case "user_students":
        return "User Management (Siswa)";
      case "admins":
        return "Manajemen Administrator";
      case "audit":
        return "Log Audit Sistem";
      default:
        return "Dashboard";
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean, roleType: "teacher" | "student") => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateType: "generic",
          isActive: !currentStatus,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (roleType === "teacher") {
          fetchTeachers();
        } else {
          fetchStudents();
        }
      } else {
        alert(json.error || "Gagal mengubah status akun.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  const handleBulkUserStatus = async (userIds: string[], action: "activate" | "deactivate", roleType: "teacher" | "student") => {
    if (userIds.length === 0) return;
    const actionLabel = action === "activate" ? "mengaktifkan" : "menonaktifkan";
    if (!confirm(`Yakin ingin ${actionLabel} ${userIds.length} akun terpilih?`)) return;

    if (roleType === "teacher") setUserTeacherBulkLoading(true);
    else setUserStudentBulkLoading(true);

    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          userIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (roleType === "teacher") {
          setSelectedUserTeacherIds([]);
          fetchTeachers();
        } else {
          setSelectedUserStudentIds([]);
          fetchStudents();
        }
      } else {
        alert(json.error || "Gagal memproses aksi massal.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    } finally {
      if (roleType === "teacher") setUserTeacherBulkLoading(false);
      else setUserStudentBulkLoading(false);
    }
  };
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userDropdownPos, setUserDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const userBtnRef = useRef<HTMLButtonElement>(null);
  const tabsTrackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabScroll = () => {
    if (!tabsTrackRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = tabsTrackRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  };

  useEffect(() => {
    checkTabScroll();
    const el = tabsTrackRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkTabScroll);
    window.addEventListener("resize", checkTabScroll);
    const timer = setTimeout(checkTabScroll, 200);
    return () => {
      el.removeEventListener("scroll", checkTabScroll);
      window.removeEventListener("resize", checkTabScroll);
      clearTimeout(timer);
    };
  }, []);

  // Close floating user dropdown on any outside scroll
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleScroll = () => setUserDropdownOpen(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [userDropdownOpen]);

  const toggleUserDropdown = () => {
    if (!userDropdownOpen && userBtnRef.current) {
      const rect = userBtnRef.current.getBoundingClientRect();
      setUserDropdownPos({
        top: rect.bottom + 6,
        left: rect.left,
      });
    }
    setUserDropdownOpen((prev) => !prev);
  };

  // Students state
  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentNis, setNewStudentNis] = useState("");
  const [newStudentNisn, setNewStudentNisn] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentUsername, setNewStudentUsername] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");

  // Teachers state
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [newTeacherNip, setNewTeacherNip] = useState("");
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherUsername, setNewTeacherUsername] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherHomeroomClassId, setNewTeacherHomeroomClassId] = useState("");

  // Bulk Selection & Action State
  const [selectedStudentRowIds, setSelectedStudentRowIds] = useState<string[]>([]);
  const [selectedTeacherRowIds, setSelectedTeacherRowIds] = useState<string[]>([]);
  const [userBulkActionLoading, setUserBulkActionLoading] = useState(false);

  // Edit Student Modal State
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentGender, setEditStudentGender] = useState("");
  const [editStudentNis, setEditStudentNis] = useState("");
  const [editStudentNisn, setEditStudentNisn] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentUsername, setEditStudentUsername] = useState("");
  const [editStudentPassword, setEditStudentPassword] = useState("");
  const [editStudentIsActive, setEditStudentIsActive] = useState(true);
  const [editStudentSubmitting, setEditStudentSubmitting] = useState(false);

  // Edit Teacher Profile Modal State
  const [showEditTeacherProfileModal, setShowEditTeacherProfileModal] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState("");
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherTitle, setEditTeacherTitle] = useState("");
  const [editTeacherNip, setEditTeacherNip] = useState("");
  const [editTeacherNuptk, setEditTeacherNuptk] = useState("");
  const [editTeacherGender, setEditTeacherGender] = useState("");
  const [editTeacherEmail, setEditTeacherEmail] = useState("");
  const [editTeacherUsername, setEditTeacherUsername] = useState("");
  const [editTeacherPassword, setEditTeacherPassword] = useState("");
  const [editTeacherIsActive, setEditTeacherIsActive] = useState(true);
  const [editTeacherProfileSubmitting, setEditTeacherProfileSubmitting] = useState(false);

  // Edit Teacher Duty (Jabatan & Penugasan Mengajar) Modal State
  const [showEditTeacherDutyModal, setShowEditTeacherDutyModal] = useState(false);
  const [editTeacherDutyTeacherName, setEditTeacherDutyTeacherName] = useState("");
  const [editTeacherPosition, setEditTeacherPosition] = useState("Guru");
  const [editTeacherHomeroomClassId, setEditTeacherHomeroomClassId] = useState("");
  const [editTeacherTeachingAssignments, setEditTeacherTeachingAssignments] = useState<
    Array<{ subjectId: string; classGroupIds: string[] }>
  >([]);
  const [editTeacherDutySubmitting, setEditTeacherDutySubmitting] = useState(false);

  // Administrators state
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminUsername, setEditAdminUsername] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editAdminIsActive, setEditAdminIsActive] = useState(true);

  // Bulk Import State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkImportType, setBulkImportType] = useState<"student" | "teacher">("student");
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkExcelFile, setBulkExcelFile] = useState<File | null>(null);
  const [bulkExcelFileName, setBulkExcelFileName] = useState("");
  const [bulkExcelRows, setBulkExcelRows] = useState<any[]>([]);
  const [bulkPreviewData, setBulkPreviewData] = useState<any | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Academic Years & Semesters state
  const [years, setYears] = useState<any[]>([]);
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearName, setNewYearName] = useState("");
  const [newYearStart, setNewYearStart] = useState("");
  const [newYearEnd, setNewYearEnd] = useState("");
  const [newYearStatus, setNewYearStatus] = useState("draft");

  // Classes & Majors state
  const [classes, setClasses] = useState<any[]>([]);
  const [majors, setMajors] = useState<any[]>([]);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassGrade, setNewClassGrade] = useState("10");
  const [newClassMajorId, setNewClassMajorId] = useState("");
  const [newClassHomeroomTeacherId, setNewClassHomeroomTeacherId] = useState("");

  // Class Bulk Student Update Modal state
  const [showClassBulkUpdateModal, setShowClassBulkUpdateModal] = useState(false);
  const [selectedClassForBulk, setSelectedClassForBulk] = useState<any | null>(null);
  const [classBulkTab, setClassBulkTab] = useState<"password" | "status" | "batch" | "reupload">("password");
  const [classBulkPassword, setClassBulkPassword] = useState("");
  const [classBulkStudents, setClassBulkStudents] = useState<any[]>([]);
  const [classBulkLoading, setClassBulkLoading] = useState(false);
  const [classBulkSubmitting, setClassBulkSubmitting] = useState(false);
  const [classBulkMessage, setClassBulkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [classCsvFileName, setClassCsvFileName] = useState("");
  const [classCsvMatchedStudents, setClassCsvMatchedStudents] = useState<any[] | null>(null);
  const [classCsvUnmatchedCount, setClassCsvUnmatchedCount] = useState(0);

  // Majors Customization Modal state
  const [showManageMajorsModal, setShowManageMajorsModal] = useState(false);
  const [newMajorName, setNewMajorName] = useState("");
  const [newMajorCode, setNewMajorCode] = useState("");
  const [newMajorDesc, setNewMajorDesc] = useState("");
  const [majorSubmitting, setMajorSubmitting] = useState(false);

  // Kenaikan Kelas (Class Promotion) state (Semester Ganjil only)
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [sourceYearForPromotion, setSourceYearForPromotion] = useState("");
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);

  // Class Students Management (Modal)
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<any | null>(null);
  const [classModalTab, setClassModalTab] = useState<"current" | "transfer">("current");
  const [classEnrollments, setClassEnrollments] = useState<any[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [classStudentsLoading, setClassStudentsLoading] = useState(false);

  // Dual-Listbox / Multi-assign state
  const [selectedStudentIdsToAssign, setSelectedStudentIdsToAssign] = useState<string[]>([]);
  const [leftBoxSearch, setLeftBoxSearch] = useState("");
  const [selectedEnrollmentIdsToRemove, setSelectedEnrollmentIdsToRemove] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Subjects & Custom Categories state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectCategories, setSubjectCategories] = useState<any[]>([]);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);

  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCategoryId, setNewSubjectCategoryId] = useState("");
  const [newSubjectMajorId, setNewSubjectMajorId] = useState(""); // empty = umum
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryCode, setNewCategoryCode] = useState("");

  // Subjects Catalog Filtering
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectMajorFilter, setSubjectMajorFilter] = useState("all");
  const [subjectCategoryFilter, setSubjectCategoryFilter] = useState("all");

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  // Generic Form Submitting & Error
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Students
  const fetchStudents = async () => {
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({ role: "student" });
      if (studentSearch) params.append("search", studentSearch);
      const json = await safeFetchJson(`/api/users?${params.toString()}`);
      if (json.success) setStudents(json.data);
    } finally {
      setStudentsLoading(false);
    }
  };

  // Fetch Teachers
  const fetchTeachers = async () => {
    setTeachersLoading(true);
    try {
      const params = new URLSearchParams({ role: "teacher" });
      if (teacherSearch) params.append("search", teacherSearch);
      const json = await safeFetchJson(`/api/users?${params.toString()}`);
      if (json.success) setTeachers(json.data);
    } finally {
      setTeachersLoading(false);
    }
  };

  // Fetch Admins
  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const params = new URLSearchParams({ role: "administrator" });
      if (adminSearch) params.append("search", adminSearch);
      const json = await safeFetchJson(`/api/users?${params.toString()}`);
      if (json.success) setAdmins(json.data);
    } finally {
      setAdminsLoading(false);
    }
  };

  // Fetch Years
  const fetchYears = async () => {
    const json = await safeFetchJson("/api/academic/years");
    if (json.success) setYears(json.data);
  };

  // Fetch Classes & Majors (filtered by active year so new year starts clean)
  const fetchClassesAndMajors = async () => {
    const classUrl = activeYearId
      ? `/api/academic/classes?academicYearId=${activeYearId}`
      : "/api/academic/classes";
    const [jsonC, jsonM] = await Promise.all([
      safeFetchJson(classUrl),
      safeFetchJson("/api/academic/majors"),
    ]);
    if (jsonC.success) setClasses(jsonC.data);
    if (jsonM.success) setMajors(jsonM.data);
  };

  // Fetch Subjects & Categories
  const fetchSubjectsAndCategories = async () => {
    const [jsonS, jsonC, jsonM] = await Promise.all([
      safeFetchJson("/api/academic/subjects"),
      safeFetchJson("/api/academic/subject-categories"),
      safeFetchJson("/api/academic/majors"),
    ]);
    if (jsonS.success) setSubjects(jsonS.data);
    if (jsonC.success) setSubjectCategories(jsonC.data);
    if (jsonM.success) setMajors(jsonM.data);
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async (query?: string) => {
    setAuditLoading(true);
    try {
      const q = query !== undefined ? query : auditSearch;
      const url = q ? `/api/audit-logs?actor=${encodeURIComponent(q)}` : "/api/audit-logs";
      const json = await safeFetchJson(url);
      if (json.success) setAuditLogs(json.data);
    } finally {
      setAuditLoading(false);
    }
  };

  // Handle Bulk User Action (Activate, Deactivate, Delete)
  const handleBulkUserAction = async (
    role: "student" | "teacher",
    action: "activate" | "deactivate" | "delete"
  ) => {
    const userIds = role === "student" ? selectedStudentRowIds : selectedTeacherRowIds;
    if (userIds.length === 0) return;

    const actionText =
      action === "activate"
        ? "mengaktifkan"
        : action === "deactivate"
        ? "menonaktifkan"
        : "menghapus / mengarsipkan";

    if (
      !confirm(
        `Apakah Anda yakin ingin ${actionText} ${userIds.length} akun ${
          role === "student" ? "siswa" : "guru"
        } terpilih?`
      )
    ) {
      return;
    }

    setUserBulkActionLoading(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds, action }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message || "Aksi massal berhasil dijalankan.");
        if (role === "student") {
          setSelectedStudentRowIds([]);
          fetchStudents();
        } else {
          setSelectedTeacherRowIds([]);
          fetchTeachers();
        }
      } else {
        alert(json.error || "Gagal memproses aksi massal.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    } finally {
      setUserBulkActionLoading(false);
    }
  };

  // Open Edit Student Modal
  const openEditStudentModal = (student: any) => {
    setEditingStudentId(student.id);
    setEditStudentName(student.displayName || "");
    setEditStudentGender(student.gender || "");
    setEditStudentNis(student.nis || "");
    setEditStudentNisn(student.nisn || "");
    setEditStudentEmail(student.email || "");
    setEditStudentUsername(student.username || "");
    setEditStudentPassword("");
    setEditStudentIsActive(student.isActive ?? true);
    setFormError(null);
    setShowEditStudentModal(true);
  };

  // Submit Edit Student
  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditStudentSubmitting(true);
    setFormError(null);

    const payload: any = {
      updateType: "student",
      displayName: editStudentName,
      username: editStudentUsername,
      gender: editStudentGender || null,
      nis: editStudentNis || null,
      nisn: editStudentNisn || null,
      email: editStudentEmail || null,
      isActive: editStudentIsActive,
    };
    if (editStudentPassword.trim() !== "") {
      payload.password = editStudentPassword;
    }

    try {
      const res = await fetch(`/api/users/${editingStudentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setShowEditStudentModal(false);
        fetchStudents();
      } else {
        setFormError(json.error || "Gagal menyimpan perubahan siswa.");
      }
    } catch {
      setFormError("Kesalahan jaringan.");
    } finally {
      setEditStudentSubmitting(false);
    }
  };

  // Open Edit Teacher Profile Modal
  const openEditTeacherProfileModal = (teacher: any) => {
    setEditingTeacherId(teacher.id);
    setEditTeacherName(teacher.displayName || "");
    setEditTeacherTitle(teacher.title || "");
    setEditTeacherNip(teacher.nip || "");
    setEditTeacherNuptk(teacher.nuptk || "");
    setEditTeacherGender(teacher.gender || "");
    setEditTeacherEmail(teacher.email || "");
    setEditTeacherUsername(teacher.username || "");
    setEditTeacherPassword("");
    setEditTeacherIsActive(teacher.isActive ?? true);
    setFormError(null);
    setShowEditTeacherProfileModal(true);
  };

  // Submit Edit Teacher Profile
  const handleSaveEditTeacherProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditTeacherProfileSubmitting(true);
    setFormError(null);

    const payload: any = {
      updateType: "teacher_profile",
      displayName: editTeacherName,
      title: editTeacherTitle || null,
      nip: editTeacherNip || null,
      nuptk: editTeacherNuptk || null,
      gender: editTeacherGender || null,
      email: editTeacherEmail || null,
      username: editTeacherUsername,
      isActive: editTeacherIsActive,
    };
    if (editTeacherPassword.trim() !== "") {
      payload.password = editTeacherPassword;
    }

    try {
      const res = await fetch(`/api/users/${editingTeacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setShowEditTeacherProfileModal(false);
        fetchTeachers();
      } else {
        setFormError(json.error || "Gagal menyimpan profil guru.");
      }
    } catch {
      setFormError("Kesalahan jaringan.");
    } finally {
      setEditTeacherProfileSubmitting(false);
    }
  };

  // Open Edit Teacher Duty Modal
  const openEditTeacherDutyModal = async (teacher: any) => {
    setEditingTeacherId(teacher.id);
    setEditTeacherDutyTeacherName(teacher.displayName);
    setEditTeacherPosition(teacher.position || "Guru");
    setEditTeacherHomeroomClassId(teacher.homeroomClassId || "");
    fetchClassesAndMajors();
    fetchSubjectsAndCategories();

    // Map existing assignments
    const map = new Map<string, string[]>();
    (teacher.teachingAssignments || []).forEach((ta: any) => {
      const existing = map.get(ta.subjectId) || [];
      if (!existing.includes(ta.classGroupId)) {
        existing.push(ta.classGroupId);
      }
      map.set(ta.subjectId, existing);
    });

    const initAssignments: Array<{ subjectId: string; classGroupIds: string[] }> = [];
    map.forEach((classGroupIds, subjectId) => {
      initAssignments.push({ subjectId, classGroupIds });
    });

    setEditTeacherTeachingAssignments(initAssignments);
    setFormError(null);
    setShowEditTeacherDutyModal(true);
  };

  // Submit Edit Teacher Duty
  const handleSaveEditTeacherDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditTeacherDutySubmitting(true);
    setFormError(null);

    const payload = {
      updateType: "teacher_duty",
      position: editTeacherPosition,
      homeroomClassId:
        editTeacherPosition === "Wali Kelas" ? editTeacherHomeroomClassId || null : null,
      teachingAssignments: editTeacherTeachingAssignments,
    };

    try {
      const res = await fetch(`/api/users/${editingTeacherId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setShowEditTeacherDutyModal(false);
        fetchTeachers();
        fetchClassesAndMajors();
      } else {
        setFormError(json.error || "Gagal menyimpan penugasan guru.");
      }
    } catch {
      setFormError("Kesalahan jaringan.");
    } finally {
      setEditTeacherDutySubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "students" || activeTab === "user_students") fetchStudents();
    if (activeTab === "teachers" || activeTab === "user_teachers") fetchTeachers();
    if (activeTab === "admins") fetchAdmins();
    if (activeTab === "academic_years") fetchYears();
    if (activeTab === "classes" || activeTab === "majors") {
      fetchClassesAndMajors();
      fetchTeachers();
      fetchYears();
    }
    if (activeTab === "subjects" || activeTab === "question_banks") {
      fetchSubjectsAndCategories();
    }
    if (activeTab === "audit") fetchAuditLogs();
    if (
      activeTab === "examinations" ||
      activeTab === "exam_status" ||
      activeTab === "exam_results" ||
      activeTab === "exam_analysis" ||
      activeTab === "exam_grades"
    ) {
      fetchSubjectsAndCategories();
      fetchYears();
      fetchClassesAndMajors();
      fetchTeachers();
    }
  }, [activeTab, activeYearId]);

  // Global Escape key listener to close whichever modal/popup is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showClassBulkUpdateModal) {
          setShowClassBulkUpdateModal(false);
          return;
        }
        if (selectedClassForStudents) {
          setSelectedClassForStudents(null);
          return;
        }
        if (showEditTeacherDutyModal) {
          setShowEditTeacherDutyModal(false);
          return;
        }
        if (showEditTeacherProfileModal) {
          setShowEditTeacherProfileModal(false);
          return;
        }
        if (showEditAdminModal) {
          setShowEditAdminModal(false);
          return;
        }
        if (showEditStudentModal) {
          setShowEditStudentModal(false);
          return;
        }
        if (showAddStudentModal) {
          setShowAddStudentModal(false);
          return;
        }
        if (showAddTeacherModal) {
          setShowAddTeacherModal(false);
          return;
        }
        if (showAddAdminModal) {
          setShowAddAdminModal(false);
          return;
        }
        if (showBulkModal) {
          setShowBulkModal(false);
          return;
        }
        if (showAddClassModal) {
          setShowAddClassModal(false);
          return;
        }
        if (showManageMajorsModal) {
          setShowManageMajorsModal(false);
          return;
        }
        if (showPromoteModal) {
          setShowPromoteModal(false);
          return;
        }
        if (showAddYearModal) {
          setShowAddYearModal(false);
          return;
        }
        if (showAddSubjectModal) {
          setShowAddSubjectModal(false);
          return;
        }
        if (showCategoryManagerModal) {
          setShowCategoryManagerModal(false);
          return;
        }
        if (userDropdownOpen) {
          setUserDropdownOpen(false);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showClassBulkUpdateModal,
    selectedClassForStudents,
    showEditTeacherDutyModal,
    showEditTeacherProfileModal,
    showEditStudentModal,
    showAddStudentModal,
    showAddTeacherModal,
    showAddAdminModal,
    showEditAdminModal,
    showBulkModal,
    showAddClassModal,
    showManageMajorsModal,
    showPromoteModal,
    showAddYearModal,
    showAddSubjectModal,
    showCategoryManagerModal,
    userDropdownOpen,
  ]);

  // Open class bulk update modal
  const openClassBulkUpdateModal = async (classGroup: any) => {
    setSelectedClassForBulk(classGroup);
    setShowClassBulkUpdateModal(true);
    setClassBulkTab("password");
    setClassBulkPassword("");
    setClassBulkMessage(null);
    setClassCsvFileName("");
    setClassCsvMatchedStudents(null);
    setClassCsvUnmatchedCount(0);
    setClassBulkLoading(true);
    try {
      const res = await safeFetchJson(`/api/academic/enrollments?classGroupId=${classGroup.id}`);
      if (res.success && res.data) {
        const mapped = res.data.map((e: any) => ({
          id: e.student.id,
          displayName: e.student.displayName,
          username: e.student.username,
          nis: e.student.nis || "",
          nisn: e.student.nisn || "",
          rawPassword: e.student.rawPassword || "",
          newPassword: "",
          isActive: e.student.isActive,
        }));
        setClassBulkStudents(mapped);
      } else {
        setClassBulkStudents([]);
      }
    } finally {
      setClassBulkLoading(false);
    }
  };

  // Submit Class Bulk Password Reset
  const handleClassBulkSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForBulk || !classBulkPassword.trim()) return;
    setClassBulkSubmitting(true);
    setClassBulkMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${selectedClassForBulk.id}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_password",
          password: classBulkPassword,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setClassBulkMessage({ type: "success", text: json.message || "Password berhasil direset seragam!" });
        setClassBulkStudents((prev) =>
          prev.map((s) => ({ ...s, rawPassword: classBulkPassword, newPassword: "" }))
        );
        setClassBulkPassword("");
      } else {
        setClassBulkMessage({ type: "error", text: json.error || "Gagal mereset password." });
      }
    } catch {
      setClassBulkMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setClassBulkSubmitting(false);
    }
  };

  // Submit Class Bulk Status Toggle
  const handleClassBulkSetStatus = async (status: boolean) => {
    if (!selectedClassForBulk) return;
    setClassBulkSubmitting(true);
    setClassBulkMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${selectedClassForBulk.id}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          isActive: status,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setClassBulkMessage({ type: "success", text: json.message || "Status siswa berhasil diubah!" });
        setClassBulkStudents((prev) => prev.map((s) => ({ ...s, isActive: status })));
      } else {
        setClassBulkMessage({ type: "error", text: json.error || "Gagal mengubah status." });
      }
    } catch {
      setClassBulkMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setClassBulkSubmitting(false);
    }
  };

  // Submit Class Batch Save (Inline editing or edited list)
  const handleClassBatchSave = async () => {
    if (!selectedClassForBulk || classBulkStudents.length === 0) return;
    setClassBulkSubmitting(true);
    setClassBulkMessage(null);
    try {
      const payloadStudents = classBulkStudents.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        username: s.username,
        nis: s.nis,
        nisn: s.nisn,
        isActive: s.isActive,
        password: s.newPassword && s.newPassword.trim() !== "" ? s.newPassword : undefined,
      }));

      const res = await fetch(`/api/academic/classes/${selectedClassForBulk.id}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_update",
          students: payloadStudents,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setClassBulkMessage({ type: "success", text: json.message || "Data siswa sekelas berhasil diperbarui!" });
        setClassBulkStudents((prev) =>
          prev.map((s) => ({
            ...s,
            rawPassword: s.newPassword ? s.newPassword : s.rawPassword,
            newPassword: "",
          }))
        );
      } else {
        setClassBulkMessage({ type: "error", text: json.error || "Gagal memperbarui data siswa." });
      }
    } catch {
      setClassBulkMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setClassBulkSubmitting(false);
    }
  };

  // Handle CSV File Upload for Class Bulk Re-upload
  const handleClassCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setClassCsvFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setClassBulkMessage({ type: "error", text: "File CSV kosong atau format header tidak sesuai." });
        return;
      }

      // Match rows to existing classBulkStudents
      const matched: any[] = [];
      let unmatched = 0;

      rows.forEach((row: any) => {
        const rowNis = (row.NIS || row.nis || "").trim();
        const rowNisn = (row.NISN || row.nisn || "").trim();
        const rowUsername = (row.Username || row.username || row["Username Login"] || "").trim().replace(/^@/, "");
        const rowName = (row["Nama Lengkap"] || row.displayName || row.nama || row.Nama || "").trim();
        const rowPassword = (row.Password || row.password || "").trim();
        const rowStatus = (row.Status || row.status || "").trim();
        const rowGender = (row["Jenis Kelamin"] || row.gender || row.Kelamin || "").trim();

        // Find match in classBulkStudents
        const student = classBulkStudents.find((s) => {
          if (rowNis && s.nis && s.nis.trim() === rowNis) return true;
          if (rowNisn && s.nisn && s.nisn.trim() === rowNisn) return true;
          if (rowUsername && s.username.toLowerCase() === rowUsername.toLowerCase()) return true;
          if (rowName && s.displayName.toLowerCase() === rowName.toLowerCase()) return true;
          return false;
        });

        if (!student) {
          unmatched++;
          return;
        }

        const changes: string[] = [];
        const updated: any = { id: student.id };

        if (rowName && rowName !== student.displayName) {
          updated.displayName = rowName;
          changes.push(`Nama: "${student.displayName}" → "${rowName}"`);
        }
        if (rowNis !== "" && rowNis !== student.nis) {
          updated.nis = rowNis;
          changes.push(`NIS: "${student.nis}" → "${rowNis}"`);
        }
        if (rowNisn !== "" && rowNisn !== student.nisn) {
          updated.nisn = rowNisn;
          changes.push(`NISN: "${student.nisn}" → "${rowNisn}"`);
        }
        if (rowUsername && rowUsername !== student.username) {
          updated.username = rowUsername;
          changes.push(`Username: "${student.username}" → "${rowUsername}"`);
        }
        if (rowGender) {
          const gNorm = rowGender.toLowerCase().startsWith("p") ? "P" : "L";
          updated.gender = gNorm;
          changes.push(`Kelamin: ${gNorm}`);
        }
        if (rowPassword && !rowPassword.includes("Terenkripsi") && !rowPassword.includes("Belum diset") && rowPassword.length >= 6) {
          updated.password = rowPassword;
          changes.push(`Password baru`);
        }
        if (rowStatus) {
          const newStatus = !rowStatus.toLowerCase().includes("non");
          if (newStatus !== student.isActive) {
            updated.isActive = newStatus;
            changes.push(`Status: ${student.isActive ? "Aktif" : "Nonaktif"} → ${newStatus ? "Aktif" : "Nonaktif"}`);
          }
        }

        matched.push({
          id: student.id,
          original: student,
          updated,
          hasChanges: changes.length > 0,
          changes,
        });
      });

      setClassCsvMatchedStudents(matched);
      setClassCsvUnmatchedCount(unmatched);
      const changeCount = matched.filter((m) => m.hasChanges).length;
      setClassBulkMessage({
        type: "success",
        text: `Berhasil memproses file CSV: ${matched.length} siswa cocok (${changeCount} siswa terdeteksi memiliki perubahan data).`,
      });
    } catch {
      setClassBulkMessage({ type: "error", text: "Gagal membaca atau memproses file CSV." });
    }
  };

  // Apply Changes from Re-uploaded CSV
  const handleApplyClassCsvChanges = async () => {
    if (!selectedClassForBulk || !classCsvMatchedStudents) return;
    const toUpdate = classCsvMatchedStudents
      .filter((m) => m.hasChanges)
      .map((m) => m.updated);

    if (toUpdate.length === 0) {
      setClassBulkMessage({ type: "success", text: "Tidak ada perubahan data yang perlu disimpan." });
      return;
    }

    setClassBulkSubmitting(true);
    setClassBulkMessage(null);
    try {
      const res = await fetch(`/api/academic/classes/${selectedClassForBulk.id}/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_update",
          students: toUpdate,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setClassBulkMessage({
          type: "success",
          text: json.message || `Berhasil memperbarui ${toUpdate.length} siswa dari file CSV!`,
        });
        setClassBulkStudents((prev) =>
          prev.map((s) => {
            const m = classCsvMatchedStudents.find((item) => item.id === s.id);
            if (m && m.hasChanges) {
              return {
                ...s,
                ...m.updated,
                rawPassword: m.updated.password ? m.updated.password : s.rawPassword,
              };
            }
            return s;
          })
        );
        setClassCsvMatchedStudents(null);
        setClassCsvFileName("");
      } else {
        setClassBulkMessage({ type: "error", text: json.error || "Gagal menerapkan pembaruan dari CSV." });
      }
    } catch {
      setClassBulkMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setClassBulkSubmitting(false);
    }
  };

  // Open class student management (reset transfer and checkbox state)
  const openClassStudentsModal = async (classGroup: any) => {
    setSelectedClassForStudents(classGroup);
    setClassModalTab("current");
    setSelectedStudentIdsToAssign([]);
    setSelectedEnrollmentIdsToRemove([]);
    setLeftBoxSearch("");
    setClassStudentsLoading(true);
    try {
      const [jsonE, jsonU] = await Promise.all([
        safeFetchJson(`/api/academic/enrollments?classGroupId=${classGroup.id}`),
        safeFetchJson(
          `/api/academic/enrollments?unassigned=true&academicYearId=${classGroup.academicYearId}`
        ),
      ]);
      if (jsonE.success) setClassEnrollments(jsonE.data);
      if (jsonU.success) setUnassignedStudents(jsonU.data);
    } finally {
      setClassStudentsLoading(false);
    }
  };

  // Refresh Class Students Modal data after changes
  const refreshClassModalData = async () => {
    if (!selectedClassForStudents) return;
    setClassStudentsLoading(true);
    try {
      const [jsonE, jsonU] = await Promise.all([
        safeFetchJson(`/api/academic/enrollments?classGroupId=${selectedClassForStudents.id}`),
        safeFetchJson(
          `/api/academic/enrollments?unassigned=true&academicYearId=${selectedClassForStudents.academicYearId}`
        ),
      ]);
      if (jsonE.success) setClassEnrollments(jsonE.data);
      if (jsonU.success) setUnassignedStudents(jsonU.data);
      setSelectedStudentIdsToAssign([]);
      setSelectedEnrollmentIdsToRemove([]);
    } finally {
      setClassStudentsLoading(false);
    }
  };

  // Batch Assign Students (Dual-Listbox Right Box Confirmation)
  const handleBatchAssignStudents = async () => {
    if (selectedStudentIdsToAssign.length === 0 || !selectedClassForStudents) return;
    setBatchActionLoading(true);
    try {
      const res = await fetch("/api/academic/enrollments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIdsToAssign,
          targetClassGroupId: selectedClassForStudents.id,
          targetAcademicYearId: selectedClassForStudents.academicYearId,
          status: "active",
        }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message || `Berhasil menempatkan ${selectedStudentIdsToAssign.length} siswa.`);
        await refreshClassModalData();
        fetchClassesAndMajors();
        setClassModalTab("current");
      } else {
        alert(json.error || "Gagal memasukkan siswa terpilih.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch Remove Students from Class (Multi-checkbox)
  const handleBatchRemoveStudents = async () => {
    if (selectedEnrollmentIdsToRemove.length === 0) return;
    if (
      !confirm(
        `Keluarkan ${selectedEnrollmentIdsToRemove.length} siswa terpilih dari rombel kelas ini?`
      )
    )
      return;
    setBatchActionLoading(true);
    try {
      const res = await fetch(
        `/api/academic/enrollments?ids=${selectedEnrollmentIdsToRemove.join(",")}`,
        {
          method: "DELETE",
        }
      );
      const json = await res.json();
      if (res.ok) {
        await refreshClassModalData();
        fetchClassesAndMajors();
      } else {
        alert(json.error || "Gagal mengeluarkan siswa terpilih.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Activate Academic Year (Sets others to archived & deactivates their semesters)
  const handleActivateYear = async (yearId: string) => {
    if (!confirm("Jadikan tahun ajaran ini sebagai Tahun Ajaran Aktif?")) return;
    try {
      const res = await fetch("/api/academic/years", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: yearId, status: "active" }),
      });
      if (res.ok) {
        fetchYears();
        router.refresh();
      } else {
        alert("Gagal mengaktifkan tahun ajaran.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Activate Semester
  const handleActivateSemester = async (semesterId: string) => {
    try {
      const res = await fetch("/api/academic/semesters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: semesterId, status: "active" }),
      });
      if (res.ok) {
        fetchYears();
        router.refresh();
      } else {
        alert("Gagal mengaktifkan semester.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Create Major
  const handleCreateMajor = async (e: React.FormEvent) => {
    e.preventDefault();
    setMajorSubmitting(true);
    try {
      const res = await fetch("/api/academic/majors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMajorName,
          code: newMajorCode.toUpperCase(),
          description: newMajorDesc || undefined,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setNewMajorName("");
        setNewMajorCode("");
        setNewMajorDesc("");
        fetchClassesAndMajors();
      } else {
        alert(json.error || "Gagal membuat jurusan.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    } finally {
      setMajorSubmitting(false);
    }
  };

  // Delete Major
  const handleDeleteMajor = async (id: string, name: string) => {
    if (!confirm(`Hapus program keahlian / jurusan '${name}'?`)) return;
    try {
      const res = await fetch(`/api/academic/majors?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        fetchClassesAndMajors();
      } else {
        alert(json.error || "Gagal menghapus jurusan.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Execute Bulk Promotion (Semester Ganjil only)
  const handlePromoteClasses = async () => {
    if (!sourceYearForPromotion || !activeYearId) {
      alert("Pilih tahun ajaran asal terlebih dahulu.");
      return;
    }
    setPromoteLoading(true);
    setPromoteResult(null);
    try {
      const res = await fetch("/api/academic/classes/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAcademicYearId: sourceYearForPromotion,
          targetAcademicYearId: activeYearId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setPromoteResult(json.message);
        fetchClassesAndMajors();
        router.refresh();
      } else {
        alert(json.error || "Gagal memproses kenaikan kelas.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    } finally {
      setPromoteLoading(false);
    }
  };

  // Add Single Student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nis: newStudentNis,
          nisn: newStudentNisn || undefined,
          username: newStudentUsername || newStudentNis,
          displayName: newStudentName,
          password: newStudentPassword,
          email: newStudentEmail || undefined,
          role: "student",
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Gagal membuat data siswa.");
      } else {
        setShowAddStudentModal(false);
        setNewStudentNis("");
        setNewStudentNisn("");
        setNewStudentName("");
        setNewStudentUsername("");
        setNewStudentPassword("");
        setNewStudentEmail("");
        fetchStudents();
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Add Single Teacher
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nip: newTeacherNip,
          username: newTeacherUsername || newTeacherNip,
          displayName: newTeacherName,
          password: newTeacherPassword,
          email: newTeacherEmail || undefined,
          homeroomClassId: newTeacherHomeroomClassId || undefined,
          role: "teacher",
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Gagal membuat data guru.");
      } else {
        setShowAddTeacherModal(false);
        setNewTeacherNip("");
        setNewTeacherName("");
        setNewTeacherUsername("");
        setNewTeacherPassword("");
        setNewTeacherEmail("");
        setNewTeacherHomeroomClassId("");
        fetchTeachers();
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Add Single Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newAdminUsername,
          displayName: newAdminName,
          password: newAdminPassword,
          email: newAdminEmail || undefined,
          role: "administrator",
          isActive: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Gagal membuat akun administrator.");
      } else {
        setShowAddAdminModal(false);
        setNewAdminName("");
        setNewAdminUsername("");
        setNewAdminPassword("");
        setNewAdminEmail("");
        fetchAdmins();
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const openEditAdminModal = (admin: any) => {
    setEditingAdmin(admin);
    setEditAdminName(admin.displayName || "");
    setEditAdminUsername(admin.username || "");
    setEditAdminEmail(admin.email || "");
    setEditAdminPassword("");
    setEditAdminIsActive(admin.isActive !== false);
    setFormError(null);
    setShowEditAdminModal(true);
  };

  const handleSaveEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setFormSubmitting(true);
    setFormError(null);
    try {
      const payload: any = {
        updateType: "admin",
        displayName: editAdminName,
        username: editAdminUsername,
        email: editAdminEmail || undefined,
        isActive: editAdminIsActive,
      };
      if (editAdminPassword.trim()) {
        payload.password = editAdminPassword.trim();
      }
      const res = await fetch(`/api/users/${editingAdmin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Gagal memperbarui data administrator.");
      } else {
        setShowEditAdminModal(false);
        setEditingAdmin(null);
        fetchAdmins();
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleAdminStatus = async (admin: any) => {
    try {
      const res = await fetch(`/api/users/${admin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateType: "admin",
          isActive: !admin.isActive,
        }),
      });
      const json = await res.json();
      if (json.success) {
        fetchAdmins();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // CSV Parser
  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const result: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const obj: any = {};
      headers.forEach((h, index) => {
        obj[h] = values[index] || "";
      });
      result.push(obj);
    }
    return result;
  };

  // Download Excel Template for Siswa or Guru
  const handleDownloadExcelTemplate = (type: "student" | "teacher") => {
    const wb = XLSX.utils.book_new();

    if (type === "student") {
      const headers = [
        "Nama Lengkap *",
        "Username *",
        "Password *",
        "NIS *",
        "NISN",
        "Jenis Kelamin",
        "Email",
        "Kelas",
      ];
      const sampleRows = [
        [
          "Ahmad Fauzan Pratama",
          "siswa.ahmad",
          "SiswaPass123!",
          "202601001",
          "0081234561",
          "L",
          "ahmad.fauzan@siswa.sch.id",
          "X RPL 1",
        ],
        [
          "Bela Safitri",
          "siswa.bela",
          "SiswaPass123!",
          "202601002",
          "",
          "P",
          "",
          "",
        ],
      ];
      const wsData = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

      const guideData = [
        ["PANDUAN PENGISIAN TEMPLATE EXCEL DATA SISWA NEXAM CBT"],
        [""],
        ["Kolom", "Sifat", "Keterangan Aturan"],
        ["Nama Lengkap *", "MANDATORY (Wajib)", "Nama lengkap siswa, minimal 2 karakter."],
        ["Username *", "MANDATORY (Wajib)", "Username akun login siswa (minimal 3 karakter, huruf/angka/titik/strip, tanpa spasi, wajib unik)."],
        ["Password *", "MANDATORY (Wajib)", "Kata sandi login awal siswa (minimal 6 karakter)."],
        ["NIS *", "MANDATORY (Wajib)", "Nomor Induk Siswa. Wajib diisi dan wajib unik."],
        ["NISN", "OPSIONAL", "Nomor Induk Siswa Nasional. Boleh dikosongkan. Jika diisi, wajib unik."],
        ["Jenis Kelamin", "OPSIONAL", "Isi 'L' untuk Laki-laki atau 'P' untuk Perempuan. Boleh dikosongkan."],
        ["Email", "OPSIONAL", "Alamat email aktif siswa. Boleh dikosongkan."],
        ["Kelas", "OPSIONAL", "Nama rombel/kelas siswa saat ini (contoh: 'X RPL 1'). Boleh dikosongkan."],
        [""],
        ["Catatan Penting:"],
        ["1. Kolom dengan tanda bintang (*) wajib terisi. Data tidak akan bisa diimpor jika kolom bertanda (*) kosong."],
        ["2. Kolom tanpa tanda bintang boleh dikosongkan jika data belum lengkap."],
        ["3. Jangan mengubah atau menghapus teks baris pertama (header kolom)."],
        ["4. Pastikan file disimpan dengan format .xlsx sebelum diunggah kembali ke aplikasi."],
      ];
      const wsGuide = XLSX.utils.aoa_to_sheet(guideData);

      XLSX.utils.book_append_sheet(wb, wsData, "Template Siswa");
      XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan Pengisian");
      XLSX.writeFile(wb, "template_impor_siswa_nexam.xlsx");
    } else {
      const headers = [
        "Nama Lengkap *",
        "Username *",
        "Password *",
        "NIP *",
        "NUPTK",
        "Gelar",
        "Jabatan",
        "Jenis Kelamin",
        "Email",
      ];
      const sampleRows = [
        [
          "Ahmad Fauzi",
          "guru.ahmad",
          "GuruPass123!",
          "198501012010011001",
          "1234567890123456",
          "M.Pd.",
          "Guru",
          "L",
          "ahmad.fauzi@sekolah.sch.id",
        ],
        [
          "Dewi Sartika",
          "guru.dewi",
          "GuruPass123!",
          "199002022015012002",
          "",
          "S.Pd.",
          "Wali Kelas",
          "P",
          "",
        ],
      ];
      const wsData = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

      const guideData = [
        ["PANDUAN PENGISIAN TEMPLATE EXCEL DATA GURU NEXAM CBT"],
        [""],
        ["Kolom", "Sifat", "Keterangan Aturan"],
        ["Nama Lengkap *", "MANDATORY (Wajib)", "Nama lengkap guru (tanpa gelar), minimal 2 karakter."],
        ["Username *", "MANDATORY (Wajib)", "Username akun login guru (minimal 3 karakter, huruf/angka/titik/strip, tanpa spasi, wajib unik)."],
        ["Password *", "MANDATORY (Wajib)", "Kata sandi login awal guru (minimal 6 karakter)."],
        ["NIP *", "MANDATORY (Wajib)", "Nomor Induk Pegawai. Wajib diisi dan wajib unik."],
        ["NUPTK", "OPSIONAL", "Nomor Unik Pendidik dan Tenaga Kependidikan. Boleh dikosongkan."],
        ["Gelar", "OPSIONAL", "Gelar akademik, misal: 'S.Pd.', 'M.Kom.'."],
        ["Jabatan", "OPSIONAL", "Jabatan (Guru, Wali Kelas, Kepala Sekolah, Wakil Kepala Sekolah, Bimbingan Konseling). Default: 'Guru'."],
        ["Jenis Kelamin", "OPSIONAL", "Isi 'L' untuk Laki-laki atau 'P' untuk Perempuan. Boleh dikosongkan."],
        ["Email", "OPSIONAL", "Alamat email aktif guru. Boleh dikosongkan."],
        [""],
        ["Catatan Penting:"],
        ["1. Kolom dengan tanda bintang (*) wajib terisi. Data tidak akan bisa diimpor jika kolom bertanda (*) kosong."],
        ["2. Kolom tanpa tanda bintang boleh dikosongkan jika data belum lengkap."],
        ["3. Jangan mengubah atau menghapus teks baris pertama (header kolom)."],
        ["4. Pastikan file disimpan dengan format .xlsx sebelum diunggah kembali ke aplikasi."],
      ];
      const wsGuide = XLSX.utils.aoa_to_sheet(guideData);

      XLSX.utils.book_append_sheet(wb, wsData, "Template Guru");
      XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan Pengisian");
      XLSX.writeFile(wb, "template_impor_guru_nexam.xlsx");
    }
  };

  // Handle Excel File Selected
  const handleExcelFileSelected = async (file: File) => {
    setBulkError(null);
    setBulkExcelFileName(file.name);
    setBulkExcelFile(file);
    try {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (jsonRows.length === 0) {
          setBulkError("Berkas Excel kosong atau baris data tidak terbaca.");
          setBulkExcelRows([]);
          return;
        }
        setBulkExcelRows(jsonRows);
      } else {
        const text = await file.text();
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setBulkError("Berkas CSV kosong atau format header tidak sesuai.");
          setBulkExcelRows([]);
          return;
        }
        setBulkExcelRows(rows);
      }
    } catch (err: any) {
      setBulkError("Gagal membaca berkas: " + err.message);
      setBulkExcelRows([]);
    }
  };

  // Bulk Preview
  const handleBulkPreview = async () => {
    setBulkError(null);
    setBulkLoading(true);
    try {
      let rowsToValidate = bulkExcelRows;
      if (rowsToValidate.length === 0 && bulkCsvText.trim()) {
        rowsToValidate = parseCsv(bulkCsvText);
      }

      if (rowsToValidate.length === 0) {
        setBulkError("Silakan pilih berkas Excel (.xlsx) atau tempel data terlebih dahulu.");
        setBulkLoading(false);
        return;
      }
      const activeYear = years.find((y: any) => y.status === "active");
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToValidate,
          preview: true,
          importType: bulkImportType,
          academicYearId: activeYear?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBulkError(json.error || "Validasi pratinjau gagal.");
      } else {
        setBulkPreviewData(json);
      }
    } catch {
      setBulkError("Kesalahan jaringan.");
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk Commit
  const handleBulkCommit = async () => {
    setBulkError(null);
    setBulkLoading(true);
    try {
      let rowsToCommit = bulkExcelRows;
      if (rowsToCommit.length === 0 && bulkCsvText.trim()) {
        rowsToCommit = parseCsv(bulkCsvText);
      }

      const activeYear = years.find((y: any) => y.status === "active");
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rowsToCommit,
          preview: false,
          importType: bulkImportType,
          academicYearId: activeYear?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBulkError(json.error || "Gagal mengimpor data.");
      } else {
        alert(json.message);
        setShowBulkModal(false);
        setBulkCsvText("");
        setBulkExcelRows([]);
        setBulkExcelFileName("");
        setBulkExcelFile(null);
        setBulkPreviewData(null);
        if (bulkImportType === "student") fetchStudents();
        else fetchTeachers();
      }
    } catch {
      setBulkError("Kesalahan jaringan.");
    } finally {
      setBulkLoading(false);
    }
  };

  // Create Subject Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/academic/subject-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          code: newCategoryCode || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setNewCategoryName("");
        setNewCategoryCode("");
        fetchSubjectsAndCategories();
      } else {
        alert(json.error || "Gagal menambah kategori.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Delete Subject Category
  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      const res = await fetch(`/api/academic/subject-categories?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        fetchSubjectsAndCategories();
      } else {
        alert(json.error || "Gagal menghapus kategori.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/academic/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newSubjectCode,
          name: newSubjectName,
          categoryId: newSubjectCategoryId || undefined,
          majorId: newSubjectMajorId || undefined,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowAddSubjectModal(false);
        setNewSubjectCode("");
        setNewSubjectName("");
        setNewSubjectCategoryId("");
        setNewSubjectMajorId("");
        fetchSubjectsAndCategories();
      } else {
        alert(json.error || "Gagal membuat mata pelajaran.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Create Class Group
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeYearId) {
      alert("Tidak ada tahun ajaran aktif.");
      return;
    }
    try {
      const res = await fetch("/api/academic/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClassName,
          gradeLevel: parseInt(newClassGrade, 10),
          majorId: newClassMajorId || undefined,
          academicYearId: activeYearId,
          homeroomTeacherId: newClassHomeroomTeacherId || undefined,
          isActive: true,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowAddClassModal(false);
        setNewClassName("");
        setNewClassHomeroomTeacherId("");
        fetchClassesAndMajors();
      } else {
        alert(json.error || "Gagal membuat kelas.");
      }
    } catch {
      alert("Kesalahan jaringan.");
    }
  };

  // Filter unassigned students for Left Box
  const filteredUnassignedStudents = unassignedStudents
    .filter((s) => !selectedStudentIdsToAssign.includes(s.id))
    .filter((s) => {
      if (!leftBoxSearch) return true;
      const q = leftBoxSearch.toLowerCase();
      return (
        s.displayName?.toLowerCase().includes(q) ||
        s.nis?.toLowerCase().includes(q) ||
        s.nisn?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q)
      );
    });

  // Selected students list for Right Box
  const studentsInTransferQueue = unassignedStudents.filter((s) =>
    selectedStudentIdsToAssign.includes(s.id)
  );

  // Filter subjects for Catalog
  const filteredSubjects = subjects.filter((sub) => {
    const matchesSearch =
      !subjectSearch ||
      sub.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
      sub.code.toLowerCase().includes(subjectSearch.toLowerCase());

    const matchesMajor =
      subjectMajorFilter === "all" ||
      (subjectMajorFilter === "umum" && !sub.majorId) ||
      sub.majorId === subjectMajorFilter;

    const matchesCategory =
      subjectCategoryFilter === "all" || sub.categoryId === subjectCategoryFilter;

    return matchesSearch && matchesMajor && matchesCategory;
  });

  // Filter Question Bank Subjects
  const filteredQbSubjects = subjects.filter((sub: any) => {
    if (!qbSearchTerm) return true;
    const q = qbSearchTerm.toLowerCase();
    return (
      (sub.name && sub.name.toLowerCase().includes(q)) ||
      (sub.code && sub.code.toLowerCase().includes(q)) ||
      (sub.major?.name && sub.major.name.toLowerCase().includes(q))
    );
  });

  // Filter User Management Teachers
  const filteredUserTeachers = teachers.filter((t: any) => {
    const matchesSearch =
      !userTeacherSearch ||
      t.displayName?.toLowerCase().includes(userTeacherSearch.toLowerCase()) ||
      t.nip?.toLowerCase().includes(userTeacherSearch.toLowerCase()) ||
      t.username?.toLowerCase().includes(userTeacherSearch.toLowerCase()) ||
      t.email?.toLowerCase().includes(userTeacherSearch.toLowerCase());

    const matchesStatus =
      userTeacherStatusFilter === "all" ||
      (userTeacherStatusFilter === "active" ? t.isActive : !t.isActive);

    return matchesSearch && matchesStatus;
  });

  // Filter User Management Students
  const filteredUserStudents = students.filter((s: any) => {
    const matchesSearch =
      !userStudentSearch ||
      s.displayName?.toLowerCase().includes(userStudentSearch.toLowerCase()) ||
      s.nis?.toLowerCase().includes(userStudentSearch.toLowerCase()) ||
      s.nisn?.toLowerCase().includes(userStudentSearch.toLowerCase()) ||
      s.username?.toLowerCase().includes(userStudentSearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(userStudentSearch.toLowerCase());

    const matchesClass =
      userStudentClassFilter === "all" ||
      s.classId === userStudentClassFilter ||
      s.class?.id === userStudentClassFilter;

    const matchesStatus =
      userStudentStatusFilter === "all" ||
      (userStudentStatusFilter === "active" ? s.isActive : !s.isActive);

    return matchesSearch && matchesClass && matchesStatus;
  });

  const isSemesterGanjilActive =
    activeSemesterName?.toLowerCase().includes("ganjil") ?? false;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Collapsible Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {user && (
          <Header
            user={user}
            activeYear={activeYearName}
            activeSemester={activeSemesterName}
            onToggleMobileMenu={() => setMobileSidebarOpen(true)}
            breadcrumb={
              activeTab === "dashboard" ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-[#0D274C]/5 border border-[#0D274C]/10 flex items-center justify-center text-[#0D274C]">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-slate-800 text-sm">Dashboard</span>
                </div>
              ) : (
                <nav className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-500 overflow-hidden" aria-label="Breadcrumb">
                  <button
                    type="button"
                    onClick={() => handleSelectTab("dashboard")}
                    className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#0D274C] font-medium transition cursor-pointer shrink-0"
                    title="Ke Dashboard"
                  >
                    <div className="w-6 h-6 rounded-md bg-slate-100 hover:bg-[#0D274C]/10 flex items-center justify-center text-slate-500 hover:text-[#0D274C] transition">
                      <LayoutDashboard className="w-3.5 h-3.5" />
                    </div>
                    <span className="hidden sm:inline">Dashboard</span>
                  </button>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-slate-500 font-medium whitespace-nowrap shrink-0">
                    {getTabCategory(activeTab)}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="font-bold text-[#0D274C] whitespace-nowrap truncate max-w-[140px] sm:max-w-xs md:max-w-none">
                    {getTabTitle(activeTab)}
                  </span>
                </nav>
              )
            }
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* VIEW: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Welcome Banner */}
              <div className="relative overflow-hidden rounded-2xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm">
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#65C443]/10 border border-[#65C443]/20 text-emerald-800 text-xs font-semibold mb-3">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#65C443]" />
                      <span>Panel Kendali Administrator Sekolah</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                      Pusat Manajemen Akademik & Pengguna
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Tahun Ajaran Aktif:{" "}
                      <span className="text-[#0D274C] font-bold">
                        {activeYearName || "Belum Ditentukan"}
                      </span>{" "}
                      {activeSemesterName && `• Semester ${activeSemesterName}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                    <Activity className="w-4 h-4 text-[#65C443] animate-pulse" />
                    <span>Sistem Siap (Fase 1 & 2 Berjalan)</span>
                  </div>
                </div>
              </div>

              {/* 4 Statistical Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                  onClick={() => handleSelectTab("students")}
                  className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2 hover:border-[#65C443]/50 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Peserta / Siswa</span>
                    <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443] group-hover:bg-[#65C443] group-hover:text-white transition">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{initialStats.totalStudents}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Siswa terdaftar</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => handleSelectTab("teachers")}
                  className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2 hover:border-[#0D274C]/50 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Guru / Pendidik</span>
                    <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C] group-hover:bg-[#0D274C] group-hover:text-white transition">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{initialStats.totalTeachers}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Guru & wali kelas</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => handleSelectTab("classes")}
                  className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2 hover:border-[#65C443]/50 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Rombel / Kelas</span>
                    <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443] group-hover:bg-[#65C443] group-hover:text-white transition">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{initialStats.totalClasses}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Rombongan belajar</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => handleSelectTab("majors")}
                  className="rounded-xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm space-y-2 hover:border-[#0D274C]/50 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                    <span>Program Keahlian</span>
                    <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C] group-hover:bg-[#0D274C] group-hover:text-white transition">
                      <Briefcase className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{initialStats.totalMajors}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Jurusan kejuruan</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#65C443]" />
                  <span>Akses Cepat Pengelolaan Sistem</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      handleSelectTab("students");
                      setShowAddStudentModal(true);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-[#65C443] transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443] group-hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tambah Siswa</div>
                      <div className="text-[10px] text-slate-500">Input siswa individual</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectTab("students");
                      setBulkImportType("student");
                      setBulkCsvText("");
                      setBulkExcelRows([]);
                      setBulkExcelFileName("");
                      setBulkExcelFile(null);
                      setBulkPreviewData(null);
                      setShowBulkModal(true);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-[#65C443] transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443] group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Impor Data Siswa</div>
                      <div className="text-[10px] text-slate-500">Unggah berkas Excel .xlsx</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                    handleSelectTab("teachers");
                    setShowAddTeacherModal(true);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-[#0D274C] transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C] group-hover:scale-110 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tambah Guru</div>
                      <div className="text-[10px] text-slate-500">Input guru individual</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectTab("teachers");
                      setBulkImportType("teacher");
                      setBulkCsvText("");
                      setBulkExcelRows([]);
                      setBulkExcelFileName("");
                      setBulkExcelFile(null);
                      setBulkPreviewData(null);
                      setShowBulkModal(true);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-[#0D274C] transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#0D274C]/10 flex items-center justify-center text-[#0D274C] group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Impor Data Guru</div>
                      <div className="text-[10px] text-slate-500">Unggah berkas Excel .xlsx</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleSelectTab("classes");
                      fetchClassesAndMajors();
                      fetchTeachers();
                      setShowAddClassModal(true);
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-[#65C443] transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#65C443]/10 flex items-center justify-center text-[#65C443] group-hover:scale-110 transition-transform">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tambah Rombel</div>
                      <div className="text-[10px] text-slate-500">Buat kelas belajar baru</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectTab("question_banks")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-amber-400 transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                      <FileQuestion className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Bank Soal Ujian</div>
                      <div className="text-[10px] text-slate-500">Katalog butir soal CBT</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectTab("exam_status")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-sky-400 transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Monitoring Ujian</div>
                      <div className="text-[10px] text-slate-500">Status peserta ujian live</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSelectTab("user_students")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:border-indigo-400 transition flex flex-col items-start gap-2 text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">Aktivasi Akun Siswa</div>
                      <div className="text-[10px] text-slate-500">Kunci / buka akses ujian</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: JURUSAN (PROGRAM KEAHLIAN) */}
          {activeTab === "majors" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Program Keahlian / Jurusan Sekolah</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola program keahlian kejuruan dan konsentrasi bidang belajar pada sekolah.
                  </p>
                </div>
                <button
                  onClick={() => setShowManageMajorsModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah / Kelola Jurusan</span>
                </button>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-4 w-12 text-center">No</th>
                        <th className="py-3.5 px-4">Nama Program Keahlian</th>
                        <th className="py-3.5 px-4">Kode Jurusan</th>
                        <th className="py-3.5 px-4">Deskripsi Bidang</th>
                        <th className="py-3.5 px-4 text-center">Rombel Terkait</th>
                        <th className="py-3.5 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {majors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Belum ada program keahlian / jurusan terdaftar.
                          </td>
                        </tr>
                      ) : (
                        majors.map((m, idx) => (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{m.name}</td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold text-[11px]">
                                {m.code}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                              {m.description || "Konsentrasi kejuruan"}
                            </td>
                            <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                              {m._count?.classGroups || 0} Rombel
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <button
                                onClick={() => handleDeleteMajor(m.id, m.name)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition cursor-pointer"
                                title="Hapus Jurusan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: BANK SOAL KATALOG */}
          {activeTab === "question_banks" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Katalog Bank Soal Ujian CBT</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih mata pelajaran untuk mengelola butir soal, mengatur paket ujian, dan melihat kisi-kisi soal.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari mata pelajaran..."
                      value={qbSearchTerm}
                      onChange={(e) => setQbSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQbSubjects.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                    Tidak ada mata pelajaran yang sesuai.
                  </div>
                ) : (
                  filteredQbSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-[#65C443]/50 hover:shadow-md transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {sub.code || "MAPEL"}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            {sub.category?.name || "Umum"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">{sub.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {sub.major?.name ? `Jurusan: ${sub.major.name}` : "Mata Pelajaran Umum (Semua Jurusan)"}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          {sub._count?.questionBanks || 0} Paket Bank Soal
                        </span>
                        <Link
                          href={`/admin/question-banks/${sub.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0D274C] hover:bg-[#163B6E] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                        >
                          <span>Buka Bank Soal</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VIEW: PELAKSANAAN UJIAN (STATUS SISWA, HASIL, ANALISIS, REKAP NILAI) */}
          {(activeTab === "exam_status" ||
            activeTab === "exam_results" ||
            activeTab === "exam_analysis" ||
            activeTab === "exam_grades") && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-[#65C443]" />
                    <span>{getTabTitle(activeTab)}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeTab === "exam_status" && "Pantau langsung status aktivitas, pengerjaan, dan anti-cheat peserta ujian."}
                    {activeTab === "exam_results" && "Rekapitulasi skor dan hasil pengerjaan ujian peserta didik."}
                    {activeTab === "exam_analysis" && "Analisis statistik butir soal, daya pembeda, dan tingkat kesukaran soal."}
                    {activeTab === "exam_grades" && "Rekap nilai akhir per rombel dan ekspor daftar nilai untuk raport."}
                  </p>
                </div>
              </div>

              <TeacherExaminationPanel
                subjects={subjects}
                academicYears={years}
                semesters={years.flatMap((y: any) => y.semesters || [])}
                classes={classes}
                activeYearId={activeYearId}
                activeYearName={activeYearName}
                userRoles={["administrator"]}
                teachers={teachers}
              />
            </div>
          )}

          {/* VIEW: USER MANAGEMENT - GURU (AKTIVASI/DEAKTIVASI) */}
          {activeTab === "user_teachers" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">User Management: Guru & Tenaga Pendidik</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola status aktivasi akun guru. Akun yang dinonaktifkan tidak dapat login ke sistem.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari guru atau NIP..."
                      value={userTeacherSearch}
                      onChange={(e) => setUserTeacherSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>

                  <select
                    value={userTeacherStatusFilter}
                    onChange={(e: any) => setUserTeacherStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Status</option>
                    <option value="active">Hanya Aktif</option>
                    <option value="inactive">Hanya Nonaktif</option>
                  </select>
                </div>
              </div>

              {/* Bulk Action Bar */}
              {selectedUserTeacherIds.length > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-900">
                  <span className="font-semibold">{selectedUserTeacherIds.length} guru terpilih</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={userTeacherBulkLoading}
                      onClick={() => handleBulkUserStatus(selectedUserTeacherIds, "activate", "teacher")}
                      className="px-3 py-1 rounded-lg bg-[#65C443] hover:bg-[#52a835] text-white font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Aktifkan Akun
                    </button>
                    <button
                      disabled={userTeacherBulkLoading}
                      onClick={() => handleBulkUserStatus(selectedUserTeacherIds, "deactivate", "teacher")}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Nonaktifkan Akun
                    </button>
                  </div>
                </div>
              )}

              {/* Table User Management Teachers */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredUserTeachers.length > 0 &&
                              selectedUserTeacherIds.length === filteredUserTeachers.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserTeacherIds(filteredUserTeachers.map((t) => t.id));
                              } else {
                                setSelectedUserTeacherIds([]);
                              }
                            }}
                            className="rounded text-[#65C443] cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4 w-12 text-center">No</th>
                        <th className="py-3.5 px-4">Nama Lengkap & NIP</th>
                        <th className="py-3.5 px-4">Username Login</th>
                        <th className="py-3.5 px-4">Email</th>
                        <th className="py-3.5 px-4 text-center">Status Akun</th>
                        <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUserTeachers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            Tidak ada data guru yang sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        filteredUserTeachers.map((t, idx) => {
                          const isSelected = selectedUserTeacherIds.includes(t.id);
                          return (
                            <tr key={t.id} className={`hover:bg-slate-50/80 transition ${isSelected ? "bg-slate-50/60" : ""}`}>
                              <td className="py-3.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUserTeacherIds((prev) => [...prev, t.id]);
                                    } else {
                                      setSelectedUserTeacherIds((prev) => prev.filter((id) => id !== t.id));
                                    }
                                  }}
                                  className="rounded text-[#65C443] cursor-pointer"
                                />
                              </td>
                              <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{t.displayName}</div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  NIP: {t.nip || "-"}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700">@{t.username}</td>
                              <td className="py-3.5 px-4 text-slate-500">{t.email || "-"}</td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    t.isActive
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      t.isActive ? "bg-[#65C443]" : "bg-rose-500"
                                    }`}
                                  />
                                  <span>{t.isActive ? "Aktif" : "Nonaktif"}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => handleToggleUserStatus(t.id, t.isActive, "teacher")}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                                    t.isActive
                                      ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {t.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: USER MANAGEMENT - SISWA (AKTIVASI/DEAKTIVASI) */}
          {activeTab === "user_students" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">User Management: Siswa (Peserta Didik)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola status aktivasi akun siswa untuk mengontrol izin akses login ujian CBT.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari siswa atau NIS..."
                      value={userStudentSearch}
                      onChange={(e) => setUserStudentSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443]"
                    />
                  </div>

                  <select
                    value={userStudentClassFilter}
                    onChange={(e) => setUserStudentClassFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Rombel</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={userStudentStatusFilter}
                    onChange={(e: any) => setUserStudentStatusFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">Semua Status</option>
                    <option value="active">Hanya Aktif</option>
                    <option value="inactive">Hanya Nonaktif</option>
                  </select>
                </div>
              </div>

              {/* Bulk Action Bar */}
              {selectedUserStudentIds.length > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-900">
                  <span className="font-semibold">{selectedUserStudentIds.length} siswa terpilih</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={userStudentBulkLoading}
                      onClick={() => handleBulkUserStatus(selectedUserStudentIds, "activate", "student")}
                      className="px-3 py-1 rounded-lg bg-[#65C443] hover:bg-[#52a835] text-white font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Aktifkan Akun Siswa
                    </button>
                    <button
                      disabled={userStudentBulkLoading}
                      onClick={() => handleBulkUserStatus(selectedUserStudentIds, "deactivate", "student")}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Nonaktifkan Akun Siswa
                    </button>
                  </div>
                </div>
              )}

              {/* Table User Management Students */}
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3.5 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredUserStudents.length > 0 &&
                              selectedUserStudentIds.length === filteredUserStudents.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserStudentIds(filteredUserStudents.map((s) => s.id));
                              } else {
                                setSelectedUserStudentIds([]);
                              }
                            }}
                            className="rounded text-[#65C443] cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4 w-12 text-center">No</th>
                        <th className="py-3.5 px-4">Nama Siswa & NIS/NISN</th>
                        <th className="py-3.5 px-4">Username Login</th>
                        <th className="py-3.5 px-4">Kelas / Rombel</th>
                        <th className="py-3.5 px-4 text-center">Status Akun</th>
                        <th className="py-3.5 px-4 text-center">Aksi Cepat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUserStudents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            Tidak ada data siswa yang sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        filteredUserStudents.map((s, idx) => {
                          const isSelected = selectedUserStudentIds.includes(s.id);
                          return (
                            <tr key={s.id} className={`hover:bg-slate-50/80 transition ${isSelected ? "bg-slate-50/60" : ""}`}>
                              <td className="py-3.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUserStudentIds((prev) => [...prev, s.id]);
                                    } else {
                                      setSelectedUserStudentIds((prev) => prev.filter((id) => id !== s.id));
                                    }
                                  }}
                                  className="rounded text-[#65C443] cursor-pointer"
                                />
                              </td>
                              <td className="py-3.5 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-900">{s.displayName}</div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                  NIS: {s.nis || "-"} • NISN: {s.nisn || "-"}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-700">@{s.username}</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                  {s.className || "-"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    s.isActive
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      s.isActive ? "bg-[#65C443]" : "bg-rose-500"
                                    }`}
                                  />
                                  <span>{s.isActive ? "Aktif" : "Nonaktif"}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => handleToggleUserStatus(s.id, s.isActive, "student")}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                                    s.isActive
                                      ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {s.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
      {/* ======================================================== */}
      {/* TAB 1: SISWA (PESERTA DIDIK)                             */}
      {/* ======================================================== */}
      {activeTab === "students" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan NIS, NISN, nama, username..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchStudents()}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBulkImportType("student");
                  setBulkCsvText("");
                  setBulkExcelRows([]);
                  setBulkExcelFileName("");
                  setBulkExcelFile(null);
                  setBulkPreviewData(null);
                  setShowBulkModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0D274C]" />
                <span>Impor Data Siswa</span>
              </button>
              <button
                onClick={() => {
                  setFormError(null);
                  setShowAddStudentModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Bar for Students */}
          {selectedStudentRowIds.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-3 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2 text-xs text-emerald-900 font-semibold">
                <CheckSquare className="w-4 h-4 text-[#65C443]" />
                <span>Terpilih: {selectedStudentRowIds.length} Siswa</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={userBulkActionLoading}
                  onClick={() => handleBulkUserAction("student", "activate")}
                  className="px-3 py-1.5 rounded-lg bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Aktifkan
                </button>
                <button
                  type="button"
                  disabled={userBulkActionLoading}
                  onClick={() => handleBulkUserAction("student", "deactivate")}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Nonaktifkan
                </button>
                <button
                  type="button"
                  disabled={userBulkActionLoading}
                  onClick={() => handleBulkUserAction("student", "delete")}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
                >
                  Hapus Terpilih
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          students.length > 0 &&
                          selectedStudentRowIds.length === students.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStudentRowIds(students.map((s) => s.id));
                          } else {
                            setSelectedStudentRowIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-[#65C443] focus:ring-[#65C443] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Identitas (NIS / NISN)</th>
                    <th className="py-3 px-4">Nama Lengkap Siswa</th>
                    <th className="py-3 px-4">Username Login</th>
                    <th className="py-3 px-4">Penempatan Kelas</th>
                    <th className="py-3 px-4">Status Akun</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {studentsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Memuat data siswa...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tidak ada siswa terdaftar.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const isChecked = selectedStudentRowIds.includes(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${
                            isChecked ? "bg-[#65C443]/10" : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedStudentRowIds(
                                    selectedStudentRowIds.filter((id) => id !== s.id)
                                  );
                                } else {
                                  setSelectedStudentRowIds([
                                    ...selectedStudentRowIds,
                                    s.id,
                                  ]);
                                }
                              }}
                              className="rounded border-slate-300 text-[#65C443] focus:ring-[#65C443] cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-[#0D274C] font-bold">
                              NIS: {s.nis || "-"}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              NISN: {s.nisn || "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">
                              {s.displayName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {s.email || "Tanpa email"}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600">
                            @{s.username}
                          </td>
                          <td className="py-3 px-4">
                            {s.currentClass ? (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                                {s.currentClass}{" "}
                                {s.currentMajor && `(${s.currentMajor})`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                                Belum Ditentukan
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                                s.isActive ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  s.isActive ? "bg-[#65C443]" : "bg-rose-500"
                                }`}
                              />
                              {s.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => openEditStudentModal(s)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer shadow-xs"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#0D274C]" />
                              <span>Edit</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: GURU (TENAGA PENDIDIK)                            */}
      {/* ======================================================== */}
      {activeTab === "teachers" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan NIP, nama guru, username..."
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTeachers()}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#65C443] shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/api/users/export?role=teacher"
                download="kredensial_guru_nexam.csv"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition cursor-pointer"
                title="Ekspor Data Nama, Username & Password Guru"
              >
                <Download className="w-3.5 h-3.5 text-[#65C443]" />
                <span>Ekspor Akun Guru</span>
              </a>
              <button
                onClick={() => {
                  setBulkImportType("teacher");
                  setBulkCsvText("");
                  setBulkExcelRows([]);
                  setBulkExcelFileName("");
                  setBulkExcelFile(null);
                  setBulkPreviewData(null);
                  setShowBulkModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0D274C]" />
                <span>Impor Data Guru</span>
              </button>
              <button
                onClick={() => {
                  setFormError(null);
                  fetchClassesAndMajors();
                  setShowAddTeacherModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Guru</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Bar for Teachers */}
          {selectedTeacherRowIds.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-3 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2 text-xs text-emerald-900 font-semibold">
                <CheckSquare className="w-4 h-4 text-[#65C443]" />
                <span>Terpilih: {selectedTeacherRowIds.length} Guru</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={userBulkActionLoading}
                  onClick={() => handleBulkUserAction("teacher", "activate")}
                  className="px-3 py-1.5 rounded-lg bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Aktifkan
                </button>
                <button
                  type="button"
                  disabled={userBulkActionLoading}
                  onClick={() => handleBulkUserAction("teacher", "deactivate")}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Nonaktifkan
                </button>
                <button
                  type="button"
                  disabled={userBulkActionLoading}
                  onClick={() => handleBulkUserAction("teacher", "delete")}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Hapus Terpilih
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          teachers.length > 0 &&
                          selectedTeacherRowIds.length === teachers.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTeacherRowIds(teachers.map((t) => t.id));
                          } else {
                            setSelectedTeacherRowIds([]);
                          }
                        }}
                        className="rounded accent-[#65C443] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Identitas (NIP / NUPTK)</th>
                    <th className="py-3 px-4">Nama & Gelar</th>
                    <th className="py-3 px-4">Jabatan</th>
                    <th className="py-3 px-4">Wali Kelas</th>
                    <th className="py-3 px-4">Mapel & Kelas Diampu</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {teachersLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Memuat data guru...
                      </td>
                    </tr>
                  ) : teachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Tidak ada guru terdaftar.
                      </td>
                    </tr>
                  ) : (
                    teachers.map((t) => {
                      const isChecked = selectedTeacherRowIds.includes(t.id);
                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors ${
                            isChecked ? "bg-emerald-50/50" : "hover:bg-slate-50/80"
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedTeacherRowIds(
                                    selectedTeacherRowIds.filter((id) => id !== t.id)
                                  );
                                } else {
                                  setSelectedTeacherRowIds([
                                    ...selectedTeacherRowIds,
                                    t.id,
                                  ]);
                                }
                              }}
                              className="rounded accent-[#65C443] cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-[#0D274C] font-bold">
                              NIP: {t.nip || "-"}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              NUPTK: {t.nuptk || "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-800">
                                {t.displayName}
                                {t.title ? `, ${t.title}` : ""}
                              </span>
                              {t.gender && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    t.gender === "L" || t.gender === "Laki-laki"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : "bg-pink-50 text-pink-700 border border-pink-200"
                                  }`}
                                >
                                  {t.gender === "L" || t.gender === "Laki-laki" ? "L" : "P"}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              @{t.username} • {t.email || "Tanpa email"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs text-slate-700 font-medium">
                              {t.position || "Guru"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {t.homeroomClasses && t.homeroomClasses.length > 0 ? (
                              <span className="text-xs font-semibold text-emerald-700">
                                {t.homeroomClasses.join(", ")}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[240px]">
                            {t.teachingAssignments && t.teachingAssignments.length > 0 ? (
                              <div className="space-y-1.5">
                                {Array.from(
                                  new Set(t.teachingAssignments.map((ta: any) => ta.subjectName))
                                ).map((subName: any, idx: number) => {
                                  const classNames = t.teachingAssignments
                                    .filter((x: any) => x.subjectName === subName)
                                    .map((x: any) => x.classGroupName)
                                    .join(", ");
                                  return (
                                    <div key={idx} className="text-xs leading-tight">
                                      <span className="font-semibold text-[#0D274C] block">{subName}</span>
                                      <span className="text-[11px] text-slate-500 block truncate" title={classNames}>
                                        ({classNames})
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">
                                Belum ada mapel
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                                t.isActive ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  t.isActive ? "bg-[#65C443]" : "bg-rose-500"
                                }`}
                              />
                              {t.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditTeacherProfileModal(t)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                title="Edit Profil & Akun"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                <span>Profil</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditTeacherDutyModal(t)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#0D274C] border border-emerald-200 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                title="Edit Jabatan, Wali Kelas & Mapel Mengajar"
                              >
                                <Briefcase className="w-3.5 h-3.5 text-[#65C443]" />
                                <span>Jabatan</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: ADMINISTRATOR (PENGELOLA SISTEM)                    */}
      {/* ======================================================== */}
      {activeTab === "admins" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau username admin..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchAdmins()}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#65C443] shadow-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setNewAdminName("");
                  setNewAdminUsername("");
                  setNewAdminPassword("");
                  setNewAdminEmail("");
                  setShowAddAdminModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Administrator</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Kontak / Email</th>
                    <th className="py-3 px-4">Peran & Akses</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Terdaftar</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {adminsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Memuat data administrator...
                      </td>
                    </tr>
                  ) : admins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Tidak ada data administrator ditemukan.
                      </td>
                    </tr>
                  ) : (
                    admins.map((adm) => {
                      return (
                        <tr key={adm.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#0D274C] text-[#65C443] flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                                {adm.displayName ? adm.displayName.charAt(0) : "A"}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800">
                                  {adm.displayName}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  @{adm.username}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-600">
                              {adm.email || <span className="italic text-slate-400">Tidak ada email</span>}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#0D274C]" />
                              Administrator Penuh
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                                adm.isActive ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  adm.isActive ? "bg-[#65C443]" : "bg-rose-500"
                                }`}
                              />
                              {adm.isActive ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {adm.createdAt
                              ? new Date(adm.createdAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "-"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditAdminModal(adm)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                title="Edit Akun & Reset Sandi"
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAdminStatus(adm)}
                                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                                  adm.isActive
                                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                                }`}
                                title={adm.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                              >
                                <span>{adm.isActive ? "Nonaktifkan" : "Aktifkan"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: TAHUN AJARAN & KONTROL SEMESTER                   */}
      {/* ======================================================== */}
      {activeTab === "academic_years" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Struktur Tahun Ajaran & Semester</h3>
              <p className="text-xs text-slate-500">
                Pilih dan aktifkan tahun ajaran serta semester yang sedang berlangsung secara langsung.
              </p>
            </div>
            <button
              onClick={() => setShowAddYearModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Tahun Ajaran</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {years.map((y) => {
              const isYearArchived = y.status === "archived";
              return (
                <div
                  key={y.id}
                  className={`bg-white rounded-xl p-5 border space-y-4 shadow-sm ${
                    y.status === "active"
                      ? "border-emerald-300 ring-1 ring-emerald-400/20"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-900">{y.name}</span>
                        {y.status === "active" ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                            Tahun Aktif
                          </span>
                        ) : isYearArchived ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-medium">
                            Diarsipkan
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Periode: {new Date(y.startDate).toLocaleDateString("id-ID")} s/d{" "}
                        {new Date(y.endDate).toLocaleDateString("id-ID")}
                      </div>
                    </div>

                    {y.status !== "active" && (
                      <button
                        onClick={() => handleActivateYear(y.id)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#65C443] hover:text-white border border-slate-200 text-xs text-slate-700 font-semibold transition cursor-pointer"
                      >
                        Jadikan Aktif
                      </button>
                    )}
                  </div>

                  {/* Semesters list with direct activation control */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Kontrol Semester (Ganjil / Genap)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {y.semesters?.map((s: any) => {
                        // If the academic year is archived, semester is not active
                        const isSemesterActive = y.status === "active" && s.status === "active";
                        return (
                          <div
                            key={s.id}
                            className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 ${
                              isSemesterActive
                                ? "bg-emerald-50/70 border-emerald-200"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">Semester {s.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  isSemesterActive
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                    : "bg-slate-200/60 text-slate-500"
                                }`}
                              >
                                {isSemesterActive ? "Sedang Berjalan" : "Tidak Aktif"}
                              </span>
                            </div>

                            {y.status === "active" && s.status !== "active" && (
                              <button
                                onClick={() => handleActivateSemester(s.id)}
                                className="mt-1 w-full py-1 rounded bg-white hover:bg-[#65C443] hover:text-white text-[11px] text-slate-700 font-semibold border border-slate-200 shadow-xs transition cursor-pointer text-center"
                              >
                                Aktifkan Semester {s.name}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: JURUSAN & KELAS (MANAJEMEN SISWA PER KELAS)       */}
      {/* ======================================================== */}
      {activeTab === "classes" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Rombongan Belajar & Penempatan Siswa</h3>
                {activeYearName && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                    T.A: {activeYearName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola rombel kelas pada tahun ajaran aktif, kustomisasi jurusan, dan tempatkan siswa ke kelas.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {/* Opsi Kenaikan Kelas - Khusus Semester Ganjil Saja */}
              {isSemesterGanjilActive && (
                <button
                  onClick={() => {
                    setPromoteResult(null);
                    setShowPromoteModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Kenaikan Kelas (Semester Ganjil)</span>
                </button>
              )}

              {/* Kelola Jurusan Button */}
              <button
                onClick={() => setShowManageMajorsModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#0D274C]" />
                <span>Kelola Jurusan</span>
              </button>

              <button
                onClick={() => {
                  fetchClassesAndMajors();
                  fetchTeachers();
                  setShowAddClassModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Rombel Kelas</span>
              </button>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-3">
              <Layers className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">
                Belum Ada Rombel Kelas Pada Tahun Ajaran Ini
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isSemesterGanjilActive
                  ? "Tahun ajaran ini baru dimulai. Anda dapat menggunakan tombol 'Kenaikan Kelas' di atas untuk mempromosikan rombel dari tahun sebelumnya, atau membuat rombel baru secara manual."
                  : "Belum ada rombongan belajar terdaftar pada tahun ajaran ini. Silakan buat rombel baru menggunakan tombol Tambah Rombel Kelas di atas."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((c) => (
                <div key={c.id} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/admin/classes/${c.id}`}
                        className="text-lg font-bold text-slate-900 hover:text-[#0D274C] transition inline-flex items-center gap-1 group"
                        title="Buka Halaman Detail Kelas"
                      >
                        <span>{c.name}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0D274C] transition" />
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Jurusan: <strong className="text-slate-700">{c.major?.name || "Umum"}</strong>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                      Tingkat {c.gradeLevel}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="text-slate-500 font-medium">Wali Kelas:</div>
                    <div className="font-semibold text-slate-800">
                      {c.homeroomTeacher?.displayName ? (
                        <span className="text-emerald-700">{c.homeroomTeacher.displayName}</span>
                      ) : (
                        <span className="text-amber-600">Belum Ditentukan</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-slate-500">
                      <strong className="text-slate-900 text-sm">{c._count?.studentEnrollments || 0}</strong> Siswa
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/classes/${c.id}`}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Buka Halaman Detail Kelas & Struktur Organisasi"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#0D274C]" />
                        <span>Detail</span>
                      </Link>

                      <Link
                        href={`/admin/classes/${c.id}/students`}
                        className="px-4 py-1.5 rounded-xl bg-[#0D274C] hover:bg-[#163866] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Buka Halaman Siswa Kelas, Update Sekelas & Ekspor Data"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#65C443]" />
                        <span>Siswa</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: MATA PELAJARAN & KATEGORI KUSTOM                  */}
      {/* ======================================================== */}
      {activeTab === "subjects" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Katalog Mata Pelajaran</h3>
              <p className="text-xs text-slate-500">
                Mata pelajaran dikelompokkan berdasarkan kategori kurikulum dan konsentrasi kejuruan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCategoryManagerModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs cursor-pointer transition"
              >
                <Tag className="w-3.5 h-3.5 text-[#0D274C]" />
                <span>Kelola Kategori</span>
              </button>
              <button
                onClick={() => {
                  fetchSubjectsAndCategories();
                  setShowAddSubjectModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Mapel</span>
              </button>
            </div>
          </div>

          {/* Catalog Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-xs text-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kode atau nama mapel..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#65C443]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={subjectCategoryFilter}
                onChange={(e) => setSubjectCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-[#65C443]"
              >
                <option value="all">Semua Kategori</option>
                {subjectCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>

              <select
                value={subjectMajorFilter}
                onChange={(e) => setSubjectMajorFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-[#65C443]"
              >
                <option value="all">Semua Jurusan</option>
                <option value="umum">Umum Saja (Non-Kejuruan)</option>
                {majors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grouped Catalog View with Subheadings per Category */}
          {filteredSubjects.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm text-center text-xs text-slate-500">
              Tidak ada mata pelajaran yang cocok dengan filter atau kata kunci pencarian.
            </div>
          ) : (
            <div className="space-y-6">
              {subjectCategories.map((cat) => {
                const subsInCat = filteredSubjects.filter((s) => s.categoryId === cat.id);
                if (subsInCat.length === 0) return null;
                return (
                  <div key={cat.id} className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <Tag className="w-4 h-4 text-[#0D274C]" />
                      <h4 className="text-sm font-bold text-slate-900 tracking-wide">
                        {cat.name} {cat.code ? `(${cat.code})` : ""}
                      </h4>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono font-semibold">
                        {subsInCat.length} Mapel
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {subsInCat.map((sub) => (
                        <div
                          key={sub.id}
                          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[#0D274C] border border-slate-200 font-mono text-xs font-bold">
                              {sub.code}
                            </span>
                            {sub.major ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                                Jurusan: {sub.major.code}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                Umum (Semua Jurusan)
                              </span>
                            )}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm">{sub.name}</h5>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                              {sub.description || "Tidak ada deskripsi"}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono">Bank Soal Mapel</span>
                            <Link
                              href={`/admin/question-banks/${sub.id}`}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 hover:text-emerald-900 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                            >
                              <FolderArchive className="w-3.5 h-3.5 text-[#65C443]" />
                              <span>Bank Soal</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Subjects without Category */}
              {filteredSubjects.some((s) => !s.categoryId) && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <h4 className="text-sm font-bold text-slate-700 tracking-wide">
                      Lainnya (Belum Dikategorikan)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredSubjects
                      .filter((s) => !s.categoryId)
                      .map((sub) => (
                        <div
                          key={sub.id}
                          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
                              {sub.code}
                            </span>
                            {sub.major && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Jurusan: {sub.major.code}
                              </span>
                            )}
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-900 text-sm">{sub.name}</h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {sub.description || "Tidak ada deskripsi"}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono">Bank Soal Mapel</span>
                            <Link
                              href={`/admin/question-banks/${sub.id}`}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 hover:text-emerald-900 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
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
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: LOG AUDIT                                         */}
      {/* ======================================================== */}
      {activeTab === "audit" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#0D274C]" />
              <span>Log Audit Aktivitas Sistem (Append-Only)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari user / pelaku..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchAuditLogs();
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D274C]/20 focus:border-[#0D274C]"
                />
              </div>
              <button
                onClick={() => fetchAuditLogs()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 font-semibold border border-slate-200 shadow-xs transition cursor-pointer"
                title="Cari atau segarkan log"
              >
                <RefreshCw className={`w-3 h-3 text-slate-500 ${auditLoading ? "animate-spin" : ""}`} />
                <span>Cari</span>
              </button>
              <a
                href={`/api/audit-logs?format=csv${auditSearch ? `&actor=${encodeURIComponent(auditSearch)}` : ""}`}
                download="Audit_Logs.csv"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D274C] hover:bg-[#0D274C]/90 text-xs text-white font-semibold shadow-xs transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Pelaku (Actor)</th>
                    <th className="py-3 px-4">Aksi</th>
                    <th className="py-3 px-4">Entitas</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {auditLoading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        Memuat data log audit...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                        Belum ada rekaman audit.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          {new Date(log.timestamp).toLocaleString("id-ID")}
                        </td>
                        <td className="py-2.5 px-4 text-[#0D274C] font-sans font-semibold">
                          {log.actor?.displayName || log.actor?.username || "System"}
                        </td>
                        <td className="py-2.5 px-4 text-emerald-700 font-bold">{log.action}</td>
                        <td className="py-2.5 px-4 text-slate-700 font-sans">{log.entityType}</td>
                        <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                          {log.ipAddress || "127.0.0.1"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: UJIAN & ASESMEN (ADMIN MANAGEMENT)                 */}
      {/* ======================================================== */}
      {activeTab === "examinations" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <TeacherExaminationPanel
            subjects={subjects}
            academicYears={years}
            semesters={years.flatMap((y: any) => y.semesters || [])}
            classes={classes}
            activeYearId={activeYearId}
            activeYearName={activeYearName}
            userRoles={["administrator"]}
            teachers={teachers}
          />
        </div>
      )}

        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAL: KELOLA SISWA KELAS (DUAL-LISTBOX & MULTI-ASSIGN)  */}
      {/* ======================================================== */}
      {selectedClassForStudents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[92vh] flex flex-col space-y-4 text-slate-800"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    Kelola Siswa Kelas {selectedClassForStudents.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold border border-indigo-500/20">
                    Tingkat {selectedClassForStudents.gradeLevel}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Jurusan: <strong>{selectedClassForStudents.major?.name || "Umum"}</strong> • Wali Kelas:{" "}
                  <strong>{selectedClassForStudents.homeroomTeacher?.displayName || "Belum Ditentukan"}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedClassForStudents(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Internal Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setClassModalTab("current")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  classModalTab === "current"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Siswa di Kelas Ini ({classEnrollments.length})
              </button>
              <button
                onClick={() => setClassModalTab("transfer")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  classModalTab === "transfer"
                    ? "bg-[#65C443] text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Siswa (Pilihan Ganda)</span>
              </button>
            </div>

            {/* TAB 1: CURRENT STUDENTS IN THIS CLASS (WITH CHECKBOXES FOR BATCH REMOVAL) */}
            {classModalTab === "current" && (
              <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Pilih kotak centang untuk mengeluarkan siswa sekaligus secara massal.
                  </div>

                  {selectedEnrollmentIdsToRemove.length > 0 && (
                    <button
                      onClick={handleBatchRemoveStudents}
                      disabled={batchActionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Keluarkan ({selectedEnrollmentIdsToRemove.length}) Terpilih</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              classEnrollments.length > 0 &&
                              selectedEnrollmentIdsToRemove.length === classEnrollments.length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEnrollmentIdsToRemove(classEnrollments.map((en) => en.id));
                              } else {
                                setSelectedEnrollmentIdsToRemove([]);
                              }
                            }}
                            className="rounded bg-white border-slate-300 text-[#65C443] focus:ring-[#65C443] cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">NIS</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Username</th>
                        <th className="py-2.5 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {classStudentsLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                            Memuat data siswa kelas...
                          </td>
                        </tr>
                      ) : classEnrollments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                            Belum ada siswa yang ditempatkan di kelas ini.
                          </td>
                        </tr>
                      ) : (
                        classEnrollments.map((en) => {
                          const isChecked = selectedEnrollmentIdsToRemove.includes(en.id);
                          return (
                            <tr key={en.id} className="hover:bg-slate-50/80">
                              <td className="py-2.5 px-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedEnrollmentIdsToRemove(
                                        selectedEnrollmentIdsToRemove.filter((id) => id !== en.id)
                                      );
                                    } else {
                                      setSelectedEnrollmentIdsToRemove([
                                        ...selectedEnrollmentIdsToRemove,
                                        en.id,
                                      ]);
                                    }
                                  }}
                                  className="rounded bg-white border-slate-300 text-[#65C443] focus:ring-[#65C443] cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-slate-900 font-bold">
                                {en.student?.nis || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-sans font-medium">
                                {en.student?.displayName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">@{en.student?.username}</td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedEnrollmentIdsToRemove([en.id]);
                                    handleBatchRemoveStudents();
                                  }}
                                  className="text-[11px] font-sans px-2.5 py-1 rounded bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition cursor-pointer"
                                >
                                  Keluarkan
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: DUAL-LISTBOX TRANSFER VIEW (DUA KOTAK TRANSFER SISWA) */}
            {classModalTab === "transfer" && (
              <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
                <div className="text-xs text-slate-500">
                  Klik nama siswa pada kotak kiri untuk memindahkannya ke antrean kanan. Setelah selesai, klik tombol konfirmasi untuk menyimpan sekaligus.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
                  {/* KOTAK KIRI: DAFTAR SISWA BELUM MASUK KELAS */}
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        1. Siswa Belum Ditempatkan ({filteredUnassignedStudents.length})
                      </span>
                      {filteredUnassignedStudents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudentIdsToAssign((prev) => [
                              ...prev,
                              ...filteredUnassignedStudents.map((s) => s.id),
                            ]);
                          }}
                          className="text-[10px] text-emerald-600 hover:underline cursor-pointer font-medium"
                        >
                          Pilih Semua Hasil
                        </button>
                      )}
                    </div>

                    {/* Left Box Search Bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama, NIS, NISN siswa..."
                        value={leftBoxSearch}
                        onChange={(e) => setLeftBoxSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                      />
                    </div>

                    {/* Left Box List */}
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-64 md:max-h-80">
                      {filteredUnassignedStudents.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          {unassignedStudents.length === 0
                            ? "Semua siswa aktif sudah terdaftar di rombel kelas."
                            : "Tidak ada siswa yang cocok dengan pencarian."}
                        </div>
                      ) : (
                        filteredUnassignedStudents.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedStudentIdsToAssign((prev) => [...prev, s.id]);
                            }}
                            className="p-2.5 rounded-lg bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 flex items-center justify-between cursor-pointer transition group"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                                {s.displayName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                NIS: {s.nis || "-"} • @{s.username}
                              </div>
                            </div>
                            <span className="p-1 rounded bg-slate-100 group-hover:bg-[#65C443] text-slate-500 group-hover:text-white transition">
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* KOTAK KANAN: SISWA TERPILIH AKAN DIMASUKKAN */}
                  <div className="flex flex-col rounded-xl border border-emerald-300 bg-emerald-50/40 p-3 space-y-2.5 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800">
                        2. Siswa Akan Dimasukkan ({studentsInTransferQueue.length})
                      </span>
                      {studentsInTransferQueue.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedStudentIdsToAssign([])}
                          className="text-[10px] text-rose-600 hover:underline cursor-pointer font-medium"
                        >
                          Kosongkan Antrean
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-64 md:max-h-80">
                      {studentsInTransferQueue.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-500">
                          Belum ada siswa dipilih. Klik nama siswa di kotak sebelah kiri untuk menambahkannya ke antrean ini.
                        </div>
                      ) : (
                        studentsInTransferQueue.map((s) => (
                          <div
                            key={s.id}
                            className="p-2.5 rounded-lg bg-white border border-emerald-200 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-800">{s.displayName}</div>
                              <div className="text-[10px] text-emerald-700 font-mono">
                                NIS: {s.nis || "-"} • @{s.username}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentIdsToAssign((prev) =>
                                  prev.filter((id) => id !== s.id)
                                );
                              }}
                              className="p-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                              title="Hapus dari antrean"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-emerald-200">
                      <button
                        type="button"
                        disabled={studentsInTransferQueue.length === 0 || batchActionLoading}
                        onClick={handleBatchAssignStudents}
                        className="w-full py-2.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>
                          Simpan & Tempatkan ({studentsInTransferQueue.length}) Siswa ke {selectedClassForStudents.name}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setSelectedClassForStudents(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: KELOLA JURUSAN / PROGRAM KEAHLIAN                 */}
      {/* ======================================================== */}
      {showManageMajorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#0D274C]" />
                <span>Kelola Program Keahlian / Jurusan</span>
              </h3>
              <button
                onClick={() => setShowManageMajorsModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Catatan untuk jenjang non-kejuruan (SMP/MTs atau SD/MI) */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p className="leading-relaxed">
                <strong>Catatan:</strong> Abaikan halaman ini jika sekolah tidak ada jurusan (jenjang SMP/MTs atau SD/MI).
              </p>
            </div>

            {/* Form Tambah Jurusan Baru */}
            <form onSubmit={handleCreateMajor} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="font-semibold text-slate-700">Tambah Jurusan Baru:</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="text"
                  placeholder="Nama Jurusan (e.g. Rekayasa Perangkat Lunak)"
                  value={newMajorName}
                  onChange={(e) => setNewMajorName(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
                <input
                  required
                  type="text"
                  placeholder="Kode Singkat (e.g. RPL, TKJ)"
                  value={newMajorCode}
                  onChange={(e) => setNewMajorCode(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>
              <input
                type="text"
                placeholder="Deskripsi singkat konsentrasi keahlian..."
                value={newMajorDesc}
                onChange={(e) => setNewMajorDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
              />
              <button
                type="submit"
                disabled={majorSubmitting}
                className="w-full py-2 rounded-lg bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white font-bold transition cursor-pointer shadow-sm"
              >
                {majorSubmitting ? "Menyimpan..." : "Tambahkan Jurusan"}
              </button>
            </form>

            {/* List Jurusan yang Tersedia */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Daftar Jurusan Terdaftar:</div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {majors.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{m.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">
                          {m.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {m._count?.classGroups || 0} Rombel Terkait
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMajor(m.id, m.name)}
                      className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition cursor-pointer"
                      title="Hapus Jurusan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setShowManageMajorsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: KENAIKAN KELAS / PROMOSI MASSAL (SEMESTER GANJIL) */}
      {/* ======================================================== */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                <span>Kenaikan Kelas & Kelulusan (Semester Ganjil)</span>
              </h3>
              <button
                onClick={() => setShowPromoteModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Proses ini akan mempromosikan siswa dari tahun ajaran sebelumnya ke tingkat kelas berikutnya pada tahun ajaran aktif{" "}
              <strong className="text-slate-900">{activeYearName}</strong>:
            </p>

            <ul className="text-xs text-slate-600 space-y-1.5 pl-4 list-disc">
              <li>Kelas 10 (X) naik ke Kelas 11 (XI) pada rombel & jurusan yang sama.</li>
              <li>Kelas 11 (XI) naik ke Kelas 12 (XII) pada rombel & jurusan yang sama.</li>
              <li>Kelas 12 (XII) dinyatakan lulus / tidak dimasukkan ke rombel baru.</li>
            </ul>

            {promoteResult && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                {promoteResult}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-700 mb-1 text-xs font-medium">
                  Pilih Tahun Ajaran Asal (Tahun Sebelumnya) *
                </label>
                <select
                  value={sourceYearForPromotion}
                  onChange={(e) => setSourceYearForPromotion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="">-- Pilih Tahun Ajaran Asal --</option>
                  {years
                    .filter((y) => y.id !== activeYearId)
                    .map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} ({y.status === "archived" ? "Diarsipkan" : y.status})
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                disabled={!sourceYearForPromotion || promoteLoading}
                onClick={handlePromoteClasses}
                className="w-full py-2.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition cursor-pointer"
              >
                {promoteLoading ? "Memproses Kenaikan..." : "Jalankan Kenaikan Kelas Otomatis"}
              </button>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setShowPromoteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH SISWA BARU                                 */}
      {/* ======================================================== */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Siswa Baru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Penempatan rombel kelas dapat diatur kemudian di menu Jurusan & Kelas.
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NIS (Nomor Induk Siswa) *</label>
                  <input
                    required
                    type="text"
                    value={newStudentNis}
                    onChange={(e) => setNewStudentNis(e.target.value)}
                    placeholder="Contoh: 202601001"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NISN (Nasional)</label>
                  <input
                    type="text"
                    value={newStudentNisn}
                    onChange={(e) => setNewStudentNisn(e.target.value)}
                    placeholder="Contoh: 0081234567"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap Siswa *</label>
                <input
                  required
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Contoh: Ahmad Fauzan"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Username Login (Default: sama dengan NIS)
                </label>
                <input
                  type="text"
                  value={newStudentUsername}
                  onChange={(e) => setNewStudentUsername(e.target.value)}
                  placeholder={newStudentNis || "Contoh: siswa.ahmad atau 202601001"}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Kata Sandi Awal *</label>
                <input
                  required
                  type="password"
                  value={newStudentPassword}
                  onChange={(e) => setNewStudentPassword(e.target.value)}
                  placeholder="Minimal 8 karakter..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Email Siswa (Opsional)</label>
                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="Contoh: ahmad@sekolah.sch.id"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {formSubmitting ? "Menyimpan..." : "Simpan Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH GURU BARU                                  */}
      {/* ======================================================== */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Guru / Pendidik</h3>
            <p className="text-xs text-slate-500 mb-4">
              Daftarkan tenaga pendidik beserta NIP dan penugasan wali kelas (jika ada).
            </p>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTeacher} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">NIP (Nomor Induk Pegawai) *</label>
                <input
                  required
                  type="text"
                  value={newTeacherNip}
                  onChange={(e) => setNewTeacherNip(e.target.value)}
                  placeholder="Contoh: 198503152010011002"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap & Gelar *</label>
                <input
                  required
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="Contoh: Budi Prasetyo, S.Kom"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Username Login (Default: NIP jika kosong)
                </label>
                <input
                  type="text"
                  value={newTeacherUsername}
                  onChange={(e) => setNewTeacherUsername(e.target.value)}
                  placeholder="Contoh: guru.budi"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Kata Sandi Akun *</label>
                <input
                  required
                  type="password"
                  value={newTeacherPassword}
                  onChange={(e) => setNewTeacherPassword(e.target.value)}
                  placeholder="Minimal 8 karakter..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Email Guru (Opsional)</label>
                <input
                  type="email"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  placeholder="Contoh: budi@sekolah.sch.id"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Tugas Tambahan: Wali Kelas (Opsional)
                </label>
                <select
                  value={newTeacherHomeroomClassId}
                  onChange={(e) => setNewTeacherHomeroomClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="">-- Bukan Wali Kelas / Atur Nanti --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Wali Kelas {cls.name} (Tingkat {cls.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {formSubmitting ? "Menyimpan..." : "Simpan Data Guru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH ADMINISTRATOR                              */}
      {/* ======================================================== */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-slate-100 text-[#0D274C] border border-slate-200">
                <ShieldCheck className="w-5 h-5 text-[#0D274C]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tambah Administrator</h3>
                <p className="text-xs text-slate-500">
                  Buat akun pengelola sistem baru dengan hak akses penuh.
                </p>
              </div>
            </div>

            {formError && (
              <div className="my-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-3.5 text-xs mt-4">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap Administrator *</label>
                <input
                  required
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Contoh: Admin Akademik 2"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Username Login *</label>
                <input
                  required
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="Contoh: admin.dua"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Kata Sandi Akun *</label>
                <input
                  required
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Minimal 8 karakter..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Email Administrator (Opsional)</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@sekolah.sch.id"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {formSubmitting ? "Menyimpan..." : "Simpan Administrator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ADMINISTRATOR                                */}
      {/* ======================================================== */}
      {showEditAdminModal && editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-slate-100 text-[#0D274C] border border-slate-200">
                <ShieldCheck className="w-5 h-5 text-[#0D274C]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Akun Administrator</h3>
                <p className="text-xs text-slate-500">
                  Perbarui profil, username, atau reset kata sandi administrator.
                </p>
              </div>
            </div>

            {formError && (
              <div className="my-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditAdmin} className="space-y-3.5 text-xs mt-4">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap Administrator *</label>
                <input
                  required
                  type="text"
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  placeholder="Nama Administrator"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Username Login *</label>
                <input
                  required
                  type="text"
                  value={editAdminUsername}
                  onChange={(e) => setEditAdminUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Email Administrator</label>
                <input
                  type="email"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  placeholder="admin@sekolah.sch.id"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Ganti Kata Sandi (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru jika ingin reset..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={editAdminIsActive}
                    onChange={(e) => setEditAdminIsActive(e.target.checked)}
                    className="rounded accent-[#65C443] cursor-pointer"
                  />
                  <span className="font-medium">Status Akun Aktif</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditAdminModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {formSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: IMPOR PENGGUNA VIA CSV                            */}
      {/* ======================================================== */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] flex flex-col space-y-4 text-slate-800"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>Impor Data {bulkImportType === "student" ? "Siswa" : "Guru"} Massal (Excel)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unggah berkas spreadsheet Excel (.xlsx) untuk mendaftarkan akun {bulkImportType === "student" ? "siswa" : "guru"} secara massal.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkPreviewData(null);
                  setBulkError(null);
                  setBulkExcelRows([]);
                  setBulkExcelFileName("");
                  setBulkExcelFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Tutup"
              >
                ✕
              </button>
            </div>

            {bulkError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {!bulkPreviewData ? (
              <div className="space-y-4 flex-1 flex flex-col overflow-y-auto pr-1">
                {/* Template Download & Guide Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50 border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Unduh Template Resmi (.xlsx)</span>
                      </h4>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Gunakan berkas template Excel yang sudah dilengkapi contoh data dan panduan format.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadExcelTemplate(bulkImportType)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Template .xlsx</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-slate-700 space-y-1">
                    <p className="font-semibold text-emerald-950 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Petunjuk Penggunaan Template:</span>
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                      <li>
                        Kolom bertanda bintang (<strong className="text-red-500 font-bold">*</strong>) adalah data{" "}
                        <strong className="text-slate-900">Mandatory (Wajib Diisi)</strong>:{" "}
                        {bulkImportType === "student" ? (
                          <>
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">Nama Lengkap *</code>,{" "}
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">Username *</code>,{" "}
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">Password *</code>, dan{" "}
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">NIS *</code>.
                          </>
                        ) : (
                          <>
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">Nama Lengkap *</code>,{" "}
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">Username *</code>,{" "}
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">Password *</code>, dan{" "}
                            <code className="text-slate-800 bg-emerald-100/60 px-1 py-0.5 rounded">NIP *</code>.
                          </>
                        )}
                      </li>
                      <li>
                        Kolom lainnya bersifat <strong className="text-slate-900">Opsional</strong> (
                        {bulkImportType === "student"
                          ? "NISN, Jenis Kelamin, Email, Kelas"
                          : "NUPTK, Gelar, Jabatan, Jenis Kelamin, Email"}
                        ) dan <em>boleh dikosongkan</em> jika data belum lengkap.
                      </li>
                      <li>Jangan mengubah atau menghapus teks baris pertama (nama kolom header).</li>
                    </ul>
                  </div>
                </div>

                {/* File Upload Box */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Pilih Berkas Excel (.xlsx / .xls)</span>
                    {bulkExcelRows.length > 0 && (
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        ✓ {bulkExcelRows.length} baris data terbaca
                      </span>
                    )}
                  </label>

                  <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50 hover:bg-emerald-50/20">
                    <input
                      type="file"
                      id="bulk-excel-file-input"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleExcelFileSelected(file);
                      }}
                      className="hidden"
                    />

                    {bulkExcelFileName ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-slate-800">{bulkExcelFileName}</div>
                        <div className="text-[11px] text-slate-500">
                          {bulkExcelRows.length} baris data siap divalidasi
                        </div>
                        <label
                          htmlFor="bulk-excel-file-input"
                          className="mt-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline cursor-pointer"
                        >
                          Ganti Berkas Excel
                        </label>
                      </div>
                    ) : (
                      <label
                        htmlFor="bulk-excel-file-input"
                        className="flex flex-col items-center justify-center cursor-pointer space-y-2"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center group-hover:scale-105 transition">
                          <Upload className="w-6 h-6 text-[#0D274C]" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Klik untuk Memilih Berkas Excel (.xlsx)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Mendukung format .xlsx, .xls, atau .csv hasil ekspor
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Alternative: Raw CSV/Text toggle */}
                <details className="text-xs text-slate-600">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-800 font-medium select-none">
                    Atau tempel data teks / CSV langsung
                  </summary>
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={4}
                      value={bulkCsvText}
                      onChange={(e) => setBulkCsvText(e.target.value)}
                      placeholder="Tempel teks CSV dengan baris header di sini..."
                      className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                    />
                  </div>
                </details>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkPreview}
                    disabled={bulkLoading || (bulkExcelRows.length === 0 && !bulkCsvText.trim())}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    {bulkLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Memvalidasi...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau & Validasi Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between text-slate-700">
                  <span>
                    Total Baris: <strong>{bulkPreviewData.totalRows}</strong> | Siap Impor:{" "}
                    <strong className="text-emerald-600">{bulkPreviewData.validCount}</strong> | Kendala:{" "}
                    <strong className="text-red-600">{bulkPreviewData.invalidCount}</strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      bulkPreviewData.canCommit
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {bulkPreviewData.canCommit ? "Valid untuk Diimpor" : "Terdapat Kesalahan Validasi"}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto max-h-60 rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Baris</th>
                        <th className="py-2 px-3">
                          {bulkImportType === "student" ? "NIS" : "NIP"}
                        </th>
                        <th className="py-2 px-3">Nama Lengkap</th>
                        <th className="py-2 px-3">Username</th>
                        <th className="py-2 px-3">
                          {bulkImportType === "student" ? "Kelas" : "Jabatan"}
                        </th>
                        <th className="py-2 px-3">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {bulkPreviewData.rows.map((r: any) => (
                        <tr key={r.rowNumber} className={r.errors?.length ? "bg-red-50/50" : "hover:bg-slate-50/80"}>
                          <td className="py-2 px-3 text-slate-500 font-mono">#{r.rowNumber}</td>
                          <td className="py-2 px-3 text-slate-900 font-bold">{r.nis || r.nip || "-"}</td>
                          <td className="py-2 px-3 text-slate-800 font-sans font-medium">{r.displayName}</td>
                          <td className="py-2 px-3 text-slate-600">@{r.username}</td>
                          <td className="py-2 px-3 text-slate-600 font-sans">
                            {bulkImportType === "student"
                              ? r.className || <span className="text-slate-400 italic">Belum ditempatkan</span>
                              : r.position || "Guru"}
                          </td>
                          <td className="py-2 px-3">
                            {r.errors?.length ? (
                              <span className="text-red-600 font-sans text-[11px] font-medium">
                                ⚠ {r.errors.join(", ")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-sans text-[11px] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Siap
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBulkPreviewData(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
                  >
                    Kembali Ganti Berkas
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkCommit}
                    disabled={!bulkPreviewData.canCommit || bulkLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    {bulkLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Database...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Eksekusi Impor Data</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: KELOLA KATEGORI MAPEL KUSTOM                      */}
      {/* ======================================================== */}
      {showCategoryManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#0D274C]" />
                <span>Kategori Mata Pelajaran (Kustomisasi)</span>
              </h3>
              <button
                onClick={() => setShowCategoryManagerModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="flex gap-2">
              <input
                required
                type="text"
                placeholder="Nama Kategori (e.g. Muatan Kejuruan)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
              />
              <input
                type="text"
                placeholder="Kode (C3)"
                value={newCategoryCode}
                onChange={(e) => setNewCategoryCode(e.target.value)}
                className="w-24 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Tambah
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {subjectCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">{cat.name}</span>
                    {cat.code && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">
                        {cat.code}
                      </span>
                    )}
                    <span className="ml-2 text-slate-500 text-[11px]">
                      ({cat._count?.subjects || 0} Mapel)
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition cursor-pointer"
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setShowCategoryManagerModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer transition"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH MATA PELAJARAN                             */}
      {/* ======================================================== */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Mata Pelajaran</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tentukan kategori kurikulum dan jurusan pengampu (jika produktif/kejuruan).
            </p>

            <form onSubmit={handleCreateSubject} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">Kode Mapel *</label>
                <input
                  required
                  type="text"
                  placeholder="Contoh: RPL-PBO atau MAT-10"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Mata Pelajaran *</label>
                <input
                  required
                  type="text"
                  placeholder="Contoh: Pemrograman Berorientasi Objek"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Kategori Mapel</label>
                <select
                  value={newSubjectCategoryId}
                  onChange={(e) => setNewSubjectCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="">-- Tanpa Kategori Khusus --</option>
                  {subjectCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">
                  Pengelompokan Jurusan (Khusus Kejuruan / Produktif)
                </label>
                <select
                  value={newSubjectMajorId}
                  onChange={(e) => setNewSubjectMajorId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="">Umum (Berlaku untuk Semua Jurusan / Kelas)</option>
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#52a835] text-white font-medium shadow-sm transition cursor-pointer"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH ROMBEL KELAS                               */}
      {/* ======================================================== */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Rombel Kelas</h3>
            <p className="text-xs text-slate-500 mb-4">
              Buat rombongan belajar baru pada tahun ajaran aktif.
            </p>

            <form onSubmit={handleCreateClass} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Kelas *</label>
                <input
                  required
                  type="text"
                  placeholder="Contoh: X RPL 1 atau XI TKJ 2"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Tingkat Kelas *</label>
                  <select
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="10">Kelas 10 (X)</option>
                    <option value="11">Kelas 11 (XI)</option>
                    <option value="12">Kelas 12 (XII)</option>
                    <option value="13">Kelas 13 (XIII)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Jurusan / Keahlian</label>
                  <select
                    value={newClassMajorId}
                    onChange={(e) => setNewClassMajorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="">Umum / Tanpa Jurusan</option>
                    {majors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Wali Kelas (Opsional)</label>
                <select
                  value={newClassHomeroomTeacherId}
                  onChange={(e) => setNewClassHomeroomTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="">-- Pilih Guru Wali Kelas --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.displayName} ({t.nip || t.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white font-medium shadow-sm transition cursor-pointer"
                >
                  Simpan Rombel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: TAMBAH TAHUN AJARAN                               */}
      {/* ======================================================== */}
      {showAddYearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative text-slate-800"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Tambah Tahun Ajaran Baru</h3>
            <p className="text-xs text-slate-500 mb-4">
              Sistem akan otomatis menginisialisasi Semester Ganjil dan Genap.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch("/api/academic/years", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: newYearName,
                    startDate: newYearStart,
                    endDate: newYearEnd,
                    status: newYearStatus,
                  }),
                });
                if (res.ok) {
                  setShowAddYearModal(false);
                  setNewYearName("");
                  fetchYears();
                  router.refresh();
                } else {
                  const j = await res.json();
                  alert(j.error || "Gagal membuat tahun ajaran.");
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Tahun Ajaran *</label>
                <input
                  required
                  type="text"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  placeholder="Contoh: 2026/2027"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Tanggal Mulai *</label>
                  <input
                    required
                    type="date"
                    value={newYearStart}
                    onChange={(e) => setNewYearStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Tanggal Berakhir *</label>
                  <input
                    required
                    type="date"
                    value={newYearEnd}
                    onChange={(e) => setNewYearEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Status Awal</label>
                <select
                  value={newYearStatus}
                  onChange={(e) => setNewYearStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                >
                  <option value="draft">Draft (Belum Aktif)</option>
                  <option value="active">Langsung Aktif</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddYearModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white font-medium shadow-sm transition cursor-pointer"
                >
                  Simpan Tahun Ajaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL: EDIT DETAIL SISWA                                 */}
      {/* ======================================================== */}
      {showEditStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#65C443]" />
                  <span>Edit Data Siswa</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sesuaikan identitas, akun, dan status siswa secara rinci.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditStudentModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NIS (Nomor Induk Siswa)</label>
                  <input
                    type="text"
                    value={editStudentNis}
                    onChange={(e) => setEditStudentNis(e.target.value)}
                    placeholder="Contoh: 202601001"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NISN (Nasional)</label>
                  <input
                    type="text"
                    value={editStudentNisn}
                    onChange={(e) => setEditStudentNisn(e.target.value)}
                    placeholder="Contoh: 0081234567"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap Siswa *</label>
                <input
                  required
                  type="text"
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  placeholder="Contoh: Ahmad Fauzan"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Jenis Kelamin</label>
                  <select
                    value={editStudentGender}
                    onChange={(e) => setEditStudentGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="">-- Pilih Kelamin --</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Status Akun</label>
                  <select
                    value={editStudentIsActive ? "active" : "inactive"}
                    onChange={(e) => setEditStudentIsActive(e.target.value === "active")}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Username Login *</label>
                  <input
                    required
                    type="text"
                    value={editStudentUsername}
                    onChange={(e) => setEditStudentUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Email Siswa (Opsional)</label>
                  <input
                    type="email"
                    value={editStudentEmail}
                    onChange={(e) => setEditStudentEmail(e.target.value)}
                    placeholder="email@sekolah.sch.id"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block text-slate-700 mb-1 font-medium">
                  Ubah Kata Sandi (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={editStudentPassword}
                  onChange={(e) => setEditStudentPassword(e.target.value)}
                  placeholder="Ketik kata sandi baru minimal 6 karakter..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editStudentSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {editStudentSubmitting ? "Menyimpan..." : "Simpan Perubahan Siswa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT PROFIL GURU                                  */}
      {/* ======================================================== */}
      {showEditTeacherProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#65C443]" />
                  <span>Edit Profil & Akun Guru</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sesuaikan nama lengkap, gelar, NIP/NUPTK, kelamin, dan kredensial login.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditTeacherProfileModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditTeacherProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-700 mb-1 font-medium">Nama Lengkap Guru *</label>
                  <input
                    required
                    type="text"
                    value={editTeacherName}
                    onChange={(e) => setEditTeacherName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Gelar Akademik</label>
                  <input
                    type="text"
                    value={editTeacherTitle}
                    onChange={(e) => setEditTeacherTitle(e.target.value)}
                    placeholder="S.Pd., M.Kom."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NIP (Nomor Induk Pegawai)</label>
                  <input
                    type="text"
                    value={editTeacherNip}
                    onChange={(e) => setEditTeacherNip(e.target.value)}
                    placeholder="Contoh: 19800101..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">NUPTK</label>
                  <input
                    type="text"
                    value={editTeacherNuptk}
                    onChange={(e) => setEditTeacherNuptk(e.target.value)}
                    placeholder="Contoh: 1234567890123456"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Jenis Kelamin</label>
                  <select
                    value={editTeacherGender}
                    onChange={(e) => setEditTeacherGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="">-- Pilih Kelamin --</option>
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Status Akun</label>
                  <select
                    value={editTeacherIsActive ? "active" : "inactive"}
                    onChange={(e) => setEditTeacherIsActive(e.target.value === "active")}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Username Login *</label>
                  <input
                    required
                    type="text"
                    value={editTeacherUsername}
                    onChange={(e) => setEditTeacherUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 mb-1 font-medium">Email Guru</label>
                  <input
                    type="email"
                    value={editTeacherEmail}
                    onChange={(e) => setEditTeacherEmail(e.target.value)}
                    placeholder="guru@sekolah.sch.id"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block text-slate-700 mb-1 font-medium">
                  Ubah Kata Sandi (Kosongkan jika tidak diubah)
                </label>
                <input
                  type="password"
                  value={editTeacherPassword}
                  onChange={(e) => setEditTeacherPassword(e.target.value)}
                  placeholder="Ketik kata sandi baru minimal 6 karakter..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditTeacherProfileModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editTeacherProfileSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {editTeacherProfileSubmitting ? "Menyimpan..." : "Simpan Profil Guru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT JABATAN & PENUGASAN MENGAJAR GURU            */}
      {/* ======================================================== */}
      {showEditTeacherDutyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4 text-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#65C443]" />
                  <span>Jabatan & Penugasan Mengajar</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Guru: <strong className="text-slate-900">{editTeacherDutyTeacherName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditTeacherDutyModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEditTeacherDuty} className="space-y-4 text-xs">
              {/* Jabatan Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-slate-700 mb-1.5 font-medium">
                    Jabatan Utama Tenaga Pendidik *
                  </label>
                  <select
                    value={editTeacherPosition}
                    onChange={(e) => setEditTeacherPosition(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                  >
                    <option value="Guru">Guru</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                    <option value="Wakil Kepala Sekolah">Wakil Kepala Sekolah</option>
                    <option value="Bimbingan Konseling">Bimbingan Konseling (BK)</option>
                    <option value="Wali Kelas">Wali Kelas</option>
                  </select>
                </div>

                {editTeacherPosition === "Wali Kelas" ? (
                  <div>
                    <label className="block text-emerald-700 mb-1.5 font-medium">
                      Tugas Wali Kelas di Rombel *
                    </label>
                    <select
                      value={editTeacherHomeroomClassId}
                      onChange={(e) => setEditTeacherHomeroomClassId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-500/50 text-slate-900 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                    >
                      <option value="">-- Pilih Kelas yang Diwalikan --</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          Kelas {cls.name} (Tingkat {cls.gradeLevel})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-slate-500 pt-5">
                    Pilih &apos;Wali Kelas&apos; jika guru ditugaskan mengampu satu rombel kelas tertentu.
                  </div>
                )}
              </div>

              {/* Teaching Assignments Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#65C443]" />
                      <span>Mata Pelajaran & Kelas yang Diajar</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tentukan mapel apa saja yang diampu dan centang kelas mana saja guru mengajar mapel tersebut.
                    </p>
                  </div>

                  {/* Add Subject Dropdown */}
                  {subjects.filter(
                    (s) => !editTeacherTeachingAssignments.some((a) => a.subjectId === s.id)
                  ).length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        id="addSubjectSelect"
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-[#65C443]"
                        defaultValue=""
                        onChange={(e) => {
                          const subId = e.target.value;
                          if (!subId) return;
                          setEditTeacherTeachingAssignments([
                            ...editTeacherTeachingAssignments,
                            { subjectId: subId, classGroupIds: [] },
                          ]);
                          e.target.value = "";
                        }}
                      >
                        <option value="">+ Tambah Mapel Diampu</option>
                        {subjects
                          .filter(
                            (s) =>
                              !editTeacherTeachingAssignments.some((a) => a.subjectId === s.id)
                          )
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {editTeacherTeachingAssignments.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 text-xs">
                    Belum ada mata pelajaran yang ditugaskan kepada guru ini. Klik tombol &apos;+ Tambah Mapel Diampu&apos; di atas.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editTeacherTeachingAssignments.map((assignment, aIdx) => {
                      const subjectObj = subjects.find((s) => s.id === assignment.subjectId);
                      return (
                        <div
                          key={assignment.subjectId}
                          className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">
                                {subjectObj?.name || "Mata Pelajaran"}
                              </span>
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                {subjectObj?.code || "-"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditTeacherTeachingAssignments(
                                  editTeacherTeachingAssignments.filter((_, idx) => idx !== aIdx)
                                );
                              }}
                              className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus Mapel</span>
                            </button>
                          </div>

                          <div>
                            <div className="text-[11px] text-slate-600 font-medium mb-2">
                              Pilih Kelas di mana guru ini mengajar {subjectObj?.name}:
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {classes.map((cls) => {
                                const isAssigned = assignment.classGroupIds.includes(cls.id);
                                return (
                                  <label
                                    key={cls.id}
                                    className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center gap-2 transition ${
                                      isAssigned
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isAssigned}
                                      onChange={() => {
                                        const updated = [...editTeacherTeachingAssignments];
                                        if (isAssigned) {
                                          updated[aIdx].classGroupIds = updated[
                                            aIdx
                                          ].classGroupIds.filter((id) => id !== cls.id);
                                        } else {
                                          updated[aIdx].classGroupIds = [
                                            ...updated[aIdx].classGroupIds,
                                            cls.id,
                                          ];
                                        }
                                        setEditTeacherTeachingAssignments(updated);
                                      }}
                                      className="rounded accent-[#65C443]"
                                    />
                                    <span className="truncate">{cls.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditTeacherDutyModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editTeacherDutySubmitting}
                  className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer"
                >
                  {editTeacherDutySubmitting ? "Menyimpan..." : "Simpan Penugasan & Jabatan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL: UPDATE DATA SISWA SEKELAS                          */}
      {/* ======================================================== */}
      {showClassBulkUpdateModal && selectedClassForBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-4xl rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4 text-slate-800"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-[#65C443]" />
                  <span>Update Data Siswa Sekelas: {selectedClassForBulk.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tingkat {selectedClassForBulk.gradeLevel} • Jurusan:{" "}
                  {selectedClassForBulk.major?.name || "Umum"} • Total{" "}
                  <strong className="text-slate-800">{classBulkStudents.length} Siswa</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/academic/classes/${selectedClassForBulk.id}/export`}
                  download={`kredensial_siswa_${selectedClassForBulk.name}.csv`}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  title="Unduh File CSV Kredensial Siswa Kelas Ini"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor CSV Akun</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowClassBulkUpdateModal(false)}
                  className="text-slate-400 hover:text-slate-700 transition text-lg px-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Notification message */}
            {classBulkMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
                  classBulkMessage.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border border-rose-200 text-rose-800"
                }`}
              >
                {classBulkMessage.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>{classBulkMessage.text}</span>
              </div>
            )}

            {/* Sub-tabs inside modal */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setClassBulkTab("password")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  classBulkTab === "password"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                <span>Reset Password Seragam</span>
              </button>
              <button
                type="button"
                onClick={() => setClassBulkTab("status")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  classBulkTab === "status"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Status Akun Sekelas</span>
              </button>
              <button
                type="button"
                onClick={() => setClassBulkTab("batch")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  classBulkTab === "batch"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Rinci Siswa ({classBulkStudents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setClassBulkTab("reupload")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  classBulkTab === "reupload"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Re-upload CSV Ekspor</span>
              </button>
            </div>

            {/* TAB CONTENT: Reset Password Seragam */}
            {classBulkTab === "password" && (
              <form onSubmit={handleClassBulkSetPassword} className="space-y-4 text-xs pt-1">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                    <Key className="w-4 h-4 text-[#65C443]" />
                    <span>Setel Password Baru Serentak untuk Seluruh Siswa di Kelas {selectedClassForBulk.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Fitur ini akan langsung mengubah password login seluruh {classBulkStudents.length} siswa di rombel ini ke password yang Anda tentukan di bawah. Sangat berguna untuk persiapan ujian serentak, reset massal semester, atau pembagian kartu peserta ujian.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      minLength={6}
                      value={classBulkPassword}
                      onChange={(e) => setClassBulkPassword(e.target.value)}
                      placeholder="Masukkan password baru seragam (min. 6 karakter, contoh: Siswa2026!)"
                      className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setClassBulkPassword(`Nexam${Math.floor(1000 + Math.random() * 9000)}!`)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium cursor-pointer transition whitespace-nowrap"
                    >
                      Acak Password
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={classBulkSubmitting || !classBulkPassword.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{classBulkSubmitting ? "Menerapkan Password..." : "Terapkan Password Baru ke Semua Siswa"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB CONTENT: Status Akun Sekelas */}
            {classBulkTab === "status" && (
              <div className="space-y-4 text-xs pt-1">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-semibold text-slate-800 text-xs">Ubah Status Seluruh Siswa di Kelas Ini</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Anda dapat mengaktifkan seluruh akun siswa di kelas ini agar dapat langsung mengikuti ujian, atau menonaktifkan seluruh akun sementara saat masa evaluasi/libur semester.
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={classBulkSubmitting}
                      onClick={() => handleClassBulkSetStatus(true)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aktifkan Semua ({classBulkStudents.length} Siswa)</span>
                    </button>
                    <button
                      type="button"
                      disabled={classBulkSubmitting}
                      onClick={() => handleClassBulkSetStatus(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Nonaktifkan Semua Siswa</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Edit Rinci Siswa Sekelas */}
            {classBulkTab === "batch" && (
              <div className="space-y-3 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-slate-500">
                    Edit identitas atau ganti password perorangan langsung pada tabel di bawah, lalu klik Simpan Semua Perubahan.
                  </p>
                  <button
                    type="button"
                    disabled={classBulkSubmitting}
                    onClick={handleClassBatchSave}
                    className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{classBulkSubmitting ? "Menyimpan..." : "Simpan Semua Perubahan"}</span>
                  </button>
                </div>

                <div
                  className="rounded-xl overflow-hidden border border-slate-200 bg-white max-h-[48vh] overflow-y-auto"
                >
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 sticky top-0 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Nama Lengkap</th>
                        <th className="py-2.5 px-3">NIS</th>
                        <th className="py-2.5 px-3">NISN</th>
                        <th className="py-2.5 px-3">Username</th>
                        <th className="py-2.5 px-3">Password Saat Ini</th>
                        <th className="py-2.5 px-3">Ganti Password</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classBulkLoading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            Memuat daftar siswa...
                          </td>
                        </tr>
                      ) : classBulkStudents.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            Belum ada siswa yang ditempatkan di kelas ini.
                          </td>
                        </tr>
                      ) : (
                        classBulkStudents.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={s.displayName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setClassBulkStudents((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id ? { ...item, displayName: val } : item
                                    )
                                  );
                                }}
                                className="w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={s.nis}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setClassBulkStudents((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id ? { ...item, nis: val } : item
                                    )
                                  );
                                }}
                                className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-300 text-[#0D274C] font-semibold font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={s.nisn}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setClassBulkStudents((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id ? { ...item, nisn: val } : item
                                    )
                                  );
                                }}
                                className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={s.username}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setClassBulkStudents((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id ? { ...item, username: val } : item
                                    )
                                  );
                                }}
                                className="w-28 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                              />
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-amber-700">
                              {s.rawPassword || "(Terenkripsi)"}
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                placeholder="Kosong = tetap"
                                value={s.newPassword}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setClassBulkStudents((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id ? { ...item, newPassword: val } : item
                                    )
                                  );
                                }}
                                className="w-28 px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setClassBulkStudents((prev) =>
                                    prev.map((item) =>
                                      item.id === s.id ? { ...item, isActive: !item.isActive } : item
                                    )
                                  );
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                                  s.isActive
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {s.isActive ? "Aktif" : "Nonaktif"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Re-upload File CSV Ekspor */}
            {classBulkTab === "reupload" && (
              <div className="space-y-4 text-xs pt-1">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                    <Upload className="w-4 h-4 text-[#65C443]" />
                    <span>Perbarui Data Siswa Sekelas dengan Re-upload CSV Hasil Ekspor</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Unggah kembali file CSV yang sebelumnya Anda ekspor dari kelas ini (format: <code>kredensial_siswa_{selectedClassForBulk.name}.csv</code>) setelah Anda edit di Excel / Spreadsheet. Sistem akan secara otomatis mencocokkan siswa berdasarkan NIS/NISN/Username/Nama dan menampilkan rincian perubahan sebelum Anda menyetujuinya.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <label className="flex-1 w-full flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#65C443] bg-white cursor-pointer transition">
                      <Upload className="w-6 h-6 text-[#65C443] mb-1.5" />
                      <span className="text-xs text-slate-800 font-medium">
                        {classCsvFileName ? classCsvFileName : "Pilih atau Seret File CSV di Sini"}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        File ekspor CSV kelas (.csv)
                      </span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleClassCsvFileSelected}
                        className="hidden"
                      />
                    </label>

                    <a
                      href={`/api/academic/classes/${selectedClassForBulk.id}/export`}
                      download={`kredensial_siswa_${selectedClassForBulk.name}.csv`}
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-emerald-700 border border-slate-200 font-medium inline-flex items-center justify-center gap-1.5 transition text-xs whitespace-nowrap"
                      title="Unduh file CSV kelas ini untuk diedit"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh File CSV Kelas Ini</span>
                    </a>
                  </div>
                </div>

                {/* Previews if file parsed */}
                {classCsvMatchedStudents && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-xs text-slate-700">
                        Pratinjau:{" "}
                        <strong className="text-emerald-700">{classCsvMatchedStudents.length} Siswa Cocok</strong>
                        {classCsvUnmatchedCount > 0 && (
                          <span className="text-amber-700 ml-2">
                            ({classCsvUnmatchedCount} baris tidak cocok di kelas ini)
                          </span>
                        )}
                        {" • "}
                        <span className="text-slate-700">
                          {classCsvMatchedStudents.filter((m) => m.hasChanges).length} siswa memiliki perubahan
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          classBulkSubmitting ||
                          classCsvMatchedStudents.filter((m) => m.hasChanges).length === 0
                        }
                        onClick={handleApplyClassCsvChanges}
                        className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] disabled:opacity-50 text-white font-medium shadow-sm transition cursor-pointer flex items-center gap-1.5 text-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {classBulkSubmitting
                            ? "Menerapkan..."
                            : `Terapkan Perubahan (${classCsvMatchedStudents.filter((m) => m.hasChanges).length} Siswa)`}
                        </span>
                      </button>
                    </div>

                    <div
                      className="rounded-xl overflow-hidden border border-slate-200 bg-white max-h-64 overflow-y-auto"
                    >
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 sticky top-0 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 z-10">
                          <tr>
                            <th className="py-2 px-3 w-8 text-center">No</th>
                            <th className="py-2 px-3">Siswa</th>
                            <th className="py-2 px-3">Perubahan Terdeteksi</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-xs">
                          {classCsvMatchedStudents.map((item, idx) => (
                            <tr
                              key={item.id}
                              className={item.hasChanges ? "bg-emerald-50/40" : "hover:bg-slate-50/70"}
                            >
                              <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3 font-sans">
                                <div className="font-semibold text-slate-900">{item.original.displayName}</div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  NIS: {item.original.nis || "-"} • @{item.original.username}
                                </div>
                              </td>
                              <td className="py-2 px-3 font-sans">
                                {item.hasChanges ? (
                                  <div className="flex flex-wrap gap-1">
                                    {item.changes.map((ch: string, cIdx: number) => (
                                      <span
                                        key={cIdx}
                                        className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px]"
                                      >
                                        {ch}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px] italic">Tidak ada perubahan</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {item.hasChanges ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Akan Diupdate
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] text-slate-400">
                                    Sama
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
            )}

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowClassBulkUpdateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
