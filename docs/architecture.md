# Nexam – System Architecture

**Version:** 0.2  
**Last updated:** 2026-10-20  
**Status:** Phase 0 revised draft – requires stakeholder approval before Phase 1 begins  
**Changes from v0.1:** Technology baseline updated; auth/exam session separation hardened; timing and concurrency model detailed; SSE proctoring spec refined; security controls expanded.

---

## 1. Design Principles

1. **Single authoritative database.** One PostgreSQL instance is the source of truth for every student, examination, answer, and result.
2. **Server-side enforcement.** Every business rule (eligibility, timers, session state, permissions) is checked on the backend; the frontend is not trusted.
3. **Authentication and examination concerns are independent.** Blocking an examination attempt does not log the student out. Session revocation and attempt blocking are separate operations with separate state fields.
4. **Modular, not microservices.** A single well-structured monorepo is preferred over unnecessary service fragmentation at this school scale.
5. **Incremental delivery.** Each phase delivers working, tested functionality before expanding scope.
6. **Auditability.** Every academically or security-sensitive action is logged with actor, action, entity, and timestamp.
7. **No client-authoritative state.** Client time, client-side flags, and stale retries can never override server state. Every write endpoint re-validates attempt status and deadline independently.

---

## 2. Technology Stack

### 2.1 Version Selection Process

Versions were selected on 2026-10-20 using the following verification commands:

```bash
# Runtime environment present on the school's development machine
node --version        # → v26.7.0
npm --version         # → 11.19.0

# Latest stable package releases (published dist-tags)
npm show next@latest version             # → 16.4.2
npm show react@latest version            # → 19.3.1
npm show typescript@latest version       # → 7.0.2
npm show prisma dist-tags                # → latest: 8.0.0-rc.23  |  prev (stable): 7.10.1
npm show tailwindcss@latest version      # → 4.3.3
npm show zod@latest version              # → 4.6.7
npm show @headlessui/react@latest version # → 2.2.10
npm show vitest@latest version           # → 5.0.5
npm show @playwright/test@latest version # → 1.64.1
npm show argon2@latest version           # → 0.45.1
```

### 2.2 Selected Versions and Rationale

| Layer | Package | Selected Version | Status | Rationale |
|-------|---------|-----------------|--------|-----------|
| Runtime | Node.js | **26 LTS** (v26.7.0+) | Active LTS from Oct 2026 | Node 20 is EOL (Apr 2026). Node 26 is current Active LTS. |
| Framework | Next.js | **16.x** (16.4.2) | Active LTS | Next 14 is EOL; Next 16 is the recommended production version with Turbopack stable and React 19.2+ integration. |
| Language | TypeScript | **7.x** (7.0.2) | Stable | Compatible with Next.js 16; min required by Prisma 7 is TS 5.1. |
| UI Library | React | **19.3.x** (19.3.1) | Stable | Bundled by Next.js 16; React Compiler stable. |
| ORM | Prisma | **7.x** (7.10.1) | Stable | Prisma 8.x is still RC (8.0.0-rc.23); Prisma 7 is the latest stable release. Do **not** use `@latest` which currently resolves to RC. |
| Database | PostgreSQL | **16** | Stable, long-term support | PRD §14 specifies PostgreSQL explicitly. |
| Validation | Zod | **4.x** (4.6.7) | Stable | Shared schema definitions across API routes and UI forms. |
| Auth | Custom (Argon2id + DB sessions) | argon2 **0.45.x** | Stable | Full control over session lifecycle; no library abstraction obscuring session revocation. |
| Real-time | Server-Sent Events (SSE) | — (native) | — | Unidirectional push is sufficient for proctoring. No WebSocket dependency needed. |
| CSS / UI | Tailwind CSS | **4.x** (4.3.3) | Stable | Professional design system; v4 uses CSS-native variables; compatible with Next.js 16. |
| Accessible components | Headless UI | **2.x** (2.2.10) | Stable | Fully compatible with React 19; `@headlessui/react@latest`. |
| File storage | MinIO | Latest stable | Stable | S3-compatible, self-hosted, LAN-deployable. |
| Container | Docker Compose | v2 | Stable | Reproducible environments. |
| Reverse proxy | Nginx | 1.26+ | Stable | TLS termination, SSE configuration, upstream proxy. |
| Migrations | Prisma Migrate | (bundled with Prisma 7) | Stable | Versioned, explicit schema changes. |
| Unit testing | Vitest | **5.x** (5.0.5) | Stable | Fast; native TypeScript; ESM-compatible. |
| E2E testing | Playwright | **1.64.x** (1.64.1) | Stable | Real-browser test runner for examination flow. |

