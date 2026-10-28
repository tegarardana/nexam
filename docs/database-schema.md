# Nexam – Database Schema

**Version:** 0.2  
**Last updated:** 2026-10-20  
**Status:** Phase 0 revised draft – subject to change before first migration is created  
**Changes from v0.1:** Auth/exam session separation clarified; `client_event_id` dedup key added to `examination_events`; `answer_sequence` semantics hardened; `grace_period_seconds` added to policy settings; `proctor_events` ring-buffer table added for SSE replay; `examination_attempts` blocking does not touch `user_sessions`; redundant state notes added; indexes expanded.

All tables use PostgreSQL 16. Primary keys are UUIDs (`gen_random_uuid()`). Timestamps are `TIMESTAMPTZ` stored in UTC. Soft deletes use `archived_at TIMESTAMPTZ NULL` where historical references must survive.

---

## 1. Entity Relationship Overview

```
users
  ├── user_roles ── roles ── role_permissions ── permissions
  ├── user_sessions         (login state — independent of exam attempts)
  │
  ├── (student) student_enrollments ── class_groups
  │                                       ├── academic_years
  │                                       ├── semesters
  │                                       └── majors
  │
  ├── (teacher) teacher_assignments ── subject_offerings ── subjects
  │
  ├── questions ── question_versions ── question_options
  │                                  └── question_media
  │
  ├── examinations ── examination_questions    (versioned snapshot; immutable after publish)
  │       │        ── examination_participants
  │       │        ── examination_policy_settings
  │       │        ── examination_proctor_assignments
  │       │
  │       └── examination_attempts             (independent lifecycle from user_sessions)
  │                    ├── examination_answers
  │                    ├── examination_events  (deduped by client_event_id)
  │                    └── grading_records
  │
  ├── examination_results   (aggregated; derived from grading_records)
  ├── result_publications
  ├── proctor_events        (SSE replay ring buffer)
  ├── notifications
  ├── audit_logs
  ├── import_jobs
  └── system_settings
```

---

## 2. Schema Definitions

### 2.1 Identity and Permissions

#### `users`

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  password_hash   TEXT NOT NULL,           -- Argon2id; never plaintext
  email           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES users(id),
  archived_at     TIMESTAMPTZ              -- soft delete; preserves historical references
);
```

> **Invariant:** Academic placement data is NOT embedded here. See `student_enrollments`.

#### `roles`

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,        -- 'student' | 'teacher' | 'administrator'
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `user_roles`

```sql
CREATE TABLE user_roles (
  user_id     UUID NOT NULL REFERENCES users(id),
  role_id     UUID NOT NULL REFERENCES roles(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by  UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);
```

#### `permissions`

```sql
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,    -- e.g., 'examination:publish', 'result:finalize'
  description TEXT,
  module      TEXT NOT NULL            -- e.g., 'examinations', 'grading'
);
```

#### `role_permissions`

```sql
CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
```

#### `user_sessions`

Login state. **Completely independent of examination attempt state.**  
Blocking an examination attempt must never modify this table.

```sql
CREATE TABLE user_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  invalidated_at  TIMESTAMPTZ,         -- set on explicit logout or admin force-revocation ONLY
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON user_sessions (user_id);
CREATE INDEX ON user_sessions (expires_at) WHERE invalidated_at IS NULL;
```

> **Note:** The only triggers for `invalidated_at` are: (1) user-initiated logout, (2) admin force-logout, (3) account deactivation. Anti-cheat blocking of an examination attempt is NOT a trigger.

---

### 2.2 Academic Structure

#### `academic_years`

```sql
CREATE TYPE academic_year_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE academic_years (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,         -- e.g., '2026/2027'
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      academic_year_status NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES users(id),
  CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date),
  CONSTRAINT no_overlapping_active EXCLUDE USING gist (
    daterange(start_date, end_date, '[]') WITH &&
  ) WHERE (status = 'active')              -- enforce single-active-year rule
);
```

#### `semesters`

```sql
CREATE TYPE semester_name   AS ENUM ('Ganjil', 'Genap');
CREATE TYPE semester_status AS ENUM ('draft', 'active', 'archived');

