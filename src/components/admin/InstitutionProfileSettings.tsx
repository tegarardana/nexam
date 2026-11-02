/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Building2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Eye,
  Globe,
  Mail,
  Phone,
  MapPin,
  School,
  Sparkles,
  ShieldCheck,
  ImageIcon,
} from "lucide-react";

interface InstitutionSettingsData {
  appName: string;
  appLogo: string;
  appTagline: string;
  institutionName: string;
  institutionLogo: string;
  institutionNpsn: string;
  institutionAddress: string;
  institutionPhone: string;
  institutionEmail: string;
  institutionWebsite: string;
  institutionHeadmaster: string;
}

interface InstitutionProfileSettingsProps {
  onSettingsUpdated?: (settings: InstitutionSettingsData) => void;
}

export default function InstitutionProfileSettings({
  onSettingsUpdated,
}: InstitutionProfileSettingsProps) {
  const [formData, setFormData] = useState<InstitutionSettingsData>({
    appName: "Nexam",
    appLogo: "",
    appTagline: "School Assessment & Examination Suite",
    institutionName: "SMK Negeri 1 Contoh",
    institutionLogo: "",
    institutionNpsn: "",
    institutionAddress: "",
    institutionPhone: "",
    institutionEmail: "",
    institutionWebsite: "",
    institutionHeadmaster: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/institution");
      const data = await res.json();
      if (res.ok && data.success) {
        setFormData(data.settings);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Gagal memuat pengaturan lembaga",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        message: "Koneksi terputus saat mengambil data pengaturan",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback({
        type: "error",
        message: "Format file tidak didukung. Harap pilih gambar (PNG, JPG, WebP, SVG).",
      });
      return;
    }

    try {
      setUploadingLogo(true);
      setFeedback(null);

      const body = new FormData();
      body.append("file", file);
      body.append("target", "both");

      const res = await fetch("/api/settings/upload-logo", {
        method: "POST",
        body,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengunggah logo");
      }

      setFormData((prev) => {
        const next = {
          ...prev,
          appLogo: data.url,
          institutionLogo: data.url,
        };
        if (onSettingsUpdated) {
          onSettingsUpdated(next);
        }
        return next;
      });

      setFeedback({
        type: "success",
        message: "Logo berhasil diunggah dan disimpan sebagai logo aplikasi & instansi!",
      });

      // Dispatch custom event so listeners like AdminSidebar/Header update immediately
      window.dispatchEvent(
        new CustomEvent("nexam-settings-updated", {
          detail: {
            ...formData,
            appLogo: data.url,
            institutionLogo: data.url,
          },
        })
      );
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat mengunggah logo",
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);

      const res = await fetch("/api/settings/institution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan pengaturan");
      }

      setFeedback({
        type: "success",
        message: "Pengaturan profil lembaga dan aplikasi berhasil disimpan!",
      });

      if (onSettingsUpdated) {
        onSettingsUpdated(data.settings);
      }

      // Dispatch custom event for immediate dynamic refresh
      window.dispatchEvent(
        new CustomEvent("nexam-settings-updated", { detail: data.settings })
      );
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan pengaturan",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#0D274C]" />
        <p className="text-sm font-medium">Memuat pengaturan profil lembaga...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0D274C] to-[#163B6E] flex items-center justify-center text-[#65C443] shadow-md shadow-[#0D274C]/15 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Profil Lembaga & Branding Aplikasi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kelola logo resmi (PNG), nama instansi, serta identitas aplikasi CBT.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D274C] hover:bg-[#163B6E] text-white text-xs sm:text-sm font-bold shadow-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 text-[#65C443]" />
          )}
          <span>{saving ? "Menyimpan..." : "Simpan Perubahan"}</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-start gap-3 text-xs sm:text-sm animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span className="font-medium leading-relaxed">{feedback.message}</span>
        </div>
      )}

      {/* Grid: Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Settings Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Logo & Branding Aplikasi */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-[#65C443]" />
              <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
                Logo Instansi & Branding Aplikasi
              </h2>
            </div>

            {/* Logo Upload Section */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              {/* Logo Preview */}
              <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 relative overflow-hidden shadow-xs shrink-0 group">
                {formData.appLogo || formData.institutionLogo ? (
                  <img
                    src={formData.appLogo || formData.institutionLogo}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[10px] text-slate-400 mt-1">Default</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* Upload Controls & Instructions */}
              <div className="space-y-2 flex-1 text-center sm:text-left">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Upload Logo Resmi (PNG)</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Logo ini akan otomatis menggantikan logo aplikasi di header, sidebar admin, dan
                    badge login. Format PNG dengan background transparan sangat disarankan (maks. 5MB).
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    id="logo-file-input"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#0D274C]" />
                    <span>{uploadingLogo ? "Mengunggah..." : "Pilih Logo Baru"}</span>
                  </button>

                  {(formData.appLogo || formData.institutionLogo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          appLogo: "",
                          institutionLogo: "",
                        }));
                      }}
                      className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold transition cursor-pointer"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Input Nama & Slogan Aplikasi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Aplikasi CBT
                </label>
                <input
                  type="text"
                  name="appName"
                  value={formData.appName}
                  onChange={handleInputChange}
                  placeholder="Contoh: Nexam / CBT SMKN 1"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tampil pada title bar, header navbar, dan sidebar.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tagline / Subtitle Aplikasi
                </label>
                <input
                  type="text"
                  name="appTagline"
                  value={formData.appTagline}
                  onChange={handleInputChange}
                  placeholder="Contoh: School Assessment & Examination Suite"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tampil pada halaman login dan dokumen cetak.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Profil Lembaga / Sekolah */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <School className="w-4 h-4 text-indigo-600" />
              <h2 className="font-extrabold text-sm sm:text-base text-slate-800">
                Profil & Identitas Lembaga
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Instansi / Sekolah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  name="institutionName"
                  value={formData.institutionName}
                  onChange={handleInputChange}
                  placeholder="Contoh: SMK Negeri 1 Surabaya / SMA Teladan"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Nama ini akan ditampilkan pada badge halaman login serta kop laporan nilai.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NPSN (Nomor Pokok Sekolah Nasional)
                </label>
                <input
                  type="text"
                  name="institutionNpsn"
                  value={formData.institutionNpsn}
                  onChange={handleInputChange}
                  placeholder="Contoh: 20501234"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kepala Sekolah / Pimpinan
                </label>
                <input
                  type="text"
                  name="institutionHeadmaster"
                  value={formData.institutionHeadmaster}
                  onChange={handleInputChange}
                  placeholder="Contoh: Drs. H. Ahmad Santoso, M.Pd"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Alamat Lengkap Instansi</span>
                </label>
                <textarea
                  rows={2}
                  name="institutionAddress"
                  value={formData.institutionAddress}
                  onChange={handleInputChange}
                  placeholder="Contoh: Jl. Ahmad Yani No. 123, Surabaya, Jawa Timur"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Telepon / WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    name="institutionPhone"
                    value={formData.institutionPhone}
                    onChange={handleInputChange}
                    placeholder="Contoh: (031) 8291234 / 08123456789"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Resmi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    name="institutionEmail"
                    value={formData.institutionEmail}
                    onChange={handleInputChange}
                    placeholder="Contoh: info@smkn1surabaya.sch.id"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Website Resmi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    name="institutionWebsite"
                    value={formData.institutionWebsite}
                    onChange={handleInputChange}
                    placeholder="Contoh: https://smkn1surabaya.sch.id"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-[#65C443] focus:ring-3 focus:ring-[#65C443]/15 transition"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Live Preview Card */}
        <div className="space-y-6">
          <div className="bg-[#0D274C] rounded-2xl text-white p-5 sm:p-6 shadow-md border border-[#163B6E] relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-[#65C443]/15 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10 text-[#65C443] font-bold text-xs uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              <span>Preview Live Login Page</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Tampilan badge baru pada halaman login pengguna (menggantikan badge statis CBT sebelumnya):
            </p>

            {/* Simulated Login Badge */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-start gap-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Badge Halaman Login:
              </div>
              <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold shadow-xs">
                {formData.appLogo || formData.institutionLogo ? (
                  <img
                    src={formData.appLogo || formData.institutionLogo}
                    alt="Logo"
                    className="w-5 h-5 object-contain rounded-full bg-white/10 p-0.5"
                  />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#65C443]" />
                )}
                <span className="font-extrabold tracking-tight">
                  {formData.appName || "Nexam"}
                </span>
                <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-[#65C443] text-white">
                  CBT Platform
                </span>
              </div>
            </div>

            {/* Simulated Header Brand */}
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs flex flex-col items-start gap-3">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Header & Sidebar Brand:
              </div>
              <div className="flex items-center gap-2.5">
                {formData.appLogo || formData.institutionLogo ? (
                  <div className="w-8 h-8 rounded-xl bg-white/10 p-1 border border-white/20 flex items-center justify-center">
                    <img
                      src={formData.appLogo || formData.institutionLogo}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#65C443] to-emerald-400 flex items-center justify-center text-white">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-white">
                      {formData.appName || "Nexam"}
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-bold bg-[#65C443] text-white">
                      CBT
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300">
                    {formData.institutionName || "School Platform"}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary info */}
            <div className="mt-5 pt-4 border-t border-white/10 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">NPSN:</span>
                <span className="font-semibold text-white">{formData.institutionNpsn || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Kepala Sekolah:</span>
                <span className="font-semibold text-white truncate max-w-[150px]">
                  {formData.institutionHeadmaster || "-"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

