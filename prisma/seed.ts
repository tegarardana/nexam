import "dotenv/config";
import prisma from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";

const PERMISSIONS = [
  // Authentication & Account
  { name: "auth:login", module: "auth", description: "Login to the system" },
  { name: "auth:password_change", module: "auth", description: "Change own password" },
  { name: "auth:profile_view", module: "auth", description: "View own profile" },
  { name: "user:read", module: "users", description: "View user accounts" },
  { name: "user:create", module: "users", description: "Create user accounts" },
  { name: "user:import", module: "users", description: "Bulk import user accounts" },
  { name: "user:update", module: "users", description: "Edit user profile and status" },
  { name: "user:status_change", module: "users", description: "Activate or deactivate accounts" },
  { name: "user:password_reset", module: "users", description: "Reset another user's password" },
  { name: "user:role_assign", module: "users", description: "Assign or modify user roles" },
  { name: "user:audit_view", module: "users", description: "View account audit history" },

  // Academic Structure
  { name: "academic:read", module: "academic", description: "View academic structure and classes" },
  { name: "academic:create", module: "academic", description: "Create academic years, semesters, majors, classes, subjects" },
  { name: "academic:update", module: "academic", description: "Edit academic years, semesters, majors, classes, subjects" },
  { name: "academic:enroll", module: "academic", description: "Assign students to class groups" },
  { name: "academic:promote", module: "academic", description: "Bulk promote students" },
  { name: "academic:wizard", module: "academic", description: "Run new academic year rollover wizard" },

  // Question Bank
  { name: "question:read", module: "questions", description: "View question banks" },
  { name: "question:create", module: "questions", description: "Create new questions" },
  { name: "question:update", module: "questions", description: "Edit draft questions and create new versions" },
  { name: "question:publish", module: "questions", description: "Publish validated questions" },
  { name: "question:archive", module: "questions", description: "Archive questions" },
  { name: "question:media_upload", module: "questions", description: "Upload media assets for questions" },

  // Examination Management
  { name: "examination:read", module: "examinations", description: "View examinations" },
  { name: "examination:create", module: "examinations", description: "Create examination" },
  { name: "examination:update", module: "examinations", description: "Edit draft examination" },
  { name: "examination:publish", module: "examinations", description: "Publish or schedule examination" },
  { name: "examination:close", module: "examinations", description: "Close examination" },
  { name: "examination:assign_participant", module: "examinations", description: "Assign classes/students to examination" },
  { name: "examination:assign_proctor", module: "examinations", description: "Assign proctors to examination" },
  { name: "examination:policy_configure", module: "examinations", description: "Configure anti-cheat policy" },

  // Examination Delivery (Student)
  { name: "examination:start", module: "delivery", description: "Start assigned examination" },
  { name: "examination:save_answer", module: "delivery", description: "Save answers to attempt" },
  { name: "examination:submit", module: "delivery", description: "Submit completed attempt" },
  { name: "examination:resume", module: "delivery", description: "Resume disconnected attempt" },

  // Live Proctoring
  { name: "proctor:view_live", module: "proctoring", description: "View real-time proctor dashboard" },
  { name: "proctor:warning", module: "proctoring", description: "Issue warnings to student" },
  { name: "proctor:block", module: "proctoring", description: "Manually block student exam attempt" },
  { name: "proctor:unlock", module: "proctoring", description: "Unlock blocked student exam attempt" },
  { name: "proctor:intervention_note", module: "proctoring", description: "Record proctor intervention note" },

  // Grading and Results
  { name: "grading:read", module: "grading", description: "View student examination results" },
  { name: "grading:grade_essay", module: "grading", description: "Grade essay questions" },
  { name: "grading:save_draft", module: "grading", description: "Save draft grade scores" },
  { name: "grading:finalize", module: "grading", description: "Finalize exam grading" },
  { name: "grading:modify_finalized", module: "grading", description: "Modify finalized grade with audit" },
  { name: "grading:publish_result", module: "grading", description: "Publish exam results" },
  { name: "grading:export_report", module: "grading", description: "Export grade reports (CSV/XLSX)" },

  // Platform Administration & Audit
  { name: "report:audit_view", module: "reports", description: "View system audit logs" },
  { name: "report:export", module: "reports", description: "Export system and activity reports" },
  { name: "system:settings_view", module: "system", description: "View system configurations" },
  { name: "system:settings_edit", module: "system", description: "Modify system configurations" },
  { name: "system:backup", module: "system", description: "Manage database backup and restore" },
];