CREATE TABLE semesters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  name             semester_name NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  status           semester_status NOT NULL DEFAULT 'draft',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year_id, name),
  CONSTRAINT chk_semester_dates CHECK (end_date > start_date)
);
```

#### `majors`

```sql
CREATE TABLE majors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
```

#### `class_groups`

```sql
CREATE TABLE class_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,           -- e.g., 'XI TJKT 1'
  grade_level      SMALLINT NOT NULL        -- 10, 11, 12
                   CHECK (grade_level BETWEEN 10 AND 13),
  major_id         UUID REFERENCES majors(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, academic_year_id)
);
```

#### `student_enrollments`

Separates permanent student identity from yearly class placement.

```sql
CREATE TYPE enrollment_status AS ENUM ('active', 'transferred', 'graduated', 'withdrawn');

CREATE TABLE student_enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id),
  class_group_id   UUID NOT NULL REFERENCES class_groups(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  enrolled_at      DATE NOT NULL,
  status           enrollment_status NOT NULL DEFAULT 'active',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, academic_year_id)         -- one placement per student per year
);

CREATE INDEX ON student_enrollments (student_id);
CREATE INDEX ON student_enrollments (class_group_id);
CREATE INDEX ON student_enrollments (academic_year_id);
```

> **Historical invariant:** Graduating or deactivating a student does NOT delete enrollment rows or examination records. Enrollment `status` changes to `graduated`; the user account may be set `is_active = FALSE`. All historical results remain intact.

#### `subjects`

```sql
CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  description TEXT,
  category    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
