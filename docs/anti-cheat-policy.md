# Nexam – Anti-Cheat Policy Model

**Version:** 0.2  
**Last updated:** 2026-10-20  
**Status:** Phase 0 revised draft – subject to stakeholder approval  
**Changes from v0.1:** `client_event_id` deduplication added; atomic policy evaluation with advisory lock specified; auth session and attempt blocking explicitly separated; heartbeat miss is connection status, not attempt status; duplicate/concurrent event handling specified; proctor unlock reset semantics clarified.

---

## 1. Design Philosophy

The anti-cheat system is designed around **honest capability claims**:

- The system monitors observable browser events and records them as **potential policy signals**.
- Browser-event monitoring is **not a guarantee** that academic misconduct is occurring, nor that it is prevented.
- The system does **not** claim to detect: activity on other devices, secondary screens, external applications, or any form of assistance not visible in the browser window.
- Recorded events support **human review** by proctors and administrators. They are signals to be evaluated in context, not automated verdicts.
- The student warning screen uses neutral, non-accusatory language.
- Network disconnection is never, by itself, treated as a policy violation.

> **Critical:** Blocking an examination attempt does **not** invalidate the student's login session. Session revocation and attempt blocking are entirely independent operations.

---

## 2. Detectable Events

Browser events are captured by the client and reported to the server. Only events within a valid, active (`in_progress` or `warning`) attempt are processed by the policy evaluator.

| Event Code | Client Trigger | Server Detection | Reliability |
|-----------|---------------|-----------------|-------------|
| `focus_loss` | `window.blur` | Client-reported | Reliable; fires on Alt+Tab, click outside window |
| `visibility_change` | `document.visibilitychange → hidden` | Client-reported | Reliable; covers tab switching |
| `fullscreen_exit` | `fullscreenchange` when `document.fullscreenElement = null` | Client-reported | Reliable when fullscreen enforced |
| `fullscreen_attempt` | Student re-enters fullscreen | Client-reported | Informational |
| `page_unload` | `beforeunload` event | Client-reported | Best-effort; unreliable on mobile |
| `network_disconnect` | `navigator.onLine = false` or failed fetch | Client-reported | Reliable; **not a violation by itself** |
| `heartbeat_missed` | No heartbeat in `heartbeat_interval_s * 2` seconds | **Server-detected** | Reliable; triggers `connection_status = 'disconnected'` only |
| `session_conflict` | Student attempts a second concurrent start | **Server-detected** | Reliable; prevented by advisory lock |

### Events NOT Treated as Policy Violations by Default

| Event | Reason |
|-------|--------|
| `network_disconnect` | Connectivity loss alone is not evidence of misconduct |
| `heartbeat_missed` | Treated as a connection status change, not an anti-cheat incident |
| `page_unload` on mobile | Event is unreliable; cannot be counted fairly |
| Page refresh | Student may legitimately refresh; attempt is resumed per policy |

`heartbeat_missed` updates `examination_attempts.connection_status` to `'disconnected'` and pushes a `connection_lost` SSE event to the proctor dashboard. It does **not** increment `incident_count` or trigger the policy evaluator.

---

## 3. Anti-Cheat Policy Modes

Each examination must have exactly one policy record in `examination_policy_settings` before it can be published.

### Practice Mode

- All configured events are recorded but produce no warnings and no blocks.
- Used for rehearsal or low-stakes assessments.
- Proctor can still view the event history.
- `warn_threshold` and `block_threshold` values are stored but not evaluated.

### Standard Mode (default)

- Events are recorded.
- When `incident_count >= warn_threshold`: attempt → `warning`; proctor notified.
- When `incident_count >= block_threshold`: attempt → `blocked`; proctor notified; audit logged.
- Default configuration (configurable per examination):
  - `warn_threshold = 1`
  - `block_threshold = 3`

### Strict Mode

- Events are recorded.
- First qualifying event triggers a warning immediately.
- Second qualifying event blocks the session.
- Effective defaults:
  - `warn_threshold = 1`
  - `block_threshold = 2`

### Custom Mode

- Teacher configures which specific event types are counted toward the threshold.
- Requires administrator approval before the examination can be published.
- Configuration stored in `examination_policy_settings.custom_rules` JSONB, validated at publication time.

```json
{
  "counted_events": ["focus_loss", "visibility_change", "fullscreen_exit"],
  "warn_threshold": 2,
  "block_threshold": 5,
  "require_proctor_unlock": true
}
```

---

## 4. Event Processing Flow

### 4.1 Client Event Submission

