import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApi } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import {
  bulkUserActionSchema,
  bulkImportUsersSchema,
  bulkStudentRowSchema,
  bulkTeacherRowSchema,
} from "@/lib/validation/user";

interface NormalizedRowData {
  rowNumber: number;
  username: string;
  displayName: string;
  password: string;
  email?: string | null;
  gender?: string | null;
  nis?: string | null;
  nisn?: string | null;
  className?: string | null;
  nip?: string | null;
  nuptk?: string | null;
  title?: string | null;
  position?: string | null;
  [key: string]: any;
}

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (!key) continue;
    // Strip asterisk, parentheses, and leading/trailing whitespace
    const cleanKey = key
      .trim()
      .toLowerCase()
      .replace(/\*/g, "")
      .replace(/\(.*?\)/g, "")
      .trim();

    const strVal =
      typeof val === "string"
        ? val.trim()
        : val !== null && val !== undefined
        ? String(val).trim()
        : "";

    if (["username", "user", "nama pengguna"].includes(cleanKey)) {
      normalized.username = strVal;
    } else if (
      [
        "nama lengkap",
        "nama",
        "displayname",
        "nama siswa",
        "nama guru",
      ].includes(cleanKey)
    ) {
      normalized.displayName = strVal;
    } else if (["password", "kata sandi", "pass"].includes(cleanKey)) {
      normalized.password = strVal;
    } else if (["email", "surel"].includes(cleanKey)) {
      normalized.email = strVal;
    } else if (["jenis kelamin", "jk", "gender"].includes(cleanKey)) {
      let g = strVal.toUpperCase();
      if (g.startsWith("L") || g === "PRIA") g = "L";
      else if (g.startsWith("P") || g === "WANITA") g = "P";
      normalized.gender = g || "";
    } else if (["nis", "nomor induk siswa"].includes(cleanKey)) {
      normalized.nis = strVal;
    } else if (["nisn", "nomor induk siswa nasional"].includes(cleanKey)) {
      normalized.nisn = strVal;
    } else if (["kelas", "rombel", "class", "classname"].includes(cleanKey)) {
      normalized.className = strVal;
    } else if (["nip", "nomor induk pegawai"].includes(cleanKey)) {
      normalized.nip = strVal;
    } else if (["nuptk"].includes(cleanKey)) {
      normalized.nuptk = strVal;
    } else if (["gelar", "title"].includes(cleanKey)) {
      normalized.title = strVal;
    } else if (["jabatan", "position"].includes(cleanKey)) {
      normalized.position = strVal || "Guru";
    }
  }
  return normalized;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Bulk User Actions (Activate / Deactivate / Delete)
    if (body.action && body.userIds) {
      const auth = await authenticateApi("user:update");
      if (auth instanceof NextResponse) return auth;

      const parsed = bulkUserActionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validasi gagal", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { userIds, action } = parsed.data;
      let updatedCount = 0;

      if (action === "activate") {
        const res = await prisma.user.updateMany({
          where: { id: { in: userIds }, archivedAt: null },
          data: { isActive: true },
        });
        updatedCount = res.count;
      } else if (action === "deactivate") {
        const res = await prisma.user.updateMany({
          where: { id: { in: userIds }, archivedAt: null },
          data: { isActive: false },
        });
        updatedCount = res.count;
      } else if (action === "delete") {
        const deleteAuth = await authenticateApi("user:delete");
        if (deleteAuth instanceof NextResponse) return deleteAuth;

        const res = await prisma.user.updateMany({
          where: { id: { in: userIds }, archivedAt: null },
          data: {
            archivedAt: new Date(),
            isActive: false,
          },
        });
        updatedCount = res.count;
      }

      await logAudit({
        actorId: auth.user.id,
        action: `user:bulk_${action}`,
        entityType: "users",
        entityId: "bulk",
        afterValue: { action, count: updatedCount, userIds },
      });

      return NextResponse.json({
        success: true,
        message: `Aksi massal (${action}) berhasil diproses untuk ${updatedCount} pengguna.`,
        count: updatedCount,
      });
    }

    // 2. Bulk User Import (Preview or Commit)
    if (body.rows && body.importType) {
      const auth = await authenticateApi("user:create");
      if (auth instanceof NextResponse) return auth;

      const parsed = bulkImportUsersSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Data impor tidak valid", details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { rows, preview, importType } = parsed.data;
      let academicYearId = parsed.data.academicYearId;

      // Find active academic year if not provided
      if (!academicYearId && importType === "student") {
        const activeYear = await prisma.academicYear.findFirst({
          where: { status: "active" },
          select: { id: true },
        });
        academicYearId = activeYear?.id || null;
      }

      // Fetch existing classes in this academic year for class name mapping
      const classMap = new Map<string, string>(); // class name (lowercase) -> classGroupId
      if (academicYearId) {
        const classes = await prisma.classGroup.findMany({
          where: { academicYearId, isActive: true },
          select: { id: true, name: true },
        });
        for (const c of classes) {
          classMap.set(c.name.trim().toLowerCase(), c.id);
        }
      }

      // Pre-normalize all rows
      const normalizedRows: NormalizedRowData[] = rows.map((r, idx) => ({
        rowNumber: idx + 1,
        ...normalizeRow(r),
      } as NormalizedRowData));

      // Gather candidate keys to check against database in bulk
      const candidateUsernames = normalizedRows.map((r) => r.username).filter((x): x is string => Boolean(x));
      const candidateNis = normalizedRows.map((r) => r.nis).filter((x): x is string => Boolean(x));
      const candidateNisn = normalizedRows.map((r) => r.nisn).filter((x): x is string => Boolean(x));
      const candidateNip = normalizedRows.map((r) => r.nip).filter((x): x is string => Boolean(x));

      const [existingUsers, existingNisUsers, existingNisnUsers, existingNipUsers] = await Promise.all([
        prisma.user.findMany({
          where: { username: { in: candidateUsernames } },
          select: { username: true },
        }),
        candidateNis.length > 0
          ? prisma.user.findMany({
              where: { nis: { in: candidateNis } },
              select: { nis: true },
            })
          : Promise.resolve([]),
        candidateNisn.length > 0
          ? prisma.user.findMany({
              where: { nisn: { in: candidateNisn } },
              select: { nisn: true },
            })
          : Promise.resolve([]),
        candidateNip.length > 0
          ? prisma.user.findMany({
              where: { nip: { in: candidateNip } },
              select: { nip: true },
            })
          : Promise.resolve([]),
      ]);

      const dbUsernames = new Set(existingUsers.map((u) => u.username.toLowerCase()));
      const dbNis = new Set(existingNisUsers.map((u) => u.nis));
      const dbNisn = new Set(existingNisnUsers.map((u) => u.nisn));
      const dbNip = new Set(existingNipUsers.map((u) => u.nip));

      // Track occurrences within the uploaded file to detect duplicates inside the spreadsheet
      const seenUsernames = new Set<string>();
      const seenNis = new Set<string>();
      const seenNisn = new Set<string>();
      const seenNip = new Set<string>();

      const validationResults: any[] = [];
      let validCount = 0;
      let invalidCount = 0;

      for (const row of normalizedRows) {
        const errors: string[] = [];

        // Zod schema validation
        const rowSchema = importType === "student" ? bulkStudentRowSchema : bulkTeacherRowSchema;
        const schemaRes = rowSchema.safeParse(row);

        if (!schemaRes.success) {
          const fieldErrors = schemaRes.error.flatten().fieldErrors;
          for (const [field, msgs] of Object.entries(fieldErrors)) {
            if (msgs && msgs.length > 0) {
              errors.push(msgs[0]);
            }
          }
        }

        // Uniqueness checks for Username (Mandatory)
        if (row.username) {
          const uLower = row.username.toLowerCase();
          if (dbUsernames.has(uLower)) {
            errors.push(`Username '${row.username}' sudah terdaftar di sistem`);
          } else if (seenUsernames.has(uLower)) {
            errors.push(`Username '${row.username}' duplikat di dalam berkas`);
          } else {
            seenUsernames.add(uLower);
          }
        } else {
          if (!errors.some((e) => e.toLowerCase().includes("username"))) {
            errors.push("Username wajib diisi (*)");
          }
        }

        // Uniqueness checks for NIS (Optional)
        if (row.nis) {
          if (dbNis.has(row.nis)) {
            errors.push(`NIS '${row.nis}' sudah terdaftar untuk siswa lain`);
          } else if (seenNis.has(row.nis)) {
            errors.push(`NIS duplikat di berkas: ${row.nis}`);
          } else {
            seenNis.add(row.nis);
          }
        }

        // Uniqueness checks for NISN (Optional)
        if (row.nisn) {
          if (dbNisn.has(row.nisn)) {
            errors.push(`NISN '${row.nisn}' sudah terdaftar`);
          } else if (seenNisn.has(row.nisn)) {
            errors.push(`NISN duplikat di berkas: ${row.nisn}`);
          } else {
            seenNisn.add(row.nisn);
          }
        }

        // Uniqueness checks for NIP (Optional)
        if (row.nip) {
          if (dbNip.has(row.nip)) {
            errors.push(`NIP '${row.nip}' sudah terdaftar untuk guru lain`);
          } else if (seenNip.has(row.nip)) {
            errors.push(`NIP duplikat di berkas: ${row.nip}`);
          } else {
            seenNip.add(row.nip);
          }
        }

        // Check class group if provided (Optional)
        let resolvedClassGroupId: string | null = null;
        if (importType === "student" && row.className) {
          const matchedId = classMap.get(row.className.toLowerCase());
          if (matchedId) {
            resolvedClassGroupId = matchedId;
          }
        }

        const isValid = errors.length === 0;
        if (isValid) validCount++;
        else invalidCount++;

        validationResults.push({
          rowNumber: row.rowNumber,
          nis: row.nis || null,
          nip: row.nip || null,
          displayName: row.displayName || "",
          username: row.username || "",
          gender: row.gender || null,
          email: row.email || null,
          className: row.className || null,
          resolvedClassGroupId,
          title: row.title || null,
          position: row.position || "Guru",
          nuptk: row.nuptk || null,
          password: row.password || "",
          errors,
        });
      }

      const canCommit = invalidCount === 0 && validCount > 0;

      // If preview mode, return validation report
      if (preview) {
        return NextResponse.json({
          success: true,
          totalRows: normalizedRows.length,
          validCount,
          invalidCount,
          canCommit,
          rows: validationResults,
        });
      }

      // If commit mode
      if (!canCommit) {
        return NextResponse.json(
          {
            success: false,
            error: "Terdapat kesalahan validasi pada berkas. Perbaiki data sebelum mengimpor.",
            totalRows: normalizedRows.length,
            validCount,
            invalidCount,
            canCommit: false,
            rows: validationResults,
          },
          { status: 400 }
        );
      }

      // Find role
      const roleRecord = await prisma.role.findUnique({
        where: { name: importType },
      });
      if (!roleRecord) {
        return NextResponse.json(
          { success: false, error: `Peran '${importType}' tidak ditemukan di sistem.` },
          { status: 500 }
        );
      }

      // Hash passwords
      const hashedRows = await Promise.all(
        validationResults.map(async (item) => {
          const passwordHash = await hashPassword(item.password);
          return {
            ...item,
            passwordHash,
          };
        })
      );

      // Perform atomic insertion in transaction
      const createdUsers = await prisma.$transaction(async (tx) => {
        const usersCreated = [];
        for (const item of hashedRows) {
          const user = await tx.user.create({
            data: {
              username: item.username,
              displayName: item.displayName,
              email: item.email || null,
              passwordHash: item.passwordHash,
              rawPassword: item.password,
              isActive: true,
              gender: item.gender || null,
              nis: importType === "student" ? item.nis || null : null,
              nisn: importType === "student" ? item.nisn || null : null,
              nip: importType === "teacher" ? item.nip || null : null,
              nuptk: importType === "teacher" ? item.nuptk || null : null,
              title: importType === "teacher" ? item.title || null : null,
              position: importType === "teacher" ? item.position || "Guru" : null,
              createdById: auth.user.id,
            },
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleRecord.id,
              grantedById: auth.user.id,
            },
          });

          if (importType === "student" && item.resolvedClassGroupId && academicYearId) {
            await tx.studentEnrollment.create({
              data: {
                studentId: user.id,
                classGroupId: item.resolvedClassGroupId,
                academicYearId,
                status: "active",
              },
            });
          }

          usersCreated.push(user);
        }
        return usersCreated;
      });

      await logAudit({
        actorId: auth.user.id,
        action: `user:import_${importType}`,
        entityType: "users",
        entityId: "bulk_import",
        afterValue: {
          importType,
          count: createdUsers.length,
          usernames: createdUsers.map((u) => u.username),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mengimpor ${createdUsers.length} data akun ${
          importType === "student" ? "siswa" : "guru"
        } ke sistem.`,
        count: createdUsers.length,
      });
    }

    return NextResponse.json(
      { success: false, error: "Permintaan tidak dikenali atau payload tidak lengkap." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST /api/users/bulk error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses aksi massal pengguna" },
      { status: 500 }
    );
  }
}
