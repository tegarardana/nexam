-- AlterTable users
ALTER TABLE "users" ADD COLUMN "nis" TEXT,
ADD COLUMN "nisn" TEXT,
ADD COLUMN "nip" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_nis_key" ON "users"("nis");
CREATE UNIQUE INDEX "users_nisn_key" ON "users"("nisn");
CREATE UNIQUE INDEX "users_nip_key" ON "users"("nip");

-- AlterTable class_groups
ALTER TABLE "class_groups" ADD COLUMN "homeroom_teacher_id" UUID;

-- AlterTable subjects
ALTER TABLE "subjects" ADD COLUMN "category_id" UUID,
ADD COLUMN "major_id" UUID;

-- CreateTable subject_categories
CREATE TABLE "subject_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_categories_name_key" ON "subject_categories"("name");
CREATE UNIQUE INDEX "subject_categories_code_key" ON "subject_categories"("code");

-- AddForeignKey
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_homeroom_teacher_id_fkey" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "subject_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "majors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