```

#### `subject_offerings`

Connects a reusable subject to a specific academic context.

```sql
CREATE TABLE subject_offerings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       UUID NOT NULL REFERENCES subjects(id),
  class_group_id   UUID NOT NULL REFERENCES class_groups(id),
  semester_id      UUID NOT NULL REFERENCES semesters(id),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, class_group_id, semester_id)
);
```

> `academic_year_id` is denormalized here for query convenience. Application must enforce consistency with `semesters.academic_year_id`. A trigger or application check validates that `subject_offerings.academic_year_id = semester.academic_year_id`.

#### `teacher_assignments`

```sql
CREATE TABLE teacher_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          UUID NOT NULL REFERENCES users(id),
  subject_offering_id UUID NOT NULL REFERENCES subject_offerings(id),
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by         UUID REFERENCES users(id),
  UNIQUE (teacher_id, subject_offering_id)
);
```

---

### 2.3 Question Bank

#### `question_categories`

```sql
CREATE TABLE question_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  parent_id  UUID REFERENCES question_categories(id),
  subject_id UUID REFERENCES subjects(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `questions`

```sql
CREATE TYPE question_type   AS ENUM (
  'single_choice', 'multi_select', 'true_false',
  'short_answer', 'essay', 'image_based'
);
CREATE TYPE question_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID REFERENCES subjects(id),
  category_id UUID REFERENCES question_categories(id),
  type        question_type NOT NULL,
  difficulty  TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  status      question_status NOT NULL DEFAULT 'draft',
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);
```

#### `question_versions`

Immutable content snapshot. Creating a new version is the only way to change question content after a question has been snapshotted in a published examination.

```sql
CREATE TABLE question_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID NOT NULL REFERENCES questions(id),
  version_number  INTEGER NOT NULL CHECK (version_number >= 1),
  content         JSONB NOT NULL,        -- question text, instructions, optional rubric
  grading_config  JSONB NOT NULL,        -- answer key, point values, grading method
  explanation     TEXT,
  is_current      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES users(id),
  UNIQUE (question_id, version_number)
);

-- Only one current version per question
CREATE UNIQUE INDEX ON question_versions (question_id) WHERE is_current = TRUE;
```

> **Immutability rule:** Once a `question_versions` row is referenced by `examination_questions`, its `content` and `grading_config` must not be modified. New edits create a new version row with `is_current = TRUE` (and set previous row to `FALSE`). The published examination continues to reference the original version.

#### `question_options`

Structured answer options for choice-type questions. Also stored within `question_versions.content` JSONB for snapshot durability, but maintained as a normalized table for query flexibility during the question-bank phase.

```sql
CREATE TABLE question_options (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_version_id UUID NOT NULL REFERENCES question_versions(id),
  option_label        TEXT NOT NULL,     -- 'A', 'B', 'C', etc.
  content             TEXT NOT NULL,
  is_correct          BOOLEAN NOT NULL DEFAULT FALSE,
  display_order       SMALLINT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON question_options (question_version_id);
```

#### `question_media`

```sql
CREATE TABLE question_media (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_version_id UUID NOT NULL REFERENCES question_versions(id),
  storage_key         TEXT NOT NULL,     -- MinIO object key; never a public URL
  mime_type           TEXT NOT NULL,
  alt_text            TEXT,
  file_size_bytes     BIGINT CHECK (file_size_bytes > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.4 Examination

#### `examinations`

```sql
CREATE TYPE exam_status AS ENUM (
  'draft', 'ready', 'scheduled', 'in_progress', 'closed', 'grading', 'finalized'
);

CREATE TABLE examinations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  instructions          TEXT,
  subject_id            UUID REFERENCES subjects(id),
  semester_id           UUID NOT NULL REFERENCES semesters(id),
  academic_year_id      UUID NOT NULL REFERENCES academic_years(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  status                exam_status NOT NULL DEFAULT 'draft',
  scheduled_start       TIMESTAMPTZ,
  scheduled_end         TIMESTAMPTZ,
  duration_minutes      SMALLINT NOT NULL CHECK (duration_minutes > 0),
  max_score             NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  randomize_questions   BOOLEAN NOT NULL DEFAULT FALSE,
  randomize_options     BOOLEAN NOT NULL DEFAULT FALSE,
  max_attempts          SMALLINT NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  allow_resume          BOOLEAN NOT NULL DEFAULT TRUE,
  result_release_policy TEXT NOT NULL DEFAULT 'manual'
                        CHECK (result_release_policy IN ('auto', 'manual', 'after_grading')),
  access_password_hash  TEXT,             -- optional; Argon2id-hashed if used
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at          TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  finalized_at          TIMESTAMPTZ,
  CONSTRAINT chk_exam_schedule CHECK (
    scheduled_end IS NULL OR scheduled_end > scheduled_start
  )
);

CREATE INDEX ON examinations (status);
CREATE INDEX ON examinations (created_by);
CREATE INDEX ON examinations (semester_id);
```

#### `examination_policy_settings`

```sql
CREATE TYPE anticheat_mode AS ENUM ('practice', 'standard', 'strict', 'custom');

CREATE TABLE examination_policy_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id        UUID NOT NULL UNIQUE REFERENCES examinations(id),
  mode                  anticheat_mode NOT NULL DEFAULT 'standard',
  warn_threshold        SMALLINT NOT NULL DEFAULT 1 CHECK (warn_threshold >= 1),
  block_threshold       SMALLINT NOT NULL DEFAULT 3
                        CHECK (block_threshold >= warn_threshold),
  require_fullscreen    BOOLEAN NOT NULL DEFAULT FALSE,
  grace_period_seconds  SMALLINT NOT NULL DEFAULT 0
                        CHECK (grace_period_seconds >= 0),  -- late-submission window
  heartbeat_interval_s  SMALLINT NOT NULL DEFAULT 30
                        CHECK (heartbeat_interval_s >= 10),
  custom_rules          JSONB,            -- validated only when mode = 'custom'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_custom_rules CHECK (
    mode != 'custom' OR custom_rules IS NOT NULL
  )
);
```

> `grace_period_seconds`: number of seconds after `deadline_at` during which a submission request is still accepted (but no new answer writes). Default 0.

#### `examination_questions`

Versioned snapshot of questions as they existed at publication. **Immutable after examination status transitions away from `draft`.**

```sql
CREATE TABLE examination_questions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id      UUID NOT NULL REFERENCES examinations(id),
  question_version_id UUID NOT NULL REFERENCES question_versions(id),
  display_order       SMALLINT NOT NULL CHECK (display_order >= 1),
  points              NUMERIC(5,2) NOT NULL CHECK (points > 0),
  pool_group          TEXT,              -- for question-pool randomization grouping
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, question_version_id),
  UNIQUE (examination_id, display_order)
);

