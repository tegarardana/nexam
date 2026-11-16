"use client";

import React, { useState } from "react";
import {
  X,
  UserCheck,
  Plus,
  Trash2,
  DoorOpen,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatNameWithTitle } from "@/lib/format-user";

interface ProctorItem {
  id: string;
  proctorId: string;
  displayName?: string;
  title?: string | null;
  formattedName?: string;
  username?: string;
  nip?: string | null;
  roomName?: string | null;
}

interface TeacherOption {
  id: string;
  displayName?: string | null;
  name?: string;
  title?: string | null;
  username?: string;
  nip?: string | null;
}

interface ProctorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  examinationId: string;
  examinationTitle: string;
  initialProctors?: ProctorItem[];
  allTeachers?: TeacherOption[];
  onSuccess?: () => void;
}

export default function ProctorManagementModal({
  isOpen,
  onClose,
  examinationId,
  examinationTitle,
  initialProctors = [],
  allTeachers = [],
  onSuccess,
}: ProctorManagementModalProps) {
  const [proctors, setProctors] = useState<ProctorItem[]>(initialProctors);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Proctor Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [roomNameInput, setRoomNameInput] = useState("");

  if (!isOpen) return null;

  // Filter available teachers who are not yet assigned
  const assignedProctorIds = new Set(proctors.map((p) => p.proctorId));
  const availableTeachers = allTeachers.filter(
    (t) => !assignedProctorIds.has(t.id)
  );

  const handleAddProctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      setErrorMsg("Pilih guru pengawas yang akan ditugaskan.");
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/examinations/${examinationId}/proctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proctorId: selectedTeacherId,
          roomName: roomNameInput.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || "Gagal menugaskan pengawas.");
        return;
      }

      const assignedTeacher = allTeachers.find((t) => t.id === selectedTeacherId);
      const newProctorItem: ProctorItem = {
        id: json.data?.id || `p_${Date.now()}`,
        proctorId: selectedTeacherId,
        displayName: assignedTeacher?.displayName || assignedTeacher?.name || "Guru",
        title: assignedTeacher?.title,
        formattedName: json.data?.formattedName || formatNameWithTitle(assignedTeacher?.displayName || assignedTeacher?.name || "Guru", assignedTeacher?.title),
        username: assignedTeacher?.username,
        nip: assignedTeacher?.nip,
        roomName: roomNameInput.trim() || null,
      };

      setProctors((prev) => [...prev, newProctorItem]);
      setSelectedTeacherId("");
      setRoomNameInput("");
      setSuccessMsg("Pengawas berhasil ditambahkan.");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Terjadi kesalahan saat menambahkan pengawas.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveProctor = async (proctorId: string, name: string) => {
    if (!confirm(`Hapus ${name} dari daftar pengawas ujian ini?`)) {
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/examinations/${examinationId}/proctor`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proctorId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg(json.error || "Gagal menghapus pengawas.");
        return;
      }

      setProctors((prev) => prev.filter((p) => p.proctorId !== proctorId));
      setSuccessMsg("Pengawas berhasil dihapus dari ujian.");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Terjadi kesalahan saat menghapus pengawas.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Kelola Pengawas Ujian
              </h2>
              <p className="text-xs text-slate-500 line-clamp-1">
                {examinationTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Tambah Pengawas */}
          <form
            onSubmit={handleAddProctor}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                Tambah Pengawas Baru
              </span>
              <span className="text-[11px] text-slate-500">
                Tersedia: {availableTeachers.length} guru
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Pilih Guru Pengawas *
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Pilih Guru --</option>
                  {availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatNameWithTitle(t.displayName || t.name, t.title)}
                      {t.nip ? ` (NIP: ${t.nip})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">
                  Nama Ruang / Lab (Opsional)
                </label>
                <div className="relative">
                  <DoorOpen className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: Ruang 01 / Lab A"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={actionLoading || !selectedTeacherId}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {actionLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Tugaskan Pengawas</span>
              </button>
            </div>
          </form>

          {/* Daftar Pengawas Aktif */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Pengawas Ditugaskan ({proctors.length})</span>
            </div>

            {proctors.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-1.5">
                <UserCheck className="w-7 h-7 mx-auto text-slate-400" />
                <div className="text-xs font-semibold text-slate-700">
                  Belum Ada Pengawas yang Ditugaskan
                </div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Semua guru pengampu tetap dapat mengakses monitoring ujian, namun menunjuk pengawas khusus membantu pembagian ruang dan koordinasi live.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {proctors.map((item) => {
                  const displayName =
                    item.formattedName ||
                    formatNameWithTitle(item.displayName, item.title);
                  return (
                    <div
                      key={item.proctorId}
                      className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {displayName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {displayName}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            {item.nip && <span>NIP: {item.nip}</span>}
                            {item.username && <span>@{item.username}</span>}
                            {item.roomName ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                                {item.roomName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">
                                Semua Ruangan
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveProctor(item.proctorId, displayName)}
                        disabled={actionLoading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                        title="Hapus pengawas ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}