### 2.3 Compatibility Notes and Risks

| Item | Note |
|------|------|
| Prisma 8 is still RC | Pin `prisma@7` and `@prisma/client@7` explicitly in `package.json`. Do **not** use unqualified `@latest`. Revisit Prisma 8 when it exits RC. |
| Next.js 16 uses `proxy.ts` instead of `middleware.ts` | Plan RBAC middleware accordingly in Phase 1. |
| Tailwind CSS v4 uses CSS-native layers | No `tailwind.config.js` in v4; configuration moves to `@theme` in CSS. Confirm during scaffold. |
| Argon2 uses native bindings | Requires build tools in Docker image (`python3`, `make`, `g++`). Document in Dockerfile. |
| Node 26 Prisma engine compatibility | Prisma 7.10.1 requires `node >=22.11.0`; Node 26 satisfies this. |

### 2.4 Verification Commands to Re-run Before Starting Phase 1

```bash
# Confirm all selected versions remain at stable tags
npm show next dist-tags
npm show prisma dist-tags         # choose 'prev' or first non-RC 'latest'
npm show tailwindcss dist-tags
npm show @headlessui/react dist-tags

# Verify Node.js compatibility with chosen Next.js version
node -e "const v = process.versions.node; console.log('Node:', v)"
```

---

## 3. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                 School Network (LAN) / Internet                │
│                                                                │
│  Browser Clients (students, teachers, admins)                  │
│  ────────────────────────────┐                                 │
│                              ▼  HTTPS :443                     │
│                     ┌─────────────────┐                        │
│                     │   Nginx 1.26+   │  TLS termination       │
│                     │   (proxy.conf)  │  SSE buffer-off        │
│                     └────────┬────────┘                        │
│                              │ HTTP :3000 (internal only)      │
│                     ┌────────▼────────┐                        │
│                     │  Next.js 16 App │  App Router            │
│                     │  Node.js 26 LTS │  API Routes            │
│                     │  TypeScript 7   │  Server Actions        │
│                     └──┬──────┬───────┘                        │
│                         │      │                               │
│               ┌─────────▼──┐  ┌▼──────────┐                   │
│               │ PostgreSQL │  │  MinIO     │                   │
│               │    16      │  │ (S3-compat)│                   │
│               │ (internal) │  │ (internal) │                   │
│               └────────────┘  └────────────┘                   │
└────────────────────────────────────────────────────────────────┘
                          │
              Optional: VPN / public HTTPS / Cloudflare Tunnel
                          │
                   Remote Internet Access
```

All inter-service communication is within the Docker internal network. PostgreSQL and MinIO are never exposed outside the container network.

---

## 4. Module Boundaries

```
src/
├── app/                              # Next.js 16 App Router
│   ├── (auth)/                       # Login; unauthenticated routes
│   ├── (student)/                    # Student-scoped pages
│   ├── (teacher)/                    # Teacher-scoped pages
│   ├── (admin)/                      # Administrator-scoped pages
│   └── api/                          # Route handlers
│       ├── auth/
│       ├── academic/
│       ├── users/
│       ├── questions/
│       ├── examinations/
│       ├── attempts/
│       ├── answers/
│       ├── events/
│       ├── heartbeat/
│       ├── proctoring/stream/        # SSE endpoint
│       ├── grading/
│       ├── results/
│       └── admin/
│
├── modules/
│   ├── auth/                         # Login, session, RBAC, rate limiting
│   ├── academic/                     # Academic years, semesters, majors, classes, subjects
│   ├── users/                        # Accounts, roles, bulk import
│   ├── question-bank/                # Questions, versions, options, media
│   ├── examinations/                 # Config, lifecycle, scheduling, participants
│   ├── examination-engine/           # Attempt management, autosave, timer, submission
│   ├── anti-cheat/                   # Event ingestion, policy evaluation, attempt enforcement
│   ├── grading/                      # Auto-grading, essay grading, result publication
│   ├── proctoring/                   # SSE stream, live status, teacher interventions
│   ├── notifications/                # In-app notifications
│   ├── audit/                        # Audit log writes and query API
│   ├── reports/                      # Result reports, exports
│   └── admin-settings/               # System settings, import jobs
│
├── lib/
│   ├── db/                           # Prisma client singleton (one connection pool)
│   ├── validation/                   # Shared Zod schemas
│   ├── auth/                         # Session utilities, RBAC helpers, permission checks
│   ├── storage/                      # MinIO client wrapper
│   ├── sse/                          # SSE connection registry and event emitter
│   └── errors/                       # Typed error classes and HTTP error handlers
│
└── components/
    ├── design-system/                # Tailwind v4 theme tokens
    ├── layout/                       # Shell, sidebar, header
    ├── forms/                        # Form primitives + Zod validation
    ├── tables/                       # Data tables
    ├── examination/                  # Examination-specific components
    └── feedback/                     # Loading, empty, error states
