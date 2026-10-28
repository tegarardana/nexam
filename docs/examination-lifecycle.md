# Nexam – Examination Lifecycle

**Version:** 0.2  
**Last updated:** 2026-10-20  
**Status:** Phase 0 revised draft – subject to stakeholder approval  
**Changes from v0.1:** Auth/exam session independence made explicit; duplicate-attempt prevention via advisory lock specified; timer origin clarified (DB `NOW()`, not app-server clock); stale-write and retry semantics added; grace period introduced; disconnection recovery added; submission atomicity detailed.

---

## 1. Overview

An examination progresses through a well-defined sequence of states enforced exclusively on the server. The client displays the current state but cannot transition it directly.

**Critical design invariant:** An examination attempt's status (`in_progress`, `blocked`, `expired`, etc.) is independent of the student's login session (`user_sessions`). Blocking an attempt does not log the student out. Every endpoint that reads or writes attempt state re-validates both the session (is the user authenticated?) and the attempt (is this attempt in a state that permits this operation?) independently.

---

## 2. Examination-Level State Machine

### States

| State | Code | Description |
|-------|------|-------------|
| Draft | `draft` | Being configured; not visible to students |
| Ready | `ready` | Validated; awaiting publication |
| Scheduled | `scheduled` | Published; before the active window |
| In Progress | `in_progress` | Within the scheduled window; students may start |
| Closed | `closed` | Window has passed; no new attempts accepted |
| Grading | `grading` | Objective grading done; manual essay grading in progress |
| Finalized | `finalized` | All grading complete; results may be published |

### Valid Transitions

```
[draft] ──▶ [ready] ──▶ [scheduled] ──▶ [in_progress] ──▶ [closed] ──▶ [grading] ──▶ [finalized]
                │                                                                          │
                └──◀──── admin: revert to draft (audit required; only if no attempts) ◀───┘
```

| From | To | Authorized Actor | Conditions |
|------|----|-----------------|------------|
| `draft` | `ready` | Teacher (owner), Admin | Question validation passes; required fields set; `examination_policy_settings` row exists |
| `ready` | `draft` | Teacher (owner), Admin | Zero `examination_attempts` rows exist for this examination |
| `ready` | `scheduled` | Teacher (owner), Admin | `scheduled_start` is in the future |
| `scheduled` | `draft` | Admin only | Zero attempts; explicit audit entry required |
| `scheduled` | `in_progress` | **System** (time-based job) | `NOW() >= scheduled_start` |
| `in_progress` | `closed` | **System** / Admin | `NOW() >= scheduled_end` OR admin manual close with reason |
| `closed` | `grading` | **System** / Teacher (assigned) | At least one essay question exists in `examination_questions`; objective grading complete |
| `closed` | `finalized` | **System** | No essay questions; all objective grading complete |
| `grading` | `finalized` | Teacher (assigned) / Admin | All `grading_records.grading_status = 'finalized'` for all non-expired attempts |
| `finalized` → any | ❌ FORBIDDEN | — | Historical records must be preserved; use result-modification workflow |

> **Material changes** to a scheduled or published examination (question content, points, duration, schedule) require: (1) administrator authorization, (2) notification to affected students, (3) an audit log entry with full before/after values. The examination must be reverted to `draft` first if no attempts have started; otherwise the change is blocked entirely and must be handled by closing and creating a new examination.

---

## 3. Attempt-Level State Machine

Each student attempt is an independent record with its own lifecycle. **It shares no state with `user_sessions`.**

### States

| State | Code | Description |
|-------|------|-------------|
| Not Started | `not_started` | Participant record exists; student has not clicked Start |
| In Progress | `in_progress` | Student is actively taking the examination |
| Warning | `warning` | Anti-cheat policy issued a warning; student may continue answering |
| Blocked | `blocked` | Anti-cheat threshold reached; proctor intervention required to resume |
| Submitted | `submitted` | Student submitted; grading in progress |
| Grading Pending | `grading_pending` | Essay questions awaiting manual grading |
| Completed | `completed` | All grading finalized; result record exists |
| Expired | `expired` | Deadline passed before submission |

