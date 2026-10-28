# Nexam – Implementation Plan

**Version:** 0.2 (Phase 0 revised)  
**Last updated:** 2026-10-23  
**Status:** Phase 0 complete – pending stakeholder approval of architecture documents before Phase 1 begins

---

## 0. Repository State at Phase 0

| Item | Status |
|------|--------|
| Repository files | `prd.md` only (greenfield) |
| Framework chosen | **Next.js 16.x App Router** (verified 2026-10-20) |
| Database | **PostgreSQL 16** (PRD §14; confirmed) |
| Existing schema | None |
| Existing tests | None |
| Existing Docker config | None |
| Existing CI pipeline | None |

---

## 1. Delivery Phases

### Phase 0 – Foundation and Architecture Planning *(current)*

**Goal:** Produce a reviewed, approved blueprint before writing any application code.

Deliverables:
- [x] `implementation-plan.md` (this file)
- [x] `docs/architecture.md`
- [x] `docs/database-schema.md`
- [x] `docs/permissions-matrix.md`
- [x] `docs/examination-lifecycle.md`
- [x] `docs/anti-cheat-policy.md`
- [x] `docs/deployment.md`

**Exit criteria:** All deliverables reviewed and approved by the responsible stakeholder. Open architectural decisions resolved.

---

### Phase 1 – Authentication and Academic Management *(completed)*

**Goal:** Working, tested multi-role authentication and full academic-structure management with no mock data.

Status: **COMPLETED** (2026-10-23)

Deliverables:
- [x] Project scaffold: Next.js 16.4.2 App Router, TypeScript, Prisma 7.10.1 with PostgreSQL adapter, Zod, Tailwind CSS v4.
- [x] Docker Compose setup (`docker-compose.yml`, `.env.example`, `.env`) with PostgreSQL 16 Alpine and MinIO.
- [x] Prisma migration (`20261023100024_init_phase1`) applied to PostgreSQL.
- [x] Initial database seed (`npm run db:seed`) with 3 roles, 52 permissions, default admin (`admin`), teacher (`guru.budi`), students (`siswa.andi`, `siswa.bunga`), and academic year `2025/2026`.
- [x] Server-side authentication: Argon2id password hashing, SHA-256 session tokens, HTTP-only cookie (`nexam_session`), and brute-force rate limiter.
- [x] RBAC enforcement engine (`src/lib/auth/rbac.ts`) protecting all API routes with role and permission checks.
- [x] Role-specific dashboard shells:
  - Student Portal (`/student`): academic placement (X RPL 1), scheduled exams widget, and server anti-cheat notice.
  - Teacher Portal (`/teacher`): curriculum assignment (`RPL-PBO` in `X RPL 1`), student count, and exam workflow shortcuts.
  - Administrator Portal (`/admin`): separate metrics cards (Peserta Didik, Guru, Rombel/Kelas, Program Keahlian), academic years & semesters with manual active toggle, classes & majors with inline student enrollment assignment, customizable subject categories with major-level grouping, separate student & teacher management tabs, and audit log viewer.
- [x] Separate User Management & CSV Import:
  - Siswa: `nis` (mandatory student identification number), `nisn` (optional identity), `username` (login credential), `displayName`, `password`, `email`. Class placement optional upon creation/import.
  - Guru: `nip` (mandatory identifier), `username`, `displayName`, `email`, `password`, homeroom teacher assignment, and assigned subjects.
- [x] Academic Control: Direct manual active activation for academic years and semesters (Ganjil/Genap) independent of calendar dates.
- [x] Class Group Student Assignment: Inline modal to assign unassigned students to classes and designate homeroom teachers (wali kelas).
- [x] Custom Subject Categories & Major Grouping: Subject categories can be added/deleted dynamically, and subjects can be linked to specific majors or marked as Umum.
- [x] Student placement management and bulk promotion endpoint (`PUT /api/academic/enrollments`).
- [x] Append-only audit logger (`src/lib/audit.ts`) capturing actor, action, entity, IP address, and sanitized values.
- [x] Automated test suite: 14 passing Vitest unit tests (`npm test`) covering Argon2id, session token hashing, RBAC matrix, and Zod validation.

**Exit criteria:** All Phase 1 deliverables operational with PostgreSQL 16 persistence, no mock permissions, and zero compilation errors.

---

### Phase 2 – Question Bank and Examination Configuration