```

---

## 5. Authentication Session Architecture

### 5.1 Separation of Concerns

| Concern | Entity | Table | Independent? |
|---------|--------|-------|-------------|
| User authentication | Login state | `user_sessions` | ✅ Yes |
| Examination participation | Attempt state | `examination_attempts` | ✅ Yes |

**Blocking an examination attempt does NOT invalidate the user's login session.** These are independent lifecycles. A blocked student remains logged in and can see the blocked status message, contact their proctor, and view other pages they are permitted to access.

### 5.2 Session Lifecycle

```
POST /api/auth/login
    │
    ▼
[Rate limit: 10 req/min per IP; separate limit for school NAT: see §7]
    │
    ▼
[Lookup user by username] ← always return generic error; never reveal existence
    │
    ▼
[Argon2id verify password]
    │
    ▼
[Create user_sessions row]
  id = crypto.randomUUID()         ← 122 bits entropy
  user_id = user.id
  expires_at = NOW() + 8 hours     ← configurable via SESSION_TTL_HOURS env var
  ip_address, user_agent
    │
    ▼
[Set cookie: session_id]
  HttpOnly = true
  Secure = true                    ← requires HTTPS; enforced by Nginx
  SameSite = Lax
  Path = /
  Max-Age = SESSION_TTL_HOURS * 3600
    │
    ▼
[Redirect to role-specific dashboard]
```

### 5.3 Per-Request Authorization

Every API route and server action runs through RBAC middleware before any domain logic:

```
Incoming request
    │
    ▼
[Read session_id from cookie]
    │  (missing → 401)
    ▼
[SELECT * FROM user_sessions WHERE id = ? AND expires_at > NOW() AND invalidated_at IS NULL]
    │  (not found or expired → 401)
    ▼
[SELECT users.* WHERE id = session.user_id AND is_active = TRUE]
    │  (inactive → 401; also write audit entry)
    ▼
[Load user roles and permissions → attach to request context]
    │
    ▼
[Route-level permission check]   ← always server-side; never trusts frontend flags
    │  (insufficient → 403)
    ▼
[Object-level ownership check if required]  ← e.g., teacher can only see own exams
    │  (unauthorized object → 403)
    ▼
[Domain logic]
```

### 5.4 Session Revocation

| Trigger | Action |
|---------|--------|
| User logs out | `DELETE FROM user_sessions WHERE id = ?` |
| Admin disables account | `users.is_active = false`; middleware rejects all future requests |
| Admin force-logout | `UPDATE user_sessions SET invalidated_at = NOW() WHERE user_id = ?` |
| Examination attempt blocked | **No session change.** Only `examination_attempts.status = 'blocked'` is updated. |
| Session expiry | Middleware naturally rejects expired rows; a periodic cleanup job deletes them. |

---

## 6. Examination Engine Architecture

### 6.1 Attempt Creation (Atomicity and Duplicate Prevention)

```sql
-- Wrapped in a serializable transaction
BEGIN;

-- Advisory lock keyed on (examination_id, student_id) prevents concurrent starts
SELECT pg_advisory_xact_lock(hashtext(examination_id || student_id));

-- Re-validate eligibility under the lock
SELECT COUNT(*) FROM examination_attempts
  WHERE examination_id = ? AND student_id = ?
  AND status IN ('in_progress', 'warning', 'blocked');
