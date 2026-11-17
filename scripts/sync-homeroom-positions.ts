import prisma from "../src/lib/prisma";
import { syncAllHomeroomTeacherPositions } from "../src/lib/academic-sync";

async function main() {
  console.log("🔄 Starting homeroom teacher position synchronization...");

  const result = await syncAllHomeroomTeacherPositions();

  console.log("✅ Synchronization completed successfully:");
  console.log(`   - Active homeroom teachers found: ${result.activeHomeroomTeacherCount}`);
  console.log(`   - Teachers updated to 'Wali Kelas': ${result.updatedToWaliKelasCount}`);
  console.log(`   - Users reverted to 'Guru': ${result.revertedToGuruCount}`);

  // Print current status of all teachers
  const teachers = await prisma.user.findMany({
    where: { userRoles: { some: { role: { name: "teacher" } } } },
    include: {
      homeroomClasses: {
        where: { isActive: true },
        select: { name: true },
      },
    },
    orderBy: { displayName: "asc" },
  });

  console.log("\n📋 Current Teacher Roster:");
  for (const t of teachers) {
    const classes = t.homeroomClasses.map((c) => c.name).join(", ") || "-";
    console.log(`   • ${t.displayName} (${t.username}): Position='${t.position}' | Homeroom='${classes}'`);
  }
}

main()
  .catch((err) => {
    console.error("❌ Error during synchronization:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
