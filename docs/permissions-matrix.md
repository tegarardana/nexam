# Nexam – Role-Based Permissions Matrix

**Version:** 0.2  
**Last updated:** 2026-10-23  
**Status:** Phase 0 revised draft – subject to stakeholder approval  
**Changes from v0.1:** Proctor concept clarified (teacher assigned to an exam acts as its proctor, not a separate role); permission scope wording made consistent with database-schema.md v0.2 and examination-lifecycle.md v0.2; Node 26 / Next.js 16 references aligned with architecture.md v0.2.

---

## 1. Roles

| Role | Code | Description |
|------|------|-------------|
| Student | `student` | Takes examinations, views own results. |
| Teacher | `teacher` | Manages own examinations and question banks. A teacher **assigned to an examination as proctor** gains live proctoring access for that examination (proctor is an assignment, not a separate platform role). |
| Administrator | `administrator` | Manages all users, academic structure, and platform settings. Inherits all teacher capabilities across all examinations regardless of assignment. |

**MVP uses a single-role model per user.** Multi-role assignments are schema-supported (`user_roles` junction table) but not required for MVP.

> **Proctor note:** The `examination_proctor_assignments` table records which teacher is proctor for a given examination. The live proctoring permissions in §3.6 apply to that teacher for that specific examination only. Administrators are implicitly proctor for all examinations.

---

## 2. Permission Naming Convention

Permissions follow the pattern `<module>:<action>`:

- `examination:create` – create a new examination record
- `examination:publish` – transition an examination to scheduled/published status
- `result:finalize` – finalize a grading result (write-once audit-required action)

---

## 3. Full Permission Matrix

### 3.1 Authentication and Account

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| Login | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ |
| View own profile | ✅ | ✅ | ✅ |
| View all user accounts | ❌ | ❌ | ✅ |
| Create user accounts | ❌ | ❌ | ✅ |
| Import user accounts (bulk) | ❌ | ❌ | ✅ |
| Edit any user profile | ❌ | ❌ | ✅ |
| Activate / deactivate accounts | ❌ | ❌ | ✅ |
| Reset another user's password | ❌ | ❌ | ✅ |
| Assign or change user roles | ❌ | ❌ | ✅ |
| View account audit history | ❌ | ❌ | ✅ |

### 3.2 Academic Structure

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View own class and academic year | ✅ | ✅ | ✅ |
| View all class groups | ❌ | ✅ (assigned only) | ✅ |
| Create academic years | ❌ | ❌ | ✅ |
| Activate / archive academic years | ❌ | ❌ | ✅ |
| Create semesters | ❌ | ❌ | ✅ |
| Create / edit majors | ❌ | ❌ | ✅ |
| Create / edit class groups | ❌ | ❌ | ✅ |
| Assign students to class groups | ❌ | ❌ | ✅ |
| Bulk promote students | ❌ | ❌ | ✅ |
| Create / edit subjects | ❌ | ❌ | ✅ |
| Create subject offerings | ❌ | ❌ | ✅ |
| Assign teachers to subjects | ❌ | ❌ | ✅ |
| Run new academic year wizard | ❌ | ❌ | ✅ |

### 3.3 Question Bank

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View own question bank | ❌ | ✅ (own questions) | ✅ |
| Create questions | ❌ | ✅ | ✅ |
| Edit draft questions (own) | ❌ | ✅ | ✅ |
| Edit published questions (own) | ❌ | ✅ (creates new version) | ✅ |
| Publish questions | ❌ | ✅ (own) | ✅ |
| Archive questions | ❌ | ✅ (own) | ✅ |
| Upload question media | ❌ | ✅ | ✅ |
| View all teachers' questions | ❌ | ❌ | ✅ |

> **Note:** "Own" means questions created by that teacher. Administrators can access all questions across all teachers.

### 3.4 Examination Management

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View available examinations (assigned) | ✅ | ❌ | ❌ |
| View own created examinations | ❌ | ✅ | ✅ |
| Create examination | ❌ | ✅ | ✅ |
| Edit draft examination (own) | ❌ | ✅ | ✅ |
| Edit published examination (authorized workflow only) | ❌ | ✅ (own, with audit) | ✅ |
| Publish / schedule examination | ❌ | ✅ (own) | ✅ |
| Close examination | ❌ | ✅ (own or assigned) | ✅ |
| Assign participants to examination | ❌ | ✅ (own) | ✅ |
| Assign proctor to examination | ❌ | ❌ | ✅ |
| Configure anti-cheat policy | ❌ | ✅ (own) | ✅ |
| View all examinations | ❌ | ❌ | ✅ |
| Delete draft examination (own) | ❌ | ✅ | ✅ |
| Delete published examination | ❌ | ❌ | ❌ (soft-close only) |