-- → If > 0, ROLLBACK and return 409 Conflict

SELECT COUNT(*) FROM examination_attempts
  WHERE examination_id = ? AND student_id = ?;
-- → If >= max_attempts, ROLLBACK and return 403

-- Create the attempt
INSERT INTO examination_attempts (
  id, examination_id, student_id, attempt_number,
  status, started_at, deadline_at, question_order, option_orders
) VALUES (
  gen_random_uuid(), ?, ?, (attempt_count + 1),
  'in_progress', NOW(), NOW() + INTERVAL '? minutes',
  ?, ?  -- frozen randomized order generated here
);

COMMIT;
```

`started_at` and `deadline_at` are set using the database's `NOW()` — not the application server clock — to avoid clock drift between multiple app instances or NTP desynchronization.

### 6.2 Timer Enforcement

- `deadline_at = started_at + INTERVAL '<duration_minutes> minutes'`; written once at attempt creation; never modified by the client.
- On every autosave request: `IF NOW() > deadline_at THEN 403 "Time expired"`.
- On submission request: `IF NOW() > deadline_at + INTERVAL '<grace_period_seconds> seconds' THEN 403`.
- Grace period default: `0 seconds`. Configurable per examination (stored in `examination_policy_settings.grace_period_seconds`).
- The client receives `{ deadline_at, server_now }` from the attempt-start response. Client countdown = `deadline_at - server_now` adjusted by local time elapsed.
- On page refresh, the client re-fetches the attempt (`GET /api/attempts/:id`) and recalculates countdown from fresh `server_now`.

### 6.3 Autosave — Idempotency and Stale-Write Prevention

Each `examination_answers` row has an `answer_sequence` column (integer) that the server increments on every write.

```
Client sends:
  PUT /api/answers
  { attempt_id, question_id, answer_value, client_sequence }

Server:
  1. Validate session + check attempt.status IN ('in_progress', 'warning')
  2. Validate NOW() <= deadline_at
  3. SELECT answer_sequence FROM examination_answers
       WHERE attempt_id = ? AND examination_question_id = ?
       FOR UPDATE NOWAIT          ← short row-level lock; immediate if contended return 503
  4. IF existing.answer_sequence > client_sequence
       → 409 Conflict; client discards pending write and re-syncs
  5. UPSERT examination_answers SET
       answer_value = ?, answer_sequence = client_sequence + 1, saved_at = NOW()
  6. Return { saved: true, sequence: new_sequence, server_timestamp }
```

Client retry on network failure:
- Re-send the same `client_sequence`. If server returns `409`, discard and re-fetch current state before retrying.
- Use exponential back-off (500 ms → 1 s → 2 s → 4 s, cap at 30 s).
- Show "Saving…" → "Saved" only after server confirms with 200.
- Show "Save error" on repeated failure; do not show "Saved" until confirmed.

### 6.4 Submission — Atomicity and Duplicate Prevention

```
POST /api/attempts/:id/submit

Transaction (REPEATABLE READ):
  1. SELECT ... FROM examination_attempts WHERE id = ? FOR UPDATE
  2. IF status NOT IN ('in_progress', 'warning') → 409 (already submitted or blocked)
  3. IF NOW() > deadline_at + grace_period → 403 (time expired)
  4. Upsert final answer values (accept any pending autosave answers)
  5. UPDATE examination_attempts SET
       status = 'submitted', submitted_at = NOW()
  6. INSERT INTO grading_records for every examination_question:
       - Objective questions: mark grading_method = 'auto'; score immediately
       - Essay questions: mark grading_method = 'manual', grading_status = 'pending'
  7. IF any manual grading exists: UPDATE attempts SET status = 'grading_pending'
     ELSE: trigger auto-finalize → status = 'submitted' (auto-grade completes synchronously)
  8. Write audit_logs entry