CREATE INDEX ON examination_questions (examination_id);
```

> **Immutability:** Once `examinations.status != 'draft'`, any attempt to `UPDATE` or `DELETE` rows in `examination_questions` for that examination must be rejected at the application layer and logged as an audit violation attempt.

#### `examination_participants`

```sql
CREATE TABLE examination_participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id),
  student_id     UUID NOT NULL REFERENCES users(id),
  class_group_id UUID REFERENCES class_groups(id),
  added_by       UUID REFERENCES users(id),
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, student_id)
);

CREATE INDEX ON examination_participants (examination_id);
CREATE INDEX ON examination_participants (student_id);
```

#### `examination_proctor_assignments`

```sql
CREATE TABLE examination_proctor_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id),
  teacher_id     UUID NOT NULL REFERENCES users(id),
  assigned_by    UUID REFERENCES users(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, teacher_id)
);
```

#### `examination_attempts`

Each row represents one student's single attempt at one examination.  
**This table is independent of `user_sessions`.** Blocking or expiring an attempt has no effect on the student's login session.

```sql
CREATE TYPE attempt_status AS ENUM (
  'not_started', 'in_progress', 'warning', 'blocked',
  'submitted', 'grading_pending', 'completed', 'expired'
);

CREATE TABLE examination_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id   UUID NOT NULL REFERENCES examinations(id),
  student_id       UUID NOT NULL REFERENCES users(id),
  attempt_number   SMALLINT NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  status           attempt_status NOT NULL DEFAULT 'not_started',

  -- Timer fields — set by server using DB NOW(); never updatable by client
  started_at       TIMESTAMPTZ,
  deadline_at      TIMESTAMPTZ,          -- started_at + duration_minutes; server-only
  submitted_at     TIMESTAMPTZ,

  -- Connection tracking — updated by heartbeat endpoint
  last_heartbeat   TIMESTAMPTZ,
  connection_status TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (connection_status IN ('connected', 'disconnected', 'unknown')),

  -- Frozen randomization state for this attempt
  question_order   JSONB,                -- array of examination_question ids in display order
  option_orders    JSONB,                -- map of question_id → shuffled option ids

  -- Anti-cheat counters
  incident_count   SMALLINT NOT NULL DEFAULT 0,
  incident_count_reset_at TIMESTAMPTZ,   -- set when proctor resets count on unlock

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (examination_id, student_id, attempt_number),
  CONSTRAINT chk_deadline_after_start CHECK (
    deadline_at IS NULL OR started_at IS NULL OR deadline_at > started_at
  )
);

CREATE INDEX ON examination_attempts (student_id);
CREATE INDEX ON examination_attempts (examination_id, status);
CREATE INDEX ON examination_attempts (examination_id) WHERE status = 'in_progress';
```

> **Deliberate denormalization:** `connection_status` is maintained here (rather than derived from `last_heartbeat`) to allow SSE push without a per-request calculation. Updated atomically by the heartbeat job. Consistency strategy: the heartbeat background job is the sole writer of this column.

#### `examination_answers`

One row per (attempt × question). Upserted on every autosave.

```sql
CREATE TABLE examination_answers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id              UUID NOT NULL REFERENCES examination_attempts(id),
  examination_question_id UUID NOT NULL REFERENCES examination_questions(id),
  answer_value            JSONB NOT NULL,  -- type-specific payload (see §3)
  answer_sequence         INTEGER NOT NULL DEFAULT 0 CHECK (answer_sequence >= 0),
  saved_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, examination_question_id)
);

CREATE INDEX ON examination_answers (attempt_id);
```

> **Optimistic concurrency:** `answer_sequence` is the client's write counter. The server increments it on every accepted write. On an incoming autosave, the server compares the incoming `client_sequence` against the stored value. If `stored > client`, the write is a stale retry and is rejected with `409 Conflict`. The client must re-fetch the current sequence before retrying.

#### `examination_events` (anti-cheat)

```sql
CREATE TYPE exam_event_type AS ENUM (
  'focus_loss', 'visibility_change', 'fullscreen_exit', 'fullscreen_attempt',
  'page_unload', 'network_disconnect', 'heartbeat_missed',
  'session_conflict',
  'manual_warning', 'manual_block', 'manual_unlock',
  'submission_attempt', 'time_expired',
  'incident_count_reset'
);