Scope:
- [x] Prisma database synchronization for: `questions`, `question_versions`, `question_options`, `question_media`, `question_categories`, `examinations`, `examination_questions`, `examination_participants`, `examination_policy_settings`, `examination_proctor_assignments`.
- [x] Question CRUD for all six types: Single Choice, Multi Select, True/False, Short Answer, Essay, and Image Based (`/api/questions`, `/api/questions/[id]`).
- [x] Media upload with file-size and mime-type validation (`/api/media/upload`).
- [x] Server-side question validation before examination publication (`src/lib/validation/question.ts` and `src/lib/examination-state.ts`).
- [x] Examination creation wizard and server-enforced state machine (`/api/examinations`, `/api/examinations/[id]/transition`).
- [x] Question selection with immutable version snapshotting (`/api/examinations/[id]/questions`).
- [x] Class and student participant registration (`/api/examinations/[id]/participants`).
- [x] Teacher Portal interactive panel (`TeacherExaminationPanel.tsx` in `/teacher`).
- [x] Automated test suite: 27 passing Vitest unit tests (`npm test`) covering question validation across all six types, media constraints, and lifecycle state transition rules.

**Exit criteria:** Teachers can create and publish valid examinations; invalid configurations are rejected with actionable errors. (COMPLETE)

---

### Phase 3 – Examination Engine *(completed)*

Scope:
- [x] Prisma migrations and models for: `examination_attempts`, `examination_answers`, `grading_records`, `examination_results`, `result_publications`.
- [x] Student pre-exam acknowledgment and token verification screen (`/student/exam/[id]`).
- [x] Server-controlled timer (`src/lib/exam-engine/timer.ts`) with start time and deadline stored at attempt creation.
- [x] Seeded deterministic question and option randomization (`src/lib/exam-engine/shuffler.ts`).
- [x] Autosave endpoint (`/api/student/examinations/[id]/answers`): idempotent, optimistic-concurrency via `answer_sequence` column with 409 stale-sequence rejection.
- [x] Submission handler and automated grading engine (`src/lib/exam-engine/grading.ts`):
  - Auto-grading for Single Choice, Multi Select (exact & partial), True/False, and Short Answer (with string normalization).
  - Manual grading queue assignment for Essay questions (`grading_pending` status).
  - Aggregated result creation (`examination_results`).
- [x] Student exam-taking interface (`/student/exam/[id]`):
  - Question renderer supporting all question types and question/option images.
  - Interactive question navigator palette (1..N grid with answered/doubtful/unanswered color codes).
  - Real-time autosave cloud indicator.
  - Submission confirmation modal with answered statistics.
- [x] Integration and unit test suite (`tests/phase3_exam_engine.test.ts`): 13 tests covering timer boundaries, deterministic shuffling, and multi-type auto-grading.

**Exit criteria:** All question types render and save correctly; timer is server-authoritative; no double-submission possible. (COMPLETE)

---

### Phase 4 – Anti-Cheat and Live Proctoring *(completed)*

Scope:
- [x] Prisma migration for `examination_events` and policy settings additions (`mode`, `warn_threshold`, `block_threshold`, `heartbeat_interval_s`, `custom_rules`).
- [x] Browser-event capture and server-side ingestion endpoint (`/api/student/examinations/[id]/events`).
- [x] Policy evaluator (`src/lib/anti-cheat/policy-evaluator.ts`) supporting:
  - Practice / Standard / Strict / Custom modes.
  - Event deduplication and idempotency via `client_event_id`.
  - Non-accusatory warning and block transitions.
- [x] Session enforcement: blocked attempts reject answer writes and submissions (403), preserving saved progress.
- [x] Heartbeat and connection-status tracking (`/api/student/examinations/[id]/heartbeat`), updating `last_heartbeat` and `connection_status`.
- [x] Live proctor dashboard with real-time status via native SSE (`/api/examinations/[id]/proctor/stream` and `/teacher/examinations/[id]/proctor`):
  - Real-time roster grid with connection status, answered counts, and incident counters.
  - Live integrity activity feed streaming all browser events and manual notes.
- [x] Teacher/proctor intervention endpoints with audit logging:
  - Issue manual warning (`/api/proctoring/warn`).
  - Block attempt (`/api/proctoring/block`).
  - Unlock attempt with mandatory note and reset toggle (`/api/proctoring/unlock`).
  - Extend exam time (`/api/proctoring/extend-time`).
  - Disqualify student (`/api/proctoring/disqualify`).
- [x] Student exam interface integration (`/student/exam/[id]`):
  - Listeners for focus loss, tab visibility, fullscreen exits, beforeunload, and offline.
  - Neutral non-accusatory warning overlay with acknowledgment button.
  - Blocked overlay with proctor contact guidance and unlock status check.
- [x] Automated test suite (`tests/phase4_anti_cheat.test.ts`): 8 tests passing covering mode evaluation, threshold transitions, idempotency, and proctor interventions.

**Exit criteria:** All anti-cheat acceptance criteria from PRD §17 pass. (COMPLETE)

---

### Phase 5 – Reporting, Deployment, and Hardening

Scope & Deliverables:
- [x] **Result reports & Gradebook UI** (`/teacher/examinations/[id]/results`):
  - Summary metric cards (Total Peserta, Selesai, Rata-rata Nilai, Tingkat Kelulusan & Remedial).
  - Search by student name/NIS/username, class filter, and pass/fail/remedial filter.
  - Print-friendly layout (`@media print`) and responsive design.