COMMIT
```

Duplicate submission protection: `FOR UPDATE` on the attempts row ensures only one concurrent submission can succeed; all others get `409`.

### 6.5 Grading Architecture

**Objective grading** (single_choice, multi_select, true_false, short_answer):
- Executed synchronously inside the submission transaction.
- Compares `examination_answers.answer_value` against `question_versions.grading_config` (snapshotted at publication).
- Scores are written to `grading_records` with `grading_method = 'auto'` and `grading_status = 'finalized'`.
- Never re-reads from the live `question_options` table; always uses the versioned snapshot.

**Manual grading** (essay):
- `grading_records` row created with `grading_status = 'pending'`.
- Teacher navigates to grading interface, enters score, optional feedback.
- Draft save: `grading_status = 'draft'`.
- Finalize: `grading_status = 'finalized'`; `graded_by`, `graded_at` written; attempt may transition to `completed`.
- Score modification after finalization: requires administrator authorization, reason field, and audit log with before/after values.

### 6.6 Recovery After Refresh or Disconnection

```
Student reconnects → GET /api/attempts/:id

Server returns:
  {
    status,           // current authoritative status
    deadline_at,      // server-canonical deadline
    server_now,       // current DB NOW()
    saved_answers,    // all persisted answers (keyed by examination_question_id)
    question_order,   // frozen order for this attempt
    option_orders     // frozen option orders per question
  }

Client:
  - If status = 'in_progress' or 'warning': resume examination with saved answers
  - If status = 'blocked': show blocked screen; disable answer inputs
  - If status = 'submitted' or 'completed': show submission confirmation
  - If status = 'expired': show expiry notice
  - Timer recalculated from deadline_at - server_now
```

No browser-cached state can override the server response. All UI state derives from the server's current attempt record.

---

## 7. Anti-Cheat Architecture

See `docs/anti-cheat-policy.md` for the full policy model.

### Separation of Concerns

| Concern | Owner |
|---------|-------|
| Browser event detection | Client (untrusted; events are signals, not proof) |
| Event recording | Server — thin write, no client logic |
| Policy evaluation | Server — pure function, idempotent, atomic |
| Attempt-state mutation | Server only — result of policy evaluation |
| Session (login) revocation | Independent — NOT triggered by anti-cheat |
| Teacher intervention | Server — authorized actors only; audit-logged |

### Idempotent Event Ingestion

Each client event submission includes a `client_event_id` (UUID generated in the browser). The server uses this as a deduplication key:

```sql
INSERT INTO examination_events (id, attempt_id, event_type, client_event_id, ...)
ON CONFLICT (attempt_id, client_event_id) DO NOTHING;
```

This prevents duplicate events from network retries from being double-counted in the policy evaluator.

### Atomic Policy Evaluation and Status Transition

```sql
-- Wrapped in a transaction
BEGIN;

SELECT pg_advisory_xact_lock(hashtext('policy:' || attempt_id));

-- Count qualifying events
SELECT COUNT(*) FROM examination_events
  WHERE attempt_id = ? AND event_type = ANY(counted_types)
  AND NOT is_manual_reset;           -- proctor can reset count on unlock

-- Compare and transition
IF count >= block_threshold THEN
  UPDATE examination_attempts SET status = 'blocked', updated_at = NOW()
    WHERE id = ? AND status IN ('in_progress', 'warning');
  INSERT INTO audit_logs ...;
ELSIF count >= warn_threshold THEN
  UPDATE examination_attempts SET status = 'warning', updated_at = NOW()
    WHERE id = ? AND status = 'in_progress';
END IF;

