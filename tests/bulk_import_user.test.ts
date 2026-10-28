import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  bulkStudentRowSchema,
  bulkTeacherRowSchema,
  bulkImportUsersSchema,
} from "../src/lib/validation/user";

describe("Bulk Import User (XLSX) Validation & Normalization", () => {
  it("should validate student row with complete data", () => {
    const row = {
      displayName: "Ahmad Fauzan Pratama",
      username: "siswa.ahmad",
      password: "Password123!",
      nis: "202601001",
      nisn: "0081234561",
      gender: "L",
      email: "ahmad@sekolah.sch.id",
      className: "X RPL 1",
    };
    const res = bulkStudentRowSchema.safeParse(row);
    expect(res.success).toBe(true);
  });

  it("should validate student row with ONLY mandatory (*) fields filled (displayName, username, password, nis)", () => {
    // Only displayName, username, password, and nis provided
    const row = {
      displayName: "Bela Safitri",
      username: "siswa.bela",
      password: "Password123!",
      nis: "202601002",
    };
    const res = bulkStudentRowSchema.safeParse(row);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.nis).toBe("202601002");
      expect(res.data.nisn).toBeUndefined();
      expect(res.data.gender).toBeUndefined();
      expect(res.data.email).toBeUndefined();
      expect(res.data.className).toBeUndefined();
    }
  });

  it("should fail student row when mandatory (*) fields are missing or invalid", () => {
    // Missing NIS
    const noNis = bulkStudentRowSchema.safeParse({
      displayName: "Bela Safitri",
      username: "siswa.bela",
      password: "Password123!",
      nis: "",
    });
    expect(noNis.success).toBe(false);

    // Missing password
    const noPass = bulkStudentRowSchema.safeParse({
      displayName: "Citra",
      username: "siswa.citra",
      password: "",
      nis: "202601003",
    });
    expect(noPass.success).toBe(false);

    // Short password (< 6 chars)
    const shortPass = bulkStudentRowSchema.safeParse({
      displayName: "Citra",
      username: "siswa.citra",
      password: "123",
      nis: "202601003",
    });
    expect(shortPass.success).toBe(false);

    // Missing displayName (< 2 chars)
    const noName = bulkStudentRowSchema.safeParse({
      displayName: "A",
      username: "siswa.citra",
      password: "Password123!",
      nis: "202601003",
    });
    expect(noName.success).toBe(false);

    // Invalid username (contains space)
    const spaceUsername = bulkStudentRowSchema.safeParse({
      displayName: "Citra",
      username: "siswa citra",
      password: "Password123!",
      nis: "202601003",
    });
    expect(spaceUsername.success).toBe(false);
  });

  it("should validate teacher row with complete data", () => {
    const row = {
      displayName: "Ahmad Fauzi",
      username: "guru.ahmad",
      password: "GuruPassword123!",
      nip: "198501012010011001",
      nuptk: "1234567890123456",
      title: "M.Pd.",
      position: "Guru",
      gender: "L",
      email: "ahmad.fauzi@sekolah.sch.id",
    };
    const res = bulkTeacherRowSchema.safeParse(row);
    expect(res.success).toBe(true);
  });

  it("should validate teacher row with ONLY mandatory (*) fields filled (displayName, username, password, nip)", () => {
    const row = {
      displayName: "Dewi Sartika",
      username: "guru.dewi",
      password: "GuruPassword123!",
      nip: "199002022015012002",
    };
    const res = bulkTeacherRowSchema.safeParse(row);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.nip).toBe("199002022015012002");
      expect(res.data.nuptk).toBeUndefined();
      expect(res.data.title).toBeUndefined();
      expect(res.data.gender).toBeUndefined();
      expect(res.data.email).toBeUndefined();
      expect(res.data.position).toBe("Guru"); // default
    }
  });

  it("should fail teacher row when NIP is missing", () => {
    const noNip = bulkTeacherRowSchema.safeParse({
      displayName: "Dewi Sartika",
      username: "guru.dewi",
      password: "GuruPassword123!",
      nip: "",
    });
    expect(noNip.success).toBe(false);
  });

  it("should validate bulk import request schema", () => {
    const valid = bulkImportUsersSchema.safeParse({
      rows: [
        {
          "Nama Lengkap *": "Siswa Satu",
          "Username *": "siswa.satu",
          "Password *": "Pass123!",
        },
      ],
      preview: true,
      importType: "student",
      academicYearId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(valid.success).toBe(true);

    const emptyRows = bulkImportUsersSchema.safeParse({
      rows: [],
      preview: false,
      importType: "teacher",
    });
    expect(emptyRows.success).toBe(false);
  });

  it("should generate and read Excel (.xlsx) workbook with SheetJS", () => {
    const wb = XLSX.utils.book_new();

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
      ["Ahmad Fauzan", "siswa.ahmad", "Pass123!", "202601001", "0081234561", "L", "ahmad@sch.id", "X RPL 1"],
      ["Bela Safitri", "siswa.bela", "Pass123!", "202601002", "", "P", "", ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");

    // Write to buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(buffer).toBeDefined();

    // Read back
    const readWb = XLSX.read(buffer, { type: "buffer" });
    expect(readWb.SheetNames).toContain("Template Siswa");

    const sheet = readWb.Sheets["Template Siswa"];
    const parsedRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    expect(parsedRows.length).toBe(2);
    expect(parsedRows[0]["Nama Lengkap *"]).toBe("Ahmad Fauzan");
    expect(parsedRows[0]["Username *"]).toBe("siswa.ahmad");
    expect(String(parsedRows[0]["NIS *"])).toBe("202601001");
    expect(parsedRows[1]["Nama Lengkap *"]).toBe("Bela Safitri");
    expect(String(parsedRows[1]["NIS *"])).toBe("202601002");
  });
});