### Valid Attempt Transitions

```
[not_started]
      │
      ▼  (Start: server validates eligibility + acquires advisory lock + creates row)
[in_progress] ──────────────────────────────────────────────────────────────► [expired]
      │                                                               (deadline_at passed;
      │ (warn threshold)                                              system background job)
      ▼
 [warning] ──► [in_progress]  (student acknowledges warning)
      │
      │ (block threshold OR proctor manual block)
      ▼
 [blocked] ──► [in_progress]  (proctor authorized unlock; audit record)
      │
      │ (admin forced submission)
      ▼
 [submitted]  ◄──────────────────────── (student submits / system deadline submission)
      │
      ├──► [completed]          (no essays; auto-grading done synchronously)
      │
      └──► [grading_pending] ──► [completed]  (after all essays graded + finalized)
```

| From | To | Who May Trigger | Server Conditions |
|------|----|-----------------|-------------------|
| `not_started` | `in_progress` | Student | Exam `in_progress`; student is participant; account active; attempt count < max_attempts; no concurrent active attempt (see §4) |
| `in_progress` | `warning` | **System** (policy evaluator) | Qualifying event count ≥ `warn_threshold` |
| `warning` | `in_progress` | Student (acknowledgment) | Student POSTs acknowledgment; server validates attempt is `warning` |
| `in_progress` | `blocked` | **System** / Proctor | Count ≥ `block_threshold` OR authorized proctor manual block |
| `warning` | `blocked` | **System** / Proctor | Count ≥ `block_threshold` while in warning |
| `blocked` | `in_progress` | Proctor (assigned) / Admin | Proctor provides intervention note; audit logged; `deadline_at` is NOT reset by default |
| `in_progress` | `submitted` | Student | `NOW() <= deadline_at + grace_period_seconds`; attempt `in_progress` |
| `warning` | `submitted` | Student | Same as above |
| `blocked` | `submitted` | Admin only | Emergency; audit entry with reason required |
| `in_progress` | `expired` | **System** | `NOW() > deadline_at + grace_period_seconds`; not yet submitted |
| `warning` | `expired` | **System** | Same |
| `submitted` | `grading_pending` | **System** | At least one `grading_records.grading_status = 'pending'` |
| `submitted` | `completed` | **System** | All records `grading_status = 'finalized'` (no essays or all auto-graded) |
| `grading_pending` | `completed` | **System** | All `grading_records.grading_status = 'finalized'` |
| `completed` → any | ❌ FORBIDDEN | — | Use authorized result-modification workflow; creates audit record |

---

## 4. Pre-Exam Eligibility and Duplicate-Attempt Prevention

When a student requests to start, the server executes the following inside a **serializable transaction with an advisory lock** keyed on `(examination_id, student_id)`:

1. Lock acquired: `SELECT pg_advisory_xact_lock(hashtext(exam_id || student_id))`.
2. Session valid and `users.is_active = TRUE`.
3. `examinations.status = 'in_progress'`.
4. `NOW()` is between `scheduled_start` and `scheduled_end`.
5. Student is in `examination_participants` for this examination.
6. Count of existing attempts with status IN (`in_progress`, `warning`, `blocked`) = 0.
7. Count of all existing attempts < `max_attempts`.
8. If `access_password_hash` is set: verify student-provided password with Argon2id.

If any check fails: transaction rolled back; attempt row not created; appropriate error returned. The advisory lock ensures no two concurrent requests can both pass check 6 simultaneously.

---

## 5. Timer and Deadline Enforcement

### Timer Origin

```sql
-- Written once at attempt creation; set from DB clock, not app-server clock
INSERT INTO examination_attempts (started_at, deadline_at, ...)
VALUES (
  NOW(),
  NOW() + (duration_minutes * INTERVAL '1 minute'),
  ...
);
```

Using `NOW()` from the database ensures all timer calculations are clock-consistent even if multiple application instances are running or the app server's NTP drifts.

### Per-Request Deadline Enforcement

