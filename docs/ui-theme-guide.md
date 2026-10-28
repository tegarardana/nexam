# Pedoman Desain & Acuan Tema UI Nexam (Cisco NetAcad Light Mode)

Dokumen ini merupakan panduan resmi dan sumber acuan tunggal (*Single Source of Truth*) untuk desain antarmuka, komponen, dan palet warna di seluruh aplikasi Nexam (Admin, Guru, Siswa). Panduan ini disusun berdasarkan standardisasi antarmuka pada Panel Administrasi (*Admin Management Panel*).

---

## 1. Filosofi & Palet Warna

Tema Nexam mengadopsi estetika **Cisco Networking Academy (NetAcad) Light Mode** yang bersih, ramah mata, profesional, dan memiliki kontras tinggi.

### 1.1 Color Tokens

| Token | Nilai Hex | Tailwind Class Representatif | Kegunaan Utama |
| :--- | :--- | :--- | :--- |
| **NetAcad Green (Primary CTA)** | `#65C443` | `bg-[#65C443]` / `text-[#65C443]` | Tombol Simpan/Aksi Utama, indikator aktif, focus ring input, badge sukses |
| **NetAcad Green (Hover)** | `#57b237` | `hover:bg-[#57b237]` | Status hover tombol utama |
| **NetAcad Green (Active/Dark)**| `#52a835` | `active:bg-[#52a835]` | Status tekan/klik tombol utama |
| **Cisco Navy (Secondary Brand)**| `#0D274C` | `text-[#0D274C]` / `bg-[#0D274C]` | Heading spesifik, badge identitas, ikon brand |
| **Background Kanvas/Aplikasi** | `#F8FAFC` | `bg-[#F8FAFC]` / `bg-slate-50` | Background halaman utama (*main content area*) |
| **Surface (Card / Dialog / Box)**| `#FFFFFF` | `bg-white` | Kontainer card, baris tabel, modal popup, input field |
| **Surface Muted (Secondary)** | `#F1F5F9` | `bg-slate-100` / `bg-slate-50` | Background header tabel (`thead`), tombol Batal/Cancel, sub-card |
| **Border Utama (Card & Table)** | `#E2E8F0` | `border-slate-200` | Garis pembatas card, tabel, modal dialog, divider |
| **Border Form / Input** | `#CBD5E1` | `border-slate-300` | Garis tepi elemen input, select, textarea |
| **Teks Heading / Kontras Tinggi**| `#0F172A` | `text-slate-900` | Judul modal, angka statistik card, judul tabel |
| **Teks Isi / Konten Utama** | `#1E293B` | `text-slate-800` | Isi baris tabel, teks isi formulir, opsi select |
| **Teks Label Input** | `#334155` | `text-slate-700` | Label formulir input (`font-medium`) |
| **Teks Deskripsi / Muted** | `#64748B` | `text-slate-500` | Subtitle, keterangan di bawah judul, timestamp |
| **Teks Placeholder** | `#94A3B8` | `placeholder:text-slate-400` | Placeholder input teks/textarea |

---

## 2. Formulir & Input Field

Semua input form wajib menggunakan latar belakang putih bersih dengan border 1px yang tegas dan efek ring warna hijau NetAcad saat menerima fokus.

### 2.1 Spesifikasi Input Field (`<input>`, `<select>`, `<textarea>`)
```html
<!-- Input Teks Standar -->
<input
  type="text"
  placeholder="Contoh input teks..."
  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443] font-medium"
/>

<!-- Input Monospace (NIS, NISN, Username, Kode Mapel) -->
<input
  type="text"
  placeholder="202601001"
  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs font-mono focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
/>

<!-- Dropdown / Select Option -->
<select
  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
>
  <option value="">-- Pilih Opsi --</option>
  <option value="1">Opsi A</option>
</select>
```

### 2.2 Spesifikasi Label Input
```html
<label className="block text-slate-700 mb-1 font-medium text-xs">
  Nama Lengkap Siswa *
</label>
```

---

## 3. Komponen Tombol (Buttons & CTA)

### 3.1 Primary Action (Simpan / Tambah / Submit)
Menggunakan warna hijau khas Cisco NetAcad:
```html
<button
  type="submit"
  className="px-4 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] active:bg-[#52a835] text-white font-medium text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
>
  <span>Simpan Data</span>
</button>
```

### 3.2 Secondary / Cancel Action (Batal / Kembali / Tutup)
Menggunakan warna netral slate terang:
```html
<button
  type="button"
  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
>
  Batal
</button>
```

### 3.3 Soft Action / Export / Secondary Link
```html
<a
  href="/api/export"
  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 transition"
>
  <Download className="w-3.5 h-3.5" />
  <span>Ekspor Data</span>
</a>
```

### 3.4 Danger Action (Hapus / Nonaktifkan)
```html
<!-- Tombol Teks Danger (Hapus baris) -->
<button
  type="button"
  className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 transition cursor-pointer"
>
  <Trash2 className="w-3.5 h-3.5" />
  <span>Hapus</span>
</button>

<!-- Tombol Solid Danger -->
<button
  type="button"
  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-sm transition cursor-pointer"
>
  Hapus Permanen
</button>
```

---