### 3.5 Examination Delivery (Student Experience)

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| Start own assigned examination | ✅ | ❌ | ❌ |
| Save own answers | ✅ | ❌ | ❌ |
| Submit own attempt | ✅ | ❌ | ❌ |
| View own attempt state | ✅ | ❌ | ❌ |
| Resume disconnected attempt (if policy allows) | ✅ | ❌ | ❌ |
| View another student's answers | ❌ | ❌ | ❌ |
| Modify timer | ❌ | ❌ | ❌ (server-enforced) |
| Unblock own session | ❌ | ❌ | ❌ (proctor only) |

### 3.6 Live Proctoring

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View live proctor dashboard | ❌ | ✅ (assigned exams) | ✅ |
| View participant status list | ❌ | ✅ (assigned) | ✅ |
| View answer progress | ❌ | ✅ (assigned, if policy allows) | ✅ |
| View examination event history | ❌ | ✅ (assigned) | ✅ |
| Issue manual warning to student | ❌ | ✅ (assigned) | ✅ |
| Block a student session | ❌ | ✅ (assigned) | ✅ |
| Unlock a blocked student session | ❌ | ✅ (assigned, with audit) | ✅ |
| Resume an eligible attempt | ❌ | ✅ (assigned, with audit) | ✅ |
| Record intervention note | ❌ | ✅ (assigned) | ✅ |
| Escalate incident to administrator | ❌ | ✅ | ✅ |

### 3.7 Grading and Results

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View own result (published only) | ✅ | ❌ | ❌ |
| View own examination history | ✅ | ❌ | ❌ |
| View all students' results (assigned exam) | ❌ | ✅ | ✅ |
| Grade essay questions (assigned exam) | ❌ | ✅ | ✅ |
| Save draft grade | ❌ | ✅ | ✅ |
| Finalize grade | ❌ | ✅ (assigned) | ✅ |
| Modify finalized grade | ❌ | ❌ | ✅ (with reason + audit) |
| Publish results | ❌ | ✅ (assigned, per policy) | ✅ |
| Withdraw published result | ❌ | ❌ | ✅ (with audit) |
| Export result report (CSV/XLSX) | ❌ | ✅ (assigned) | ✅ |
| View answer key before authorized release | ❌ | ✅ (own exam) | ✅ |
| Access answer key from student client | ❌ | ❌ | ❌ |

### 3.8 Reports and Audit Logs

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View audit logs | ❌ | ❌ | ✅ |
| Search and filter audit logs | ❌ | ❌ | ✅ |
| Export audit logs | ❌ | ❌ | ✅ |
| View import job history | ❌ | ❌ | ✅ |
| Run data exports | ❌ | ✅ (authorized scope only) | ✅ |

### 3.9 Platform Administration

| Permission | Student | Teacher | Administrator |
|-----------|:-------:|:-------:|:-------------:|
| View system settings | ❌ | ❌ | ✅ |
| Edit system settings | ❌ | ❌ | ✅ |
| Manage data backup and restore | ❌ | ❌ | ✅ |
| View import/export job status | ❌ | ❌ | ✅ |

---

## 4. Ownership Scoping Rules

The following "owner-scoped" rules apply to teacher-level permissions:

1. **Examination ownership:** A teacher may edit, configure, and grade only examinations they created or were explicitly assigned to as proctor.
2. **Question ownership:** A teacher may edit, publish, or archive only questions they created. Administrators can access all.
3. **Proctor scope:** A teacher on the live dashboard may only see participants of examinations they are assigned to as proctor.
4. **Result access:** A teacher may view and export results only for examinations within their assignment scope.

Administrators bypass all ownership scoping.

---

## 5. Enforcement Rules

- **All permissions are enforced on the server.** Hiding a menu item or disabling a button does not constitute security.
- Every API route and server action independently validates the session's role and ownership before executing domain logic.
- A student can never receive correct answers or grading configuration through any API response before authorized release.
- RBAC middleware runs before any domain handler is reached.
- Permission checks are unit-tested alongside domain logic.

---

## 6. Future Extensions (Post-MVP)

| Potential Role | Notes |
|---------------|-------|
| Department Head | Scoped administrator over one major |
| Exam Supervisor | Read-only proctor view without grading access |
| Data Entry Operator | Import-only access to academic structure |

These roles are not in MVP scope. The `permissions` and `role_permissions` tables are designed to accommodate them without schema migration.