CREATE TABLE examination_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id    UUID NOT NULL REFERENCES examinations(id),
  attempt_id        UUID NOT NULL REFERENCES examination_attempts(id),
  student_id        UUID NOT NULL REFERENCES users(id),
  event_type        exam_event_type NOT NULL,

  -- client_event_id: UUID generated by the browser; used for deduplication
  -- Prevents double-counting from network retries
  client_event_id   UUID,
  UNIQUE (attempt_id, client_event_id) NULLS NOT DISTINCT
          DEFERRABLE INITIALLY IMMEDIATE,  -- NULL for server-generated events

  server_timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- authoritative
  client_timestamp  TIMESTAMPTZ,                          -- diagnostic only
  metadata          JSONB,
  policy_applied    TEXT,
  resulting_status  attempt_status,

  -- Review workflow
  review_status     TEXT NOT NULL DEFAULT 'unreviewed'
                    CHECK (review_status IN ('unreviewed', 'reviewed', 'dismissed')),
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  intervention_note TEXT,

  -- For manual interventions: who authorized
  actor_id          UUID REFERENCES users(id)
);

CREATE INDEX ON examination_events (attempt_id);
CREATE INDEX ON examination_events (examination_id, server_timestamp DESC);
CREATE INDEX ON examination_events (attempt_id, event_type)
  WHERE event_type NOT IN ('manual_warning', 'manual_block', 'manual_unlock',
                           'heartbeat_missed', 'network_disconnect');
```

> **Deduplication:** The `UNIQUE (attempt_id, client_event_id)` constraint prevents a client retry from inserting a duplicate event row. `client_event_id` is `NULL` for server-generated events (heartbeat_missed, time_expired, manual actions); `NULLS NOT DISTINCT` is not applied for NULL values — the constraint only applies when `client_event_id IS NOT NULL`.

---

### 2.5 Grading and Results

#### `grading_records`

```sql
CREATE TYPE grading_status AS ENUM ('pending', 'draft', 'finalized');
CREATE TYPE grading_method AS ENUM ('auto', 'manual');

CREATE TABLE grading_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id              UUID NOT NULL REFERENCES examination_attempts(id),
  examination_question_id UUID NOT NULL REFERENCES examination_questions(id),
  question_type           question_type NOT NULL,
  raw_score               NUMERIC(6,2) CHECK (raw_score >= 0),
  max_score               NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  grading_method          grading_method NOT NULL,
  grading_status          grading_status NOT NULL DEFAULT 'pending',
  graded_by               UUID REFERENCES users(id),  -- NULL for auto-graded
  graded_at               TIMESTAMPTZ,
  teacher_feedback        TEXT,
  rubric_data             JSONB,
  auto_graded_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (attempt_id, examination_question_id),
  CONSTRAINT chk_score_not_exceed_max CHECK (
    raw_score IS NULL OR raw_score <= max_score
  )
);

CREATE INDEX ON grading_records (attempt_id);
CREATE INDEX ON grading_records (attempt_id, grading_status);
```

#### `examination_results`

Aggregated result per attempt. Written by the grading service after all grading is finalized; not directly writable by API callers.

```sql
CREATE TABLE examination_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL UNIQUE REFERENCES examination_attempts(id),
  student_id       UUID NOT NULL REFERENCES users(id),
  examination_id   UUID NOT NULL REFERENCES examinations(id),
  total_score      NUMERIC(6,2) CHECK (total_score >= 0),
  max_score        NUMERIC(6,2) NOT NULL CHECK (max_score > 0),
  percentage       NUMERIC(5,2) CHECK (percentage BETWEEN 0 AND 100),
  objective_score  NUMERIC(6,2),
  essay_score      NUMERIC(6,2),
  is_provisional   BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE only after full finalization
  finalized_at     TIMESTAMPTZ,
  finalized_by     UUID REFERENCES users(id),
  -- Modification audit (score changes after finalization require explicit authorization)
  last_modified_at TIMESTAMPTZ,
  last_modified_by UUID REFERENCES users(id),
  modification_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON examination_results (examination_id);