| Endpoint | Check | On Failure |
|----------|-------|-----------|
| `PUT /api/answers` (autosave) | `NOW() > deadline_at` | `403 Time expired`; stop autosave loop |
| `POST /api/attempts/:id/submit` | `NOW() > deadline_at + grace_period_seconds` | `403 Submission window closed` |
| `POST /api/heartbeat` | `NOW() > deadline_at` | `403`; client stops heartbeat |

### Authorized Deadline Extension

Only an administrator may extend a deadline:
1. Admin sends `PATCH /api/attempts/:id/extend` with `{ extend_minutes: N, reason: "..." }`.
2. Server validates: caller is admin; attempt is `in_progress`, `warning`, or `blocked`.
3. New `deadline_at = current deadline_at + N minutes` (capped at the examination's `scheduled_end`).
4. Audit log entry written with old and new `deadline_at` and reason.
5. Client receives updated `deadline_at` in next heartbeat or poll response.

### Expiry Background Job

A scheduled job running every 30 seconds:
```sql
UPDATE examination_attempts
SET status = 'expired', updated_at = NOW()
WHERE status IN ('in_progress', 'warning')
  AND deadline_at < NOW() - INTERVAL 'grace_period_seconds seconds';
```
The `grace_period_seconds` is read from `examination_policy_settings` for each attempt's examination. After expiry, no further answer writes or submissions are accepted.

---

## 6. Autosave — Idempotency and Stale-Write Prevention

### Write Protocol

```
Client → PUT /api/answers
  Body: { attempt_id, examination_question_id, answer_value, client_sequence }

Server:
  1. Validate session (authenticated, account active)
  2. Validate attempt: status IN ('in_progress', 'warning') [NOT 'blocked']
  3. Validate NOW() <= deadline_at
  4. SELECT answer_sequence FROM examination_answers
       WHERE attempt_id = ? AND examination_question_id = ?
       FOR UPDATE NOWAIT
     → If locked (concurrent write): return 503; client retries
  5. IF existing.answer_sequence > client_sequence:
       → Return 409 Conflict { current_sequence, current_value }
       → Client discards pending write, adopts current_value, resumes
  6. UPSERT examination_answers SET
       answer_value    = client_answer_value,
       answer_sequence = client_sequence + 1,
       saved_at        = NOW()
  7. Return 200 { saved: true, sequence: (client_sequence + 1), server_timestamp }
```

### Client Retry Policy

- On network failure (no response): wait 500 ms, retry with the same `client_sequence`.
- On `409 Conflict`: discard stale write; adopt server's `current_value`; resume from `current_sequence`.
- On `403 Time expired`: stop autosave loop; show "Time expired" banner.
- On `503 Locked`: wait 200 ms; retry up to 3 times.
- Exponential back-off for repeated network failures: 500 ms → 1 s → 2 s → 4 s → 30 s (cap).
- Never show "Saved ✓" until a `200` response is received from the server.

---

## 7. Submission — Atomicity and Duplicate-Prevention

```
POST /api/attempts/:id/submit

BEGIN TRANSACTION (REPEATABLE READ):

  1. SELECT * FROM examination_attempts WHERE id = ? FOR UPDATE
     → Lock prevents concurrent duplicate submissions

  2. IF status NOT IN ('in_progress', 'warning'):
       ROLLBACK → 409 "Attempt cannot be submitted in current state"

  3. IF NOW() > deadline_at + grace_period_seconds:
       ROLLBACK → 403 "Submission window closed"

  4. Persist any final answers from submission body
     (same idempotent UPSERT logic as autosave)

  5. UPDATE examination_attempts SET
       status = 'submitted', submitted_at = NOW()

  6. For each examination_question in this attempt:
       INSERT INTO grading_records (...)
       - Auto-gradeable types: grade immediately, status = 'finalized'
       - Essay: status = 'pending'

  7. Compute total objective score; update examination_results (provisional)

  8. IF any grading_records.grading_status = 'pending':
       UPDATE examination_attempts SET status = 'grading_pending'
     ELSE:
       UPDATE examination_attempts SET status = 'completed'
       UPDATE examination_results SET is_provisional = FALSE, finalized_at = NOW()

  9. INSERT INTO audit_logs (...)

COMMIT
```

The `FOR UPDATE` lock on step 1 means a second concurrent `POST /submit` for the same attempt will wait, then read `status = 'submitted'` and return `409`.

---

## 8. Grading

### Objective Questions (auto)

Graded synchronously inside the submission transaction:

- Read `grading_config` from `examination_questions.question_version_id → question_versions.grading_config`.
- **Never re-read from `question_options`** — always use the versioned snapshot to prevent grading against an updated key.
- Grading methods:
  - `single_choice` / `true_false`: exact match → full points; no match → 0.
  - `multi_select`: configurable; default is all-or-nothing (all correct options selected, no incorrect options selected → full points; otherwise 0).
  - `short_answer`: string comparison against configured accepted values; case-sensitivity and whitespace normalization per `grading_config`.

### Essay (manual)

1. `grading_records` created with `grading_status = 'pending'`.
2. Teacher opens grading interface; reviews student's `examination_answers.answer_value.text`.
3. Teacher enters score (`0 ≤ score ≤ max_score`), optional feedback.
4. Save draft: `grading_status = 'draft'`; score visible to teacher only.
5. Finalize: `grading_status = 'finalized'`; `graded_by`, `graded_at` written.
6. After all essays for an attempt are finalized: attempt transitions to `completed`; `examination_results` updated.

**Modifying a finalized essay score** requires:
- Administrator authorization.
- `reason` field (required).
- Audit log with `before_value` (old score) and `after_value` (new score).
- `examination_results.last_modified_by`, `last_modified_at`, `modification_reason` written.

---

## 9. Recovery After Refresh or Disconnection

```
Student reconnects → GET /api/attempts/:id/state

Server returns:
{
  "status":         "in_progress",   // authoritative attempt status
  "deadline_at":    "...",           // authoritative deadline
  "server_now":     "...",           // DB NOW() at response time
  "saved_answers":  { ... },         // map of question_id → { answer_value, answer_sequence }
  "question_order": [ ... ],         // frozen order for this attempt
  "option_orders":  { ... }          // frozen option orders per question
}

Client behavior by status:
  'in_progress' / 'warning' → resume exam; recalculate timer from deadline_at - server_now
  'blocked'                 → show blocked screen; disable all inputs; show proctor contact
  'submitted' / 'grading_pending' / 'completed' → show submission confirmation
  'expired'                 → show expiry notice
```

No browser-cached state can override this response. Every UI state is derived from the server's current record on reconnect.

---

## 10. Result Publication Lifecycle

1. When attempt → `completed`: system writes or updates `examination_results` with `is_provisional = FALSE`.
2. Teacher or system evaluates `result_release_policy`:
   - `auto`: `result_publications` row created automatically when attempt reaches `completed`.
   - `manual`: teacher explicitly publishes.
   - `after_grading`: system creates publication when examination reaches `finalized` (all attempts resolved).
3. Students can only see their result via API if a `result_publications` row exists for their examination (or examination + student_id scope).
4. The API never includes `grading_config`, correct answers, or other students' results in student-facing responses.

---

## 11. Examination Audit Trail

Every transition below requires a corresponding `audit_logs` row before the state change is committed:

| Event | Required Audit Fields |
|-------|-----------------------|
| Examination published / scheduled | `actor_id`, `examination_id`, `before: status`, `after: status`, `published_at` |
| Material change to published exam | `actor_id`, `examination_id`, changed field, full before/after value |
| Attempt manually blocked by proctor | `actor_id`, `attempt_id`, `student_id`, `intervention_note` |
| Attempt unlocked by proctor | `actor_id`, `attempt_id`, `intervention_note`, old/new `deadline_at` if extended |
| Finalized result modified | `actor_id`, `result_id`, old score, new score, `modification_reason` |
| Examination manually closed | `actor_id`, `examination_id`, `reason` |
| Deadline extended | `actor_id`, `attempt_id`, old `deadline_at`, new `deadline_at`, `authorized_by`, `reason` |
| Admin forced submission | `actor_id`, `attempt_id`, `reason` |
| Result published / withdrawn | `actor_id`, `examination_id`, `scope`, publication timestamp |