const TEACHER_PERMISSIONS = [
  "auth:login",
  "auth:password_change",
  "auth:profile_view",
  "academic:read",
  "question:read",
  "question:create",
  "question:update",
  "question:publish",
  "question:archive",
  "question:media_upload",
  "examination:read",
  "examination:create",
  "examination:update",
  "examination:publish",
  "examination:close",
  "examination:assign_participant",
  "examination:policy_configure",
  "proctor:view_live",
  "proctor:warning",
  "proctor:block",
  "proctor:unlock",
  "proctor:intervention_note",
  "grading:read",
  "grading:grade_essay",
  "grading:save_draft",
  "grading:finalize",
  "grading:publish_result",
  "grading:export_report",
  "report:export",
];

const STUDENT_PERMISSIONS = [
  "auth:login",
  "auth:password_change",
  "auth:profile_view",
  "academic:read",
  "examination:read",
  "examination:start",
  "examination:save_answer",
  "examination:submit",
  "examination:resume",
  "grading:read",
];

async function main() {
  console.log("🌱 Starting Nexam database seed...");

  // 1. Roles
  const roles = ["administrator", "teacher", "student"];
  const roleEntities: Record<string, { id: string; name: string }> = {};

  for (const rName of roles) {
    const role = await prisma.role.upsert({
      where: { name: rName },
      update: {},
      create: {
        name: rName,
        description: `Default system role for ${rName}`,
      },
    });
    roleEntities[rName] = role;
    console.log(`  ✓ Role: ${rName}`);
  }

  // 2. Permissions
  const permissionEntities: Record<string, { id: string; name: string }> = {};
  for (const p of PERMISSIONS) {
    const perm = await prisma.permission.upsert({
      where: { name: p.name },
      update: { description: p.description, module: p.module },
      create: {
        name: p.name,
        description: p.description,
        module: p.module,
      },
    });
    permissionEntities[p.name] = perm;
  }
  console.log(`  ✓ Seeded ${PERMISSIONS.length} permissions`);

  // 3. Role Permissions mapping
  // Administrator: All permissions
  for (const perm of Object.values(permissionEntities)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: roleEntities["administrator"].id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: roleEntities["administrator"].id,
        permissionId: perm.id,
      },
    });
  }

  // Teacher: TEACHER_PERMISSIONS
  for (const pName of TEACHER_PERMISSIONS) {
    if (permissionEntities[pName]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleEntities["teacher"].id,
            permissionId: permissionEntities[pName].id,
          },
        },
        update: {},
        create: {
          roleId: roleEntities["teacher"].id,
          permissionId: permissionEntities[pName].id,
        },
      });
    }
  }

  // Student: STUDENT_PERMISSIONS
  for (const pName of STUDENT_PERMISSIONS) {
    if (permissionEntities[pName]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleEntities["student"].id,
            permissionId: permissionEntities[pName].id,
          },
        },
        update: {},
        create: {
          roleId: roleEntities["student"].id,
          permissionId: permissionEntities[pName].id,
        },
      });
    }
  }
  console.log("  ✓ Configured role permissions");

  // 4. Default Administrator
  const adminPasswordHash = await hashPassword("AdminPassword123!");
  const adminUser = await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminPasswordHash },
    create: {
      username: "admin",
      displayName: "Administrator Nexam",
      email: "admin@sekolah.sch.id",
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: roleEntities["administrator"].id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: roleEntities["administrator"].id,
    },
  });
  console.log("  ✓ Created Admin: admin / AdminPassword123!");

  // 5. Academic Structure
  const academicYear = await prisma.academicYear.upsert({
    where: { name: "2025/2026" },
    update: { status: "active" },
    create: {
      name: "2025/2026",
      startDate: new Date("2025-07-15"),
      endDate: new Date("2026-06-30"),
      status: "active",
    },
  });
  console.log("  ✓ Academic Year: 2025/2026 (active)");

  // Semesters
  const semesterGanjil = await prisma.semester.upsert({
    where: {
      academicYearId_name: {
        academicYearId: academicYear.id,
        name: "Ganjil",
      },
    },
    update: { status: "active" },
    create: {
      academicYearId: academicYear.id,
      name: "Ganjil",
      startDate: new Date("2025-07-15"),
      endDate: new Date("2025-12-20"),
      status: "active",
    },
  });

  await prisma.semester.upsert({
    where: {
      academicYearId_name: {
        academicYearId: academicYear.id,
        name: "Genap",
      },
    },
    update: {},
    create: {
      academicYearId: academicYear.id,
      name: "Genap",
      startDate: new Date("2026-01-05"),
      endDate: new Date("2026-06-25"),
      status: "draft",
    },
  });
  console.log("  ✓ Semesters: Ganjil (active), Genap (draft)");

  // Majors
  const majorRPL = await prisma.major.upsert({
    where: { code: "RPL" },
    update: {},
    create: {
      code: "RPL",
      name: "Rekayasa Perangkat Lunak",
      description: "Program keahlian pengembangan aplikasi dan sistem perangkat lunak",
    },
  });

  const majorTKJ = await prisma.major.upsert({
    where: { code: "TKJ" },
    update: {},
    create: {
      code: "TKJ",
      name: "Teknik Komputer dan Jaringan",
      description: "Program keahlian jaringan komputer dan infrastruktur telekomunikasi",
    },
  });
  console.log("  ✓ Majors: RPL, TKJ");

  // 5. Subject Categories
  const catNasional = await prisma.subjectCategory.upsert({
    where: { name: "Muatan Nasional" },
    update: {},
    create: { name: "Muatan Nasional", code: "A", description: "Mata pelajaran wajib nasional" },
  });

  const catKewilayahan = await prisma.subjectCategory.upsert({
    where: { name: "Muatan Kewilayahan" },
    update: {},
    create: { name: "Muatan Kewilayahan", code: "B", description: "Seni budaya dan penjasorkes" },
  });

  const catKejuruan = await prisma.subjectCategory.upsert({
    where: { name: "Konsentrasi Keahlian" },
    update: {},
    create: { name: "Konsentrasi Keahlian", code: "C2", description: "Kompetensi kejuruan produktif spesifik" },
  });

  const catMulok = await prisma.subjectCategory.upsert({
    where: { name: "Muatan Lokal" },
    update: {},
    create: { name: "Muatan Lokal", code: "MULOK", description: "Bahasa daerah dan kearifan lokal" },
  });
  console.log("  ✓ Subject Categories: Muatan Nasional, Kewilayahan, Konsentrasi Keahlian, Mulok");

  // Sample Teacher
  const teacherPasswordHash = await hashPassword("GuruBudi123!");
  const teacherUser = await prisma.user.upsert({
    where: { username: "guru.budi" },
    update: {
      passwordHash: teacherPasswordHash,
      nip: "198503152010011002",
    },
    create: {
      username: "guru.budi",
      displayName: "Budi Prasetyo, S.Kom",
      email: "budi.prasetyo@sekolah.sch.id",
      nip: "198503152010011002",
      passwordHash: teacherPasswordHash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: teacherUser.id,
        roleId: roleEntities["teacher"].id,
      },
    },
    update: {},
    create: {
      userId: teacherUser.id,
      roleId: roleEntities["teacher"].id,
    },
  });
  console.log("  ✓ Created Teacher: guru.budi (NIP: 198503152010011002)");

  // Class Groups
  const classXRpl1 = await prisma.classGroup.upsert({
    where: {
      name_academicYearId: {
        name: "X RPL 1",
        academicYearId: academicYear.id,
      },
    },
    update: {
      homeroomTeacherId: teacherUser.id,
    },
    create: {
      name: "X RPL 1",
      gradeLevel: 10,
      majorId: majorRPL.id,
      academicYearId: academicYear.id,
      homeroomTeacherId: teacherUser.id,
      isActive: true,
    },
  });

  const classXTkj1 = await prisma.classGroup.upsert({
    where: {
      name_academicYearId: {
        name: "X TKJ 1",
        academicYearId: academicYear.id,
      },
    },
    update: {},
    create: {
      name: "X TKJ 1",
      gradeLevel: 10,
      majorId: majorTKJ.id,
      academicYearId: academicYear.id,
      isActive: true,
    },
  });
  console.log("  ✓ Class Groups: X RPL 1 (Wali Kelas: Budi Prasetyo), X TKJ 1");

  // Subjects
  const subjectPBO = await prisma.subject.upsert({
    where: { code: "RPL-PBO" },
    update: {
      categoryId: catKejuruan.id,
      majorId: majorRPL.id,
    },
    create: {
      code: "RPL-PBO",
      name: "Pemrograman Berorientasi Objek",
      category: "Konsentrasi Keahlian",
      categoryId: catKejuruan.id,
      majorId: majorRPL.id,
      description: "Dasar dan implementasi konsep OOP",
    },
  });

  const subjectMat = await prisma.subject.upsert({
    where: { code: "MAT-10" },
    update: {
      categoryId: catNasional.id,
    },
    create: {
      code: "MAT-10",
      name: "Matematika Umum Kelas 10",
      category: "Muatan Nasional",
      categoryId: catNasional.id,
      description: "Matematika tingkat sekolah menengah kejuruan",
    },
  });
  console.log("  ✓ Subjects: RPL-PBO (Kejuruan RPL), MAT-10 (Nasional)");

  // Subject Offering & Teacher Assignment
  const offeringPBO = await prisma.subjectOffering.upsert({
    where: {
      subjectId_classGroupId_semesterId: {
        subjectId: subjectPBO.id,
        classGroupId: classXRpl1.id,
        semesterId: semesterGanjil.id,
      },
    },
    update: {},
    create: {
      subjectId: subjectPBO.id,
      classGroupId: classXRpl1.id,
      semesterId: semesterGanjil.id,
      academicYearId: academicYear.id,
    },
  });

  await prisma.teacherAssignment.upsert({
    where: {
      teacherId_subjectOfferingId: {
        teacherId: teacherUser.id,
        subjectOfferingId: offeringPBO.id,
      },
    },
    update: {},
    create: {
      teacherId: teacherUser.id,
      subjectOfferingId: offeringPBO.id,
    },
  });
  console.log("  ✓ Assigned teacher guru.budi to RPL-PBO in X RPL 1");

  // 6. Sample Students & Enrollments
  const student1Hash = await hashPassword("SiswaAndi123!");
  const student1 = await prisma.user.upsert({
    where: { username: "siswa.andi" },
    update: {
      passwordHash: student1Hash,
      nis: "202501001",
      nisn: "0081234567",
    },
    create: {
      username: "siswa.andi",
      displayName: "Andi Pratama",
      email: "andi.pratama@siswa.sekolah.sch.id",
      nis: "202501001",
      nisn: "0081234567",
      passwordHash: student1Hash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: student1.id,
        roleId: roleEntities["student"].id,
      },
    },
    update: {},
    create: {
      userId: student1.id,
      roleId: roleEntities["student"].id,
    },
  });

  await prisma.studentEnrollment.upsert({
    where: {
      studentId_academicYearId: {
        studentId: student1.id,
        academicYearId: academicYear.id,
      },
    },
    update: { classGroupId: classXRpl1.id },
    create: {
      studentId: student1.id,
      classGroupId: classXRpl1.id,
      academicYearId: academicYear.id,
      status: "active",
    },
  });

  const student2Hash = await hashPassword("SiswaBunga123!");
  const student2 = await prisma.user.upsert({
    where: { username: "siswa.bunga" },
    update: {
      passwordHash: student2Hash,
      nis: "202501002",
      nisn: "0081234568",
    },
    create: {
      username: "siswa.bunga",
      displayName: "Bunga Lestari",
      email: "bunga.lestari@siswa.sekolah.sch.id",
      nis: "202501002",
      nisn: "0081234568",
      passwordHash: student2Hash,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: student2.id,
        roleId: roleEntities["student"].id,
      },
    },
    update: {},
    create: {
      userId: student2.id,
      roleId: roleEntities["student"].id,
    },
  });

  await prisma.studentEnrollment.upsert({
    where: {
      studentId_academicYearId: {
        studentId: student2.id,
        academicYearId: academicYear.id,
      },
    },
    update: { classGroupId: classXRpl1.id },
    create: {
      studentId: student2.id,
      classGroupId: classXRpl1.id,
      academicYearId: academicYear.id,
      status: "active",
    },
  });

  console.log("  ✓ Created Students: siswa.andi, siswa.bunga enrolled in X RPL 1");
  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