COMMIT;
```

The lock prevents two concurrent events from both independently concluding that the count is below the threshold and both triggering the wrong transition.

---

## 8. Real-Time Proctor Dashboard (SSE)

### Authorization and Scoping

- Endpoint: `GET /api/proctoring/stream?examination_id=<id>`
- Server validates: caller has a valid session, has proctor role for that examination (`examination_proctor_assignments`) or is administrator.
- Access is examination-scoped. A proctor for examination A cannot receive events for examination B from the same stream.

### Initial State Hydration

When a proctor opens the stream, before sending any push events, the server emits a `state_snapshot` event containing the current status of all participants:

```jsonc
event: state_snapshot
id: snap-<uuid>
data: {
  "examination_id": "...",
  "participants": [
    { "student_id": "...", "status": "in_progress", "incident_count": 0,
      "last_heartbeat": "...", "answers_saved": 12, "deadline_at": "..." },
    ...
  ]
}
```

### Stream Event Types

| SSE Event Name | Trigger |
|----------------|---------|
| `state_snapshot` | On connection open (full participant state) |
| `attempt_status_change` | Attempt transitions to any new status |
| `incident_recorded` | New examination event written for this examination |
| `connection_lost` | Heartbeat missed for a participant |
| `connection_restored` | Heartbeat resumed after missed |
| `proctor_action` | Intervention (block, unlock, warning) issued |
| `heartbeat` | Server-sent keep-alive every 25 s (prevents proxy timeouts) |

### Event ID and Replay

- Every SSE data event has a unique `id` field.
- On reconnect with `Last-Event-ID`, server replays events from the SSE event store (a 10-minute ring buffer in `examination_proctor_events` table) with `id > last_event_id`.
- If `Last-Event-ID` is older than 10 minutes or not provided, server sends a fresh `state_snapshot` instead of replay.

### Heartbeat and Timeout

- Server sends a comment-only keep-alive line (`:\n\n`) every 25 seconds.
- Nginx `proxy_read_timeout` set to 300 s for SSE endpoints.
- Client sets a 60-second reconnect timer; if no event or keep-alive received, reconnects with `Last-Event-ID`.

### Nginx SSE Configuration

```nginx
location /api/proctoring/stream {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Connection '';        # keep-alive, no upgrade
    proxy_buffering    off;                  # required for SSE
    proxy_cache        off;
    proxy_read_timeout 300s;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
}
```

---

## 9. File Storage (MinIO)

- Question media → bucket `nexam-media` (persistent).
- Export files (CSV, XLSX) → bucket `nexam-exports` (ephemeral; 1-hour TTL presigned download URL).
- Import files → bucket `nexam-imports` (retained 7 days for audit; then deleted by lifecycle policy).
- Application stores only the MinIO object key in the database — never a public URL.
- Download: generate presigned URL on demand (15-minute maximum validity) via server action; never expose MinIO credentials to the client.
- MinIO container port is internal-only; never published to host or internet.

---

## 10. Security Controls

See `docs/security-review.md` for comprehensive security requirements and test specifications.

| Control | Specification |
|---------|--------------|
| Password storage | Argon2id; `argon2@0.45.x`; `timeCost: 3, memoryCost: 65536, parallelism: 4`; never store plaintext |
| Session token | `crypto.randomUUID()` (122-bit entropy); HttpOnly, Secure, SameSite=Lax cookie |
| Session expiry | Default 8 hours; re-validated on every request |
| Login rate limiting | Per-IP: 10 attempts per 60 s (sliding window in DB); school NAT issue — see security doc §3 |
| CSRF | `SameSite=Lax` + `X-Requested-With: XMLHttpRequest` header required on all state-mutating API routes |
| SQL injection | Prisma parameterized queries only; no raw interpolation |
| Input validation | Zod schema on every API route; reject before DB access |
| Output encoding | React escapes by default; any `dangerouslySetInnerHTML` requires explicit DOMPurify sanitization |
| Upload validation | MIME allowlist + magic-byte check; max 10 MB; store in MinIO, never serve directly |
| Error responses | Generic error messages to client; structured detail logged server-side only |
| Answer-key confidentiality | Never include `grading_config` or correct answers in student-facing API responses |
| HTTPS | Enforced by Nginx; HSTS header on production (`max-age=31536000`) |
| Database isolation | PostgreSQL not published to host; accessible only within Docker network |
| Secrets | Environment variables only; `.env.example` committed; `.env` in `.gitignore` |

---

## 11. Open Architectural Questions

| ID | Question | Impact | Default Assumption |
|----|----------|--------|--------------------|
| AQ-01 | Target server hardware (CPU, RAM, SSD)? | Connection pool size, load-test validity | 8 CPU / 16 GB RAM assumed |
| AQ-02 | Internet access from day 1 or LAN-only first? | TLS cert strategy | LAN-only initially; internet in Phase 5 |
| AQ-03 | Confirmed concurrent student count? | Validates 200-session target | 200 assumed; requires load test |
| AQ-04 | Teachers proctoring on mobile? | Proctor dashboard responsive priority | Desktop-first assumed |
| AQ-05 | Backup destination (local NAS, cloud)? | Backup script design | Local NAS assumed |
| AQ-06 | Username convention (NIS, custom string, email)? | Import template, login label | Custom string assumed |
| AQ-07 | Does school ISP allow inbound port 443? | Internet access viability | Unconfirmed; must verify before Phase 5 |