CREATE INDEX ON examination_results (student_id);
```

#### `result_publications`

```sql
CREATE TABLE result_publications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  examination_id UUID NOT NULL REFERENCES examinations(id),
  published_by   UUID NOT NULL REFERENCES users(id),
  published_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope          TEXT NOT NULL DEFAULT 'all',   -- 'all' or a comma-separated list of student_ids
  notes          TEXT
);

CREATE INDEX ON result_publications (examination_id);
```

---

### 2.6 SSE Proctoring Ring Buffer

#### `proctor_events`

Supports replay of missed SSE events when a proctor reconnects with `Last-Event-ID`. Rows older than 10 minutes are eligible for deletion by a periodic cleanup job.

```sql
CREATE TABLE proctor_events (
  id             BIGSERIAL PRIMARY KEY,
  examination_id UUID NOT NULL REFERENCES examinations(id),
  event_name     TEXT NOT NULL,
  event_data     JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON proctor_events (examination_id, id);
CREATE INDEX ON proctor_events (created_at);  -- for cleanup job
```

> **Retention:** A background job deletes rows where `created_at < NOW() - INTERVAL '10 minutes'` once per minute. When a proctor reconnects and `Last-Event-ID` points to a row older than 10 minutes, the server sends a fresh `state_snapshot` instead of attempting replay.

---

### 2.7 Platform Operations

#### `notifications`

```sql
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES users(id),
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT,
  reference_id  UUID,              -- optional loosely-typed FK to relevant entity
  reference_type TEXT,             -- e.g., 'examinations', 'examination_attempts'
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON notifications (recipient_id, is_read);
CREATE INDEX ON notifications (recipient_id, created_at DESC);
```

#### `audit_logs`

Append-only. No `UPDATE` or `DELETE` operations are permitted on this table.

```sql
CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES users(id),    -- NULL for system-initiated actions
  action       TEXT NOT NULL,                -- e.g., 'examination.published'
  entity_type  TEXT NOT NULL,                -- e.g., 'examinations'
  entity_id    UUID,
  before_value JSONB,                        -- sensitive fields redacted; no passwords/tokens
  after_value  JSONB,
  ip_address   INET,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON audit_logs (actor_id);
CREATE INDEX ON audit_logs (entity_type, entity_id);
CREATE INDEX ON audit_logs (timestamp DESC);
```

> **Integrity:** Application must never issue `UPDATE` or `DELETE` on `audit_logs`. Enforce via a PostgreSQL row-security policy or a dedicated DB role with only INSERT + SELECT.

#### `import_jobs`

```sql
CREATE TYPE import_status AS ENUM ('pending', 'validating', 'preview', 'confirmed', 'completed', 'failed');

CREATE TABLE import_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiated_by   UUID NOT NULL REFERENCES users(id),
  type           TEXT NOT NULL CHECK (type IN ('users', 'students', 'enrollments')),
  status         import_status NOT NULL DEFAULT 'pending',
  row_count      INTEGER CHECK (row_count >= 0),
  error_count    INTEGER CHECK (error_count >= 0),
  storage_key    TEXT,             -- MinIO key for the uploaded file
  result_summary JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);