```
Browser detects event
        │
        ▼
Client generates client_event_id = crypto.randomUUID()
Client sends POST /api/examination-events
  {
    attempt_id,
    event_type,
    client_event_id,    ← UUID; used for server-side deduplication
    client_timestamp,   ← diagnostic only
    metadata            ← e.g., { duration_ms: 1200 }
  }
        │
        ▼
Server validates:
  1. Session is authenticated (user_sessions check)
  2. attempt.status IN ('in_progress', 'warning')
     → 'blocked': return 403 (stop reporting)
     → 'submitted' / 'expired': return 403
  3. NOW() <= deadline_at
        │
        ▼
Server inserts event (idempotent):
  INSERT INTO examination_events (attempt_id, client_event_id, event_type, server_timestamp, ...)
  ON CONFLICT (attempt_id, client_event_id) DO NOTHING
  → If conflict: event already recorded (client retry); return 200 with previous result
        │
        ▼
Server runs policy evaluator (§4.2)
```

### 4.2 Policy Evaluator (Atomic)

The policy evaluator runs inside a transaction with a per-attempt advisory lock to prevent two concurrent events from racing into an incorrect threshold transition.

```sql
BEGIN;

-- Acquire per-attempt lock (prevents concurrent policy evaluations for same attempt)
SELECT pg_advisory_xact_lock(hashtext('policy:' || attempt_id::text));

-- Re-read attempt status inside the lock (may have changed since event was inserted)
SELECT status FROM examination_attempts WHERE id = ? FOR UPDATE;
-- If status not in ('in_progress', 'warning'): ROLLBACK, return no-op

-- Count qualifying events (counting only event types configured by the policy)
SELECT COUNT(*) FROM examination_events
  WHERE attempt_id = ?
    AND event_type = ANY(counted_event_types)
    AND (incident_count_reset_at IS NULL
         OR server_timestamp > (SELECT incident_count_reset_at FROM examination_attempts WHERE id = ?));

-- Apply policy
IF count >= block_threshold AND current_status != 'blocked':
  UPDATE examination_attempts SET status = 'blocked', incident_count = count, updated_at = NOW();
  INSERT INTO audit_logs (...);
  → Push 'attempt_status_change' SSE event to proctor
  → Return { action: 'blocked', ... }

ELSIF count >= warn_threshold AND current_status = 'in_progress':
  UPDATE examination_attempts SET status = 'warning', incident_count = count, updated_at = NOW();
  → Push 'attempt_status_change' SSE event to proctor
  → Return { action: 'warning', ... }

ELSE:
  UPDATE examination_attempts SET incident_count = count;
  → Return { action: 'recorded', ... }

COMMIT;
```

### 4.3 Handling Duplicate and Concurrent Events

| Scenario | Handling |
|----------|----------|
| Client retries the same event (same `client_event_id`) | `ON CONFLICT DO NOTHING`; return cached result |
| Two events arrive simultaneously for the same attempt | Advisory lock serializes evaluations; only one transitions status |
| Event arrives for a `blocked` attempt | Rejected with `403`; no evaluation |
| Event arrives after `deadline_at` | Rejected with `403` |

---

## 5. Attempt-State Enforcement

When `examination_attempts.status = 'blocked'`:

| Endpoint | Response | Note |
|----------|----------|------|
| `PUT /api/answers` | `403 Attempt is blocked` | No answer writes accepted |
| `POST /api/attempts/:id/submit` | `403 Attempt is blocked` | No submission |
| `POST /api/examination-events` | `403 Attempt is blocked` | Stop sending events |
| `POST /api/heartbeat` | `403` | Stop heartbeat loop |
| `GET /api/attempts/:id/state` | `200` with `status: 'blocked'` | Student can still see block screen |

> **Session is unaffected.** The student remains logged in. Their `user_sessions` row is not touched. They can see the blocked status message and navigate to other permitted pages (e.g., their profile, notifications).

---

## 6. Heartbeat and Connection Status

The heartbeat mechanism tracks connection health independently of the anti-cheat policy.

```
Client: POST /api/heartbeat
  { attempt_id }
  every heartbeat_interval_s seconds (default: 30)

Server:
  Validate session + attempt.status not terminal
  UPDATE examination_attempts SET
    last_heartbeat = NOW(),
    connection_status = 'connected'

Background job (every 60 s):
  UPDATE examination_attempts SET connection_status = 'disconnected'
  WHERE status IN ('in_progress', 'warning', 'blocked')
    AND last_heartbeat < NOW() - (heartbeat_interval_s * 2) * INTERVAL '1 second'
    AND connection_status = 'connected'
  → For each updated row: INSERT INTO examination_events (event_type = 'heartbeat_missed', actor = system)
  → Push 'connection_lost' SSE event to proctor dashboard (NOT an anti-cheat incident)

When client reconnects (heartbeat resumes):
  connection_status → 'connected'
  Push 'connection_restored' SSE event to proctor
```

`heartbeat_missed` is **never counted toward `warn_threshold` or `block_threshold`**. It is a connection-quality signal, not a policy violation.

---

## 7. Proctor Intervention