- [x] **Secure Results & CSV Export APIs**:
  - `/api/examinations/[id]/results`: Aggregate statistics, passing score metrics, duration calculation.
  - `/api/examinations/[id]/export?format=csv`: Excel-compatible CSV export with UTF-8 BOM (`\uFEFF`), properly escaped fields, and teacher/admin access control.
- [x] **Audit Log Enhancement & Search/Filter UI**:
  - `/api/audit-logs`: Added actor filter, IP filter, date range filters, and direct CSV export (`format=csv`).
  - `AdminManagementPanel` (Tab 6: Log Audit): Added search input and instant CSV export button.
- [x] **Security Hardening**:
  - Sliding-window rate limiting in `src/lib/security/rate-limit.ts` (API routes & auth endpoints).
  - Security headers in `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- [x] **Health Probe & Monitoring**:
  - `/api/health`: Database connection check and latency measurement.
- [x] **Backup & Restore Operations**:
  - `scripts/backup.sh`: PostgreSQL dump + MinIO assets tarball with retention management.
  - `scripts/restore.sh`: Verified restoration script with safety prompt.
- [x] **Load Testing Verification**:
  - `scripts/benchmark-load.ts`: Verified for concurrent requests (50 concurrent workers, 200 requests: avg latency 240ms, p95 495ms < 500ms target).
- [x] **Automated Test Suite**:
  - `tests/phase5_reporting_hardening.test.ts`: CSV UTF-8 BOM encoding, rate limiter sliding window, and health probe checks.
  - Total test suite: 61 tests passing across 9 test files.

**Exit criteria:** Full PRD §17 acceptance criteria pass; reporting, security hardening, and operational scripts validated. (COMPLETE)

---

## 2. Open Decisions

All decisions below were resolved during the Phase 0 architecture review on 2026-10-20. They are recorded here for traceability.

| # | Decision | Options Considered | **Selected** | Notes |
|---|----------|--------------------|-------------|-------|
| D-01 | Frontend framework | Next.js 16 App Router / Remix / Vite + React | **Next.js 16.x App Router** | SSR, API routes, streaming; avoids separate API service for MVP. Node 14 EOL closed. |
| D-02 | Backend API style | Next.js API routes / Fastify separate service | **Next.js API routes initially** | Monorepo simplicity; extract later if load demands. |
| D-03 | ORM | Prisma / Drizzle / Kysely | **Prisma 7.x** | Typed migrations, schema-first. Prisma 8 is still RC; do not use `@latest`. |
| D-04 | Session management | JWT HttpOnly / server-side sessions (DB or Redis) | **Server-side sessions (PostgreSQL)** | Instant revocation required for blocked-session enforcement. |
| D-05 | Real-time transport | WebSocket / SSE | **SSE (native)** | Unidirectional push sufficient for proctoring; no extra library. |
| D-06 | File storage | Local filesystem / S3-compatible MinIO | **MinIO** | LAN-deployable; avoids external dependency. |
| D-07 | Auth library | Custom / NextAuth / Lucia | **Custom with Argon2id** (`argon2@0.45.x`) | No abstraction hiding session control critical to exam enforcement. |
| D-08 | Validation library | Zod / Yup / Valibot | **Zod 4.x** | Shared schemas between API and UI; TypeScript-first. |
| D-09 | CSS approach | Vanilla CSS / Tailwind CSS | **Tailwind CSS 4.x** (4.3.3) | v4 uses CSS-native variables; compatible with Next.js 16 + React 19. |
| D-10 | Database | PostgreSQL / MySQL | **PostgreSQL 16** | PRD §14 specifies PostgreSQL explicitly. |

---

## 3. Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Server time drift on LAN server causes timer skew | High | NTP on server; all timers from `NOW()` DB time, not client |
| Exam answers lost during network outage | High | Autosave with retry; last-confirmed state preserved |
| Blocked session bypassed via modified client | High | Backend validates attempt status on every answer-write request |
| Question content changes after students started | High | Snapshot questions at publication; `examination_questions` holds versioned copy |
| Bulk import creates partial academic relationships | Medium | Wrap all import mutations in a single DB transaction; preview before commit |
| Session hijacking over HTTP on LAN | Medium | Enforce HTTPS even on LAN; document cert generation for local deployment |
| MinIO data loss without backup | Medium | Automate scheduled backup of MinIO bucket |
| 200-concurrent-session load unverified | Medium | Load test before final release; define capacity ceiling in deployment docs |

---

## 4. Constraints Carried Forward to All Phases

- No frontend-only authorization.
- No plaintext passwords anywhere in code, logs, or exports.
- No independent local + remote databases.
- No mock features labeled production-ready.
- No destructive operations on historical records by default.
- Soft-delete or archival for entities with historical references.
- All secrets via environment variables; no secrets in SCM.
- Explicit DB migrations for every schema change.
- Typed validation (Zod) shared between API and UI layers.