```

#### `system_settings`

```sql
CREATE TABLE system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);
```

---

## 3. Answer Value Payloads

The `examination_answers.answer_value` JSONB field carries a type-specific payload:

| Question Type | Payload Schema |
|--------------|---------------|
| `single_choice` | `{ "option_id": "<uuid>" }` |
| `multi_select` | `{ "option_ids": ["<uuid>", ...] }` |
| `true_false` | `{ "value": true }` or `{ "value": false }` |
| `short_answer` | `{ "text": "<student's answer>" }` |
| `essay` | `{ "text": "<rich text or plain text>" }` |
| `image_based` | Same schema as the underlying type (`single_choice`, etc.) |

Zod schemas validating these payloads are shared between the API route and the client form layer.

---

## 4. Key Integrity Constraints

| Rule | Implementation |
|------|---------------|
| One active academic year at a time | `EXCLUDE USING gist` on `academic_years` |
| One enrollment per student per year | `UNIQUE (student_id, academic_year_id)` on `student_enrollments` |
| Exam question snapshot immutable after publish | App-level rejection + audit log; `examination_questions` only writable when `examinations.status = 'draft'` |
| Answers reference published question versions | FK `examination_answers.examination_question_id → examination_questions.id` |
| Deadline is server-only | `deadline_at` written once at attempt creation; no client-facing update endpoint |
| Scores bounded by max | `CHECK (raw_score <= max_score)` on `grading_records` |
| Block threshold ≥ warn threshold | `CHECK (block_threshold >= warn_threshold)` on `examination_policy_settings` |
| Audit log append-only | DB-level role restriction or row-security policy |
| Session blocking ≠ logout | No FK or trigger from `examination_attempts` to `user_sessions` |
| Duplicate browser events | `UNIQUE (attempt_id, client_event_id)` on `examination_events` |
| No plaintext passwords | Application convention; `password_hash` always receives Argon2id output |

---

## 5. Deliberate Denormalizations

| Column | Table | Reason | Consistency Strategy |
|--------|-------|--------|----------------------|
| `academic_year_id` | `subject_offerings` | Avoids a join through `semesters` for common queries | Application + CHECK validates it matches `semester.academic_year_id` |
| `academic_year_id` | `examinations` | Same as above | Same validation |
| `student_id` | `examination_results` | Avoids join through `examination_attempts` for result queries | Populated at row creation from `attempt.student_id`; never updated |
| `examination_id` | `examination_results` | Same | Same |
| `connection_status` | `examination_attempts` | Enables SSE push without per-request heartbeat calculation | Heartbeat background job is sole writer |

---

## 6. Indexes Summary

```sql
-- Session lookup (every authenticated request)
CREATE INDEX ON user_sessions (user_id);
CREATE INDEX ON user_sessions (expires_at) WHERE invalidated_at IS NULL;

-- Enrollment lookup
CREATE INDEX ON student_enrollments (student_id);
CREATE INDEX ON student_enrollments (class_group_id);
CREATE INDEX ON student_enrollments (academic_year_id);

-- Question bank
CREATE INDEX ON question_options (question_version_id);
CREATE UNIQUE INDEX ON question_versions (question_id) WHERE is_current = TRUE;

-- Examination delivery (hot path)
CREATE INDEX ON examinations (status);
CREATE INDEX ON examination_questions (examination_id);
CREATE INDEX ON examination_participants (examination_id);
CREATE INDEX ON examination_participants (student_id);
CREATE INDEX ON examination_attempts (student_id);
CREATE INDEX ON examination_attempts (examination_id, status);
CREATE INDEX ON examination_attempts (examination_id) WHERE status = 'in_progress';
CREATE INDEX ON examination_answers (attempt_id);

-- Anti-cheat events
CREATE INDEX ON examination_events (attempt_id);
CREATE INDEX ON examination_events (examination_id, server_timestamp DESC);

-- Grading
CREATE INDEX ON grading_records (attempt_id);
CREATE INDEX ON grading_records (attempt_id, grading_status);
CREATE INDEX ON examination_results (examination_id);
CREATE INDEX ON examination_results (student_id);

-- SSE ring buffer
CREATE INDEX ON proctor_events (examination_id, id);
CREATE INDEX ON proctor_events (created_at);

-- Audit log search
CREATE INDEX ON audit_logs (actor_id);
CREATE INDEX ON audit_logs (entity_type, entity_id);
CREATE INDEX ON audit_logs (timestamp DESC);

-- Notifications
CREATE INDEX ON notifications (recipient_id, is_read);
CREATE INDEX ON notifications (recipient_id, created_at DESC);
```

---

## 7. Migration Strategy

- All schema changes applied through **Prisma Migrate** (versioned SQL files committed to SCM).
- **Install command:** `npm install prisma@7 @prisma/client@7` (pin to stable 7.x; do not use unqualified `@latest` which resolves to Prisma 8 RC as of 2026-10-20).
- No manual schema edits on a production database.
- `prisma migrate deploy` runs as part of the deployment pipeline before the application starts.
- Each migration file is reviewed before merge.
- Rollback: write explicit reverse migrations for destructive changes; Prisma Migrate does not auto-generate them.
- Backup the database before every migration on production.