### 7.1 Issue Manual Warning

1. Proctor sends `POST /api/proctoring/warn` `{ attempt_id, note }`.
2. Server validates: caller is assigned proctor or admin; attempt is `in_progress`.
3. Server:
   - Inserts `examination_events { event_type: 'manual_warning', actor_id: proctor_id, intervention_note }`.
   - Updates `attempt.status = 'warning'` (if not already `warning` or `blocked`).
   - Writes `audit_logs` entry.
   - Pushes `attempt_status_change` SSE event.
4. Returns `200`.

### 7.2 Block Session

1. Proctor sends `POST /api/proctoring/block` `{ attempt_id, note }`.
2. Server validates: caller is assigned proctor or admin; attempt is `in_progress` or `warning`.
3. Server (inside transaction with advisory lock):
   - Inserts `examination_events { event_type: 'manual_block', actor_id: proctor_id, intervention_note }`.
   - Updates `attempt.status = 'blocked'`.
   - Writes `audit_logs` entry.
   - Pushes `attempt_status_change` SSE event.
4. All subsequent answer writes and event reports from that student → `403`.
5. Saved answers are preserved; nothing is deleted.

### 7.3 Unlock Session

```
Proctor sends POST /api/proctoring/unlock
  { attempt_id, note, reset_incident_count: boolean }

Server validates:
  1. Caller is assigned proctor OR administrator
  2. attempt.status = 'blocked'
  3. note is non-empty

Server (transaction + advisory lock):
  INSERT INTO examination_events
    { event_type: 'manual_unlock', actor_id: proctor_id, intervention_note: note }
  UPDATE examination_attempts SET
    status = 'in_progress',
    incident_count = IF reset_incident_count THEN 0 ELSE incident_count,
    incident_count_reset_at = IF reset_incident_count THEN NOW() ELSE NULL
  INSERT INTO audit_logs (...)
  Push 'attempt_status_change' SSE event

Return 200 { status: 'in_progress', deadline_at, server_now }
  (client resumes countdown from returned deadline_at)
```

> Unlocking does **not** extend the deadline by default. If additional time is warranted, an admin must use the separate deadline-extension endpoint.

**Unlock cannot be performed by the student or any client-side code.** Any frontend modification that sends a request not carrying a valid proctor or admin session will be rejected at the server's RBAC layer.

---

## 8. Student-Facing Warning Screen

When the attempt transitions to `warning`, the examination interface shows a non-dismissible overlay until the student explicitly acknowledges it.

### Required Content

1. Neutral description of what was observed (e.g., "A browser focus event was recorded.").
2. The applicable examination rule (e.g., "Please keep this browser window focused during the examination.").
3. Incident count in neutral language (e.g., "This is incident 1 of 3 before a session hold.").
4. Clear statement that the student may continue (if not blocked).
5. Contact instructions if blocked ("Please raise your hand or contact your supervisor to continue.").
6. "I understand" acknowledgment button; POSTs to `/api/attempts/:id/acknowledge-warning`.

### Tone Requirements

- No accusatory language ("you cheated", "you were caught").
- No certainty claims ("the system detected you cheating").
- No implicit judgment: "A browser event was recorded" — not "You left the exam window."

---

## 9. Anti-Cheat Configuration Validation

Before an examination can transition from `ready` to `scheduled`, the server validates:

- `examination_policy_settings` row exists with a valid `mode`.
- `block_threshold >= warn_threshold >= 1`.
- `grace_period_seconds >= 0`.
- `heartbeat_interval_s >= 10`.
- For `custom` mode:
  - `custom_rules` JSONB is parseable and schema-valid.
  - `custom_rules.counted_events` is non-empty and contains only valid `exam_event_type` values.
  - An administrator has explicitly approved the custom configuration (stored in `audit_logs` as `examination_policy.custom_approved`).

---

## 10. Known Limitations

These limitations must be communicated to school administrators before deployment:

| Limitation | Practical Impact |
|-----------|-----------------|
| Cannot detect other devices or secondary screens | Student may reference phone, tablet, or second monitor |
| Cannot detect OS-level screenshots | Student may capture question content |
| `beforeunload` is unreliable on mobile browsers | Tab close on mobile may not generate a `page_unload` event |
| Browser extensions may suppress focus events | Legitimate tools (e.g., screen readers, password managers) may trigger false positives |
| Network disconnect is not a violation | A student who deliberately disconnects avoids generating focus/visibility events |
| Fullscreen detection only applies if fullscreen is enforced | If the examination does not require fullscreen, `fullscreen_exit` is not applicable |
| Advisory locks are per-database-session | Across multiple application instances, advisory locks scope to each Postgres connection; `pg_advisory_xact_lock` is session-scoped and therefore effective within the transaction |

**The system must be described as browser-event monitoring and policy enforcement, not as a cheating prevention guarantee.**