## 4. Modal, Dialog, & Pop-up

Semua pop-up wajib menggunakan container putih dengan shadow lembut dan backdrop blur.

```html
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
  <div className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-800">
    <!-- Header Modal -->
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
      <div>
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#65C443]" />
          <span>Judul Modal Dialog</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Deskripsi singkat instruksi modal form di sini.
        </p>
      </div>
      <button
        type="button"
        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>

    <!-- Body Form -->
    <form className="space-y-4 text-xs">
      <div>
        <label className="block text-slate-700 mb-1 font-medium">Nama Bidang *</label>
        <input
          type="text"
          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#65C443] focus:ring-1 focus:ring-[#65C443]"
        />
      </div>

      <!-- Footer Modal -->
      <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
        <button
          type="button"
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
        >
          Batal
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-[#65C443] hover:bg-[#57b237] text-white font-medium shadow-sm transition cursor-pointer"
        >
          Simpan Data
        </button>
      </div>
    </form>
  </div>
</div>
```

---

## 5. Card & Statistik Widgets

Card menggunakan background putih dengan border halus 1px dan shadow tipis (`shadow-sm`).

### 5.1 Stat Metric Card
```html
<div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
  <div>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Siswa Aktif</p>
    <h3 className="text-2xl font-bold text-slate-900 mt-1">1,248</h3>
    <span className="text-[11px] text-emerald-700 font-medium mt-1 inline-flex items-center gap-1">
      <CheckCircle2 className="w-3.5 h-3.5" /> 100% Terverifikasi
    </span>
  </div>
  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#0D274C]">
    <Users className="w-6 h-6" />
  </div>
</div>
```

---

## 6. Tabel Data (*Data Tables*)

Struktur tabel data harus jelas, mudah dibaca, dan memiliki pemisah yang halus.

```html
<div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
  <table className="w-full text-left text-xs">
    <!-- Header Tabel -->
    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
      <tr>
        <th className="py-3 px-4 w-12 text-center">No</th>
        <th className="py-3 px-4">Nama Lengkap</th>
        <th className="py-3 px-4">NIS / Identitas</th>
        <th className="py-3 px-4">Status</th>
        <th className="py-3 px-4 text-right">Aksi</th>
      </tr>
    </thead>
    <!-- Isi Baris Tabel -->
    <tbody className="divide-y divide-slate-100 text-slate-800">
      <tr className="hover:bg-slate-50/70 transition-colors">
        <td className="py-3 px-4 text-center text-slate-400 font-mono">1</td>
        <td className="py-3 px-4 font-medium text-slate-900">Ahmad Fauzan</td>
        <td className="py-3 px-4 font-mono text-[#0D274C] font-semibold">202601001</td>
        <td className="py-3 px-4">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Aktif
          </span>
        </td>
        <td className="py-3 px-4 text-right">
          <button className="text-slate-600 hover:text-slate-900 font-medium text-xs">
            Edit
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 7. Status Badges & Alerts

| Jenis Status | Background & Border | Warna Teks | Contoh Penggunaan |
| :--- | :--- | :--- | :--- |
| **Success / Aktif** | `bg-emerald-50 border-emerald-200` | `text-emerald-700` | Akun aktif, Ujian selesai, Siswa cocok |
| **Warning / Perhatian** | `bg-amber-50 border-amber-200` | `text-amber-800` | Protokol anti-cheat, Password belum diubah |
| **Danger / Error** | `bg-rose-50 border-rose-200` | `text-rose-700` | Akun nonaktif, Gagal import, Form error |
| **Info / Netral** | `bg-slate-100 border-slate-200` | `text-slate-700` | Kategori mapel, Tag rombel umum |

---

## 8. Panduan "Do's & Don'ts"

### ✅ Do's (Dianjurkan):
1. **Gunakan warna hijau `#65C443` sebagai CTA primer:** Tombol Simpan, Buat Baru, Mulai Ujian, dan Ring Focus.
2. **Gunakan `bg-white` untuk semua input field:** Memastikan teks dan placeholder terbaca kontras di atas kanvas `bg-[#F8FAFC]`.
3. **Gunakan border 1px yang konsisten:** `border-slate-300` untuk input field, `border-slate-200` untuk card/tabel.
4. **Gunakan font monospaced (`font-mono`)** untuk kode unik, NIP, NIS, NISN, dan username agar terstruktur rapi.
5. **Gunakan backdrop `bg-slate-900/40 backdrop-blur-xs`** untuk semua pop-up modal dialog.

### ❌ Don'ts (Dilarang):
1. **Jangan menggunakan warna input gelap:** Hindari `bg-gray-900`, `bg-slate-800`, atau `border-gray-800` di dalam form.
2. **Jangan menggunakan warna CTA cyan/ungu/indigo sembarangan:** Konsisten gunakan hijau NetAcad `#65C443` sebagai tombol utama.
3. **Jangan gunakan teks putih di atas card terang:** Pastikan semua teks di card dan tabel menggunakan `text-slate-900`, `text-slate-800`, atau `text-slate-700`.
4. **Hindari shadow pekat gelap:** Gunakan `shadow-sm` untuk card dan `shadow-2xl` lembut untuk modal dialog.
