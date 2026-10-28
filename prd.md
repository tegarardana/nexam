# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## School CBT Platform

**Version:** 1.0  
**Status:** Draft for implementation planning  
**Product type:** Web-based Computer Based Test and Basic Academic Management System  
**Deployment:** Hybrid local network and internet  
**Initial scope:** Single school  
**Primary roles:** Student, Teacher, Administrator

---

# 1. Product Overview

## 1.1 Product Vision

Build a secure, reliable, and intuitive web-based Computer Based Test (CBT) platform for a school environment.

The platform enables students to take examinations, teachers to manage examinations and supervise students in real time, and administrators to manage users and academic structures across school years and semesters.

The application must combine a professional learning-platform interface inspired by modern educational technology products with a robust examination engine, configurable anti-cheat controls, reliable answer persistence, and proper academic data lifecycle management.

The product should be designed for actual school operations, not merely as a UI prototype.

## 1.2 Product Objectives

1. Centralize examination scheduling, delivery, supervision, grading, and reporting.
2. Provide different dashboards and permissions for students, teachers, and administrators.
3. Reduce manual work when creating users, organizing classes, and preparing new academic years.
4. Detect suspicious browser events and support configurable responses, including warnings and session blocking.
5. Preserve historical examination records when academic years and student placements change.
6. Support school-local access and authorized internet access through a secure deployment architecture.
7. Provide a modular foundation for future academic management features.

## 1.3 Target Users

### Students

Students use the platform to view schedules, prepare for examinations, take assigned tests, and review released results.

### Teachers

Teachers manage subjects, question banks, examination schedules, examination settings, live supervision, grading, and result publication.

### Administrators

Administrators manage users, academic years, semesters, departments or majors, classes, student placements, permissions, system settings, and all teacher-level capabilities.

## 1.4 Product Principles

- Usability first, without sacrificing security.
- Server-side enforcement for all critical examination rules.
- One authoritative database for academic and examination records.
- Historical data must remain accessible and consistent.
- Every sensitive administrative or examination action must be auditable.
- Avoid destructive data operations by default.
- Build functional modules incrementally and verify them before proceeding.
- Never represent a nonfunctional mockup as a completed feature.

---

# 2. Scope and Priorities

## 2.1 MVP Scope

The first production-ready version must include:

- Authentication and role-based authorization.
- Student, teacher, and administrator dashboards.
- Academic year and semester management.
- Major, class, class-group, subject, and student-placement management.
- Teacher assignments.
- Question bank and six required question types.
- Examination creation, configuration, scheduling, and publishing.
- Student examination interface.
- Server-controlled timers and autosaving.
- Submission handling and automatic grading for objective questions.
- Manual grading for essays.
- Live examination monitoring.
- Browser-event monitoring, warnings, configurable blocking, and supervised unlocking.
- Result management and publication.
- Import and export for essential operational data.
- Audit logs.
- Hybrid deployment documentation and backup procedures.

## 2.2 Post-MVP Features

These features should not block the first release:

- Advanced item analysis and psychometrics.
- Secure browser integration.
- Automated anomaly scoring.
- Parent or guardian portal.
- External student information system integration.
- Multi-school or multi-tenant support.
- Advanced analytics across multiple academic years.
- Dedicated mobile applications.

---

# 3. Authentication and Access Control

## 3.1 Login Screen

The login screen is the first page displayed to unauthenticated visitors.

### Layout

- Full viewport layout.
- Two-column composition on desktop.
- Left panel: technology-themed illustration inspired by Cisco Networking Academy's visual language.
- Right panel: login form.
- Use original product branding and original visual assets. Do not copy Cisco trademarks or reproduce its login screen exactly.
- Responsive single-column layout on small screens.

### Required Elements

- Product logo and name.
- Username or school account identifier.
- Password input.
- Show/hide password control.
- Remember username option, if appropriate.
- Login button.
- Inline validation and authentication error messages.
- Loading and disabled states.
- Accessible form labels and keyboard navigation.

### Authentication Rules

- Passwords must be securely hashed using a modern password-hashing algorithm.
- Never store or log plaintext passwords.
- Validate credentials on the server.
- Protect login endpoints against brute-force attempts.
- Apply secure session management and session expiration.
- Do not reveal whether a particular username exists in authentication error messages.
- Redirect authenticated users to their role-specific dashboard.
- Unauthenticated users cannot access protected routes.
- Users with disabled accounts cannot initiate new sessions.

Initial authentication may use school-managed accounts and passwords. Public self-registration is not part of the MVP.

## 3.2 Role-Based Access Control

Implement explicit server-enforced permissions.

### Student

May:

- View own profile and assigned academic information.
- View published schedules and assigned examinations.
- Start an eligible examination.
- Save and submit own answers.
- View own released results.
- View permitted examination history.
- Change own password.
- Receive examination and account notifications.

Must not:

- Create or edit examinations.
- Access other students' answers or grades.
- Access answer keys before authorized release.
- Modify examination timers, scores, or session states.
- Access administrative functions.

### Teacher

May:

- View assigned subjects, classes, and examinations.
- Create and manage questions.
- Create and schedule examinations.
- Assign eligible participants.
- Supervise examinations.
- View live student statuses and examination events.
- Apply permitted warning and blocking actions.
- Unlock blocked sessions when authorized.
- Grade essays.
- Review examination results.
- Publish results according to permissions.
- Export authorized reports.

Teacher permissions should be restricted by ownership, assignment, and examination scope where applicable.

### Administrator

May:

- Access all teacher-level functions.
- Create, import, edit, disable, and archive user accounts.
- Assign roles and authorized permissions.
- Manage academic years and semesters.
- Manage majors, classes, class groups, subjects, and student placements.
- Assign teachers to subjects and classes.
- Configure platform-wide settings.
- Manage data imports and exports.
- View audit logs.
- Manage backup and recovery procedures through authorized operational controls.

Administrators must not silently overwrite finalized results or erase historical examination records.

---

# 4. Application Navigation and Dashboards

## 4.1 Shared Design System

Use a consistent design system across all roles.

### Visual Direction

- Professional educational technology aesthetic.
- Navy and blue as primary brand colors.
- White or light-neutral backgrounds.
- Restrained use of green, amber, and red for meaningful status indicators.
- Modern sans-serif typography.
- Clear visual hierarchy and strong contrast.
- Consistent spacing, cards, tables, forms, badges, dialogs, and notifications.
- Subtle transitions only where they improve usability.

### Responsive Behavior

- Desktop: expanded sidebar and content area.
- Tablet: collapsible sidebar.
- Mobile: drawer navigation and responsive content.
- Examination interface: optimized for laptop and desktop, with graceful behavior on smaller screens.

Do not prioritize decorative effects over information density or usability.

## 4.2 Shared Dashboard Components

Each role-specific dashboard should include:

- Role-appropriate welcome banner.
- Current academic year and semester.
- Relevant summary cards.
- Upcoming activities.
- Recent notifications.
- Contextual quick actions.
- Empty, loading, and error states.

The greeting should use the authenticated user's display name and be configurable for school conventions.

## 4.3 Student Dashboard

Suggested components:

- Welcome banner.
- Upcoming examinations.
- Examinations currently available.
- Completed examinations.
- Released results.
- Recent examination history.
- Notifications and examination instructions.

Suggested navigation:

1. Dashboard
2. My Exams
3. Examination Schedule
4. Subjects
5. My Results
6. Examination History
7. Notifications
8. My Profile

Students must only see examinations assigned to them and results they are authorized to view.

## 4.4 Teacher Dashboard

Suggested components:

- Welcome banner.
- Upcoming examinations.
- Currently active supervised sessions.
- Examination completion summary.
- Pending essay grading.
- Recently published results.
- Recent examination incidents.

Suggested navigation:

1. Dashboard
2. Examinations
3. Examination Schedules
4. Live Monitoring
5. Question Bank
6. Subjects
7. Classes and Participants
8. Grading
9. Results and Reports
10. Notifications
11. My Profile

## 4.5 Administrator Dashboard

Suggested components:

- Welcome banner.
- Active academic year and semester.
- User account summary.
- Student, teacher, and class counts.
- Upcoming and active examinations.
- Recent administrative activity.
- Data import status.
- System health indicators where available.

Suggested navigation:

1. Dashboard
2. User Management
3. Academic Years and Semesters
4. Majors and Departments
5. Classes and Class Groups
6. Student Placements
7. Subject Management
8. Teacher Assignments
9. Examinations
10. Question Bank
11. Live Monitoring
12. Grading and Results
13. Reports
14. Audit Logs
15. System Settings

The administrator inherits teacher capabilities without duplicating unrelated UI implementations.

---

# 5. Academic Data Management

## 5.1 Academic Year

An academic year has:

- Unique identifier.
- Display name, such as 2026/2027.
- Start date.
- End date.
- Status: draft, active, or archived.
- Creation and modification metadata.

Rules:

- Only one academic year may be active for the school's primary academic context at a time.
- Activating a new academic year must not delete historical records.
- The system must validate date ranges and invalid transitions.
- Archived years remain available for authorized historical reporting.
- Year transitions require explicit administrator confirmation.

## 5.2 Semester

Each academic year contains semesters.

Required fields:

- Semester name: Ganjil or Genap.
- Academic year reference.
- Start and end dates.
- Status.
- Optional operational notes.

A semester is associated with an academic year and must not be treated as an independent year.

## 5.3 Majors and Departments

Support configurable school majors or departments.

Required fields:

- Name.
- Code.
- Description.
- Active or archived status.

Existing student records must retain their historical major or department association when organizational structures change.

## 5.4 Classes and Class Groups

Support class levels, classes, and class groups.

Examples:

- Level: Grade 10, Grade 11, Grade 12.
- Major: TJKT.
- Class group: XI TJKT 1.

A class group must be associated with the appropriate academic year and relevant major or department.

The system must support multiple groups for the same level and major.

## 5.5 Student Placement

Student identity and yearly placement must be separate concepts.

A student may have:

- A permanent user account.
- An active or inactive account status.
- One or more historical academic placements.
- Different class groups across academic years.
- A historical record of major or department changes.

When students advance to the next grade, administrators must be able to update placements in bulk.

Graduation and account deactivation must preserve examination history.

## 5.6 Subject Management

Subjects are reusable master data.

Required fields:

- Subject name.
- Subject code.
- Description.
- Optional subject category.
- Active or archived status.

Subjects must not be deleted merely because a new academic year starts.

Subject offerings or assignments should connect a subject to the appropriate academic year, semester, class group, and teacher when necessary.

## 5.7 Teacher Assignments

Support teacher assignments to:

- Subjects.
- Class groups.
- Academic years.
- Semesters where applicable.

Teachers should only manage the classes and examinations authorized by their assignments, unless explicitly granted broader permissions.

## 5.8 New Academic Year Wizard

Provide an administrator workflow:

1. Create the new academic year.
2. Configure semesters.
3. Prepare class groups.
4. Import new students or promote existing students.
5. Assign students to class groups.
6. Assign teachers and subjects.
7. Validate missing or conflicting records.
8. Preview changes.
9. Confirm and activate the academic year.

The wizard must display a summary before applying bulk changes.

Never automatically delete users, subjects, classes, results, or examination attempts as part of this workflow.

---

# 6. User Management

## 6.1 Account Management

Administrators can:

- Create individual accounts.
- Import accounts in bulk.
- Edit permitted profile information.
- Assign roles.
- Activate or deactivate accounts.
- Reset passwords through a secure process.
- Review account status.
- Review relevant account audit history.

Required user fields:

- Internal user ID.
- Username or account identifier.
- Display name.
- Role.
- Account status.
- Optional email or school contact information.
- Creation timestamp.
- Last login timestamp, where available.

Academic placement data must not be embedded exclusively in the user record.

## 6.2 Bulk Import

Support a documented CSV or XLSX import template.

Import workflow:

1. Upload file.
2. Validate columns and data.
3. Show preview.
4. Report duplicates and invalid rows.
5. Allow permitted corrections.
6. Confirm import.
7. Display import summary.

Import operations must be transactional where practical and must not partially create inconsistent academic relationships.

Never export plaintext passwords.

---

# 7. Question Bank and Question Types

## 7.1 Question Bank

Teachers and administrators with appropriate permissions can create, edit, organize, and reuse questions.

Each question should support:

- Internal question ID.
- Question type.
- Question content.
- Optional images or other supported media.
- Subject association.
- Topic or category.
- Difficulty label.
- Draft or published status.
- Creator and modification metadata.
- Optional explanation or feedback.
- Answer key and grading configuration.

Question revisions must not silently change the content of an already published or attempted examination.

When necessary, preserve a versioned snapshot of the question and its grading configuration within the examination.

## 7.2 Supported Question Types

### A. Single-Answer Multiple Choice

- Question text.
- Multiple answer options.
- Exactly one correct answer.
- Configurable option order.
- Automatic grading.

### B. Multiple-Select

- Multiple answer options.
- One or more correct options.
- Explicit instruction to select all applicable answers.
- Configurable grading method.
- Automatic grading.

For MVP, use a clearly documented grading method. Default to all-or-nothing scoring unless the examination creator explicitly selects an approved alternative.

### C. True or False

- Question statement.
- True and false options.
- One correct answer.
- Automatic grading.

### D. Short Answer

- Text input.
- Configurable accepted answer or answers.
- Configurable case sensitivity.
- Optional trimming and normalization of whitespace.
- Automatic grading only where the configured comparison is unambiguous.

Questions requiring nuanced interpretation must be sent for manual review rather than incorrectly graded automatically.

### E. Essay

- Rich-text or multiline answer input.
- Configurable maximum score.
- Manual grading.
- Teacher feedback.
- Grading status.
- Optional rubric.

### F. Image-Based Questions

- Images embedded in question content or answer options.
- Support appropriate image formats.
- Image preview and responsive scaling.
- Accessible alternative text where appropriate.
- Upload validation and file-size limits.

Image-based content should be compatible with supported question types rather than implemented as a mutually exclusive grading type.

## 7.3 Question Validation

Before publishing an examination, validate:

- Required question content.
- Minimum answer-option requirements.
- Valid answer keys.
- Valid maximum scores.
- Required images and media availability.
- Consistent scoring configuration.
- Valid question references.

Display actionable validation errors rather than allowing invalid questions to enter a live examination.

---

# 8. Examination Management

## 8.1 Examination Creation

Teachers create examinations through a guided workflow.

Required configuration:

- Examination title.
- Instructions.
- Subject.
- Academic year and semester.
- Eligible class groups or participants.
- Start date and time.
- End date and time or availability window.
- Duration.
- Question selection.
- Maximum score.
- Randomization settings.
- Attempt policy.
- Result publication policy.
- Anti-cheat policy.
- Optional examination password or access restrictions.

Use the server's authoritative time for eligibility, timers, and deadlines.

## 8.2 Examination Lifecycle

Supported states:

1. Draft.
2. Ready for publication.
3. Scheduled.
4. In progress.
5. Closed.
6. Grading, when applicable.
7. Finalized.

The system must define valid transitions between states.

An examination must not be editable in ways that silently change questions or grading rules for students who have already started.

Material changes to a published examination should require an explicit authorized workflow and an audit entry.

## 8.3 Scheduling

Support:

- Scheduled start and end times.
- Examination duration.
- Class-specific participant assignments.
- Teacher and supervisor assignments.
- Examination availability status.
- Overlap warnings where scheduling data permits detection.

An examination should not automatically become available merely because its page is visible.

The server must validate participant eligibility and timing when the student attempts to start.

## 8.4 Examination Randomization

Allow teachers to configure:

- Random question order.
- Random answer-option order.
- Optional question pools for selecting a specified number of questions.

For randomized examinations, the selected questions and ordering must remain stable for that attempt.

## 8.5 Attempt Rules

Support configurable:

- Maximum number of attempts.
- Whether an attempt can resume after disconnection.
- Whether a submitted attempt can be reopened.
- Handling of incomplete attempts at the deadline.
- Manual intervention by authorized teachers or administrators.

Every attempt must have a unique identifier and a clear status.

---

# 9. Student Examination Experience

## 9.1 Pre-Exam Screen

Before starting, display:

- Examination title.
- Subject.
- Scheduled time and duration.
- Number of questions.
- Examination instructions.
- Anti-cheat rules.
- Available attempt information.
- Connection or readiness status where available.
- Start button.

Students must explicitly acknowledge the examination instructions before starting.

## 9.2 Examination Interface

Design the examination page for concentration.

Required components:

- Examination title.
- Remaining time.
- Current question and total question count.
- Question content and media.
- Answer input.
- Previous and next navigation.
- Question navigation grid.
- Answered and unanswered indicators.
- Save status.
- Submit button.
- Confirmation dialog before final submission.

Avoid unrelated dashboard navigation while an examination is active.

## 9.3 Timer

- The server defines the official start time and deadline.
- The client displays a synchronized countdown.
- Refreshing the page must not reset the examination duration.
- Changing the local device clock must not extend the examination.
- At the deadline, the server must stop accepting late answers according to the configured policy.
- The system must clearly communicate when time is almost over.

## 9.4 Autosave

- Save answers automatically as students answer or navigate.
- Show saving, saved, and save-error states.
- Associate each answer with the correct attempt and question.
- Prevent stale updates from overwriting newer answers.
- Recover saved answers after a permitted refresh or reconnection.
- Apply server-side validation to all answer writes.

Autosave must be idempotent where possible and resilient to temporary network failures.

The system must not show a successful save indicator before receiving confirmation from the server.

## 9.5 Submission

When the student submits:

1. Validate the attempt state.
2. Persist the latest accepted answers.
3. Finalize the attempt according to examination policy.
4. Calculate objective scores.
5. Mark essays as pending grading where applicable.
6. Record the submission timestamp.
7. Display a submission confirmation.

Prevent duplicate submissions from creating duplicate attempts or corrupting scores.

## 9.6 Disconnection and Recovery

When connectivity is interrupted:

- Preserve the last confirmed saved answers.
- Display a connection warning.
- Retry permitted save operations safely.
- Revalidate the attempt with the server after reconnection.
- Resume only if the examination policy and server-side attempt state allow it.
- Never assume that a disconnected student is cheating.
- Never reset the timer simply because the browser reconnects.

Offline answer queues, if implemented, must reconcile with server-side deadlines and attempt state before being accepted.

---

# 10. Anti-Cheat and Live Proctoring

## 10.1 Objective

Provide configurable browser-event monitoring and examination-session enforcement while acknowledging the limitations of ordinary web browsers.

The system identifies observable events and records them as potential policy violations. Browser events alone are not definitive proof of academic misconduct.

## 10.2 Detectable Events

Where supported by the browser, monitor:

- Page visibility changes.
- Window losing focus.
- Attempts to leave fullscreen.
- Fullscreen exit events.
- Unexpected page unload or navigation attempts.
- Network disconnection.
- Missing or delayed session heartbeats.
- Repeated session conflicts.
- Relevant changes in examination-session state.

Do not claim to detect all operating-system activity, all applications, secondary devices, or all forms of external assistance.

## 10.3 Configurable Anti-Cheat Policies

Each examination must have an explicit policy.

Recommended options:

- **Practice mode:** record relevant events without automatic blocking.
- **Standard mode:** issue a warning before blocking.
- **Strict mode:** block after the configured violation threshold.
- **Custom mode:** allow authorized configuration of supported event rules.

For the initial default policy:

1. Record the first qualifying focus or visibility event.
2. Display a clear warning to the student.
3. Record subsequent qualifying events.
4. Block the session when the configured threshold is reached.
5. Notify the assigned proctor.
6. Require authorized intervention to resume, where policy demands it.

Use configurable thresholds rather than hardcoding the same behavior for every event.

## 10.4 Event Records

Each recorded event should contain:

- Event ID.
- Examination ID.
- Attempt ID.
- Student ID.
- Event type.
- Server-received timestamp.
- Relevant event metadata.
- Policy applied.
- Resulting session status.
- Review status.
- Authorized intervention details, if any.

Client timestamps may be retained for diagnostic purposes but must not be treated as authoritative server timestamps.

## 10.5 Student Warning Screen

The warning screen must:

- Explain what event was detected.
- State the applicable examination rule.
- Display the number of recorded incidents when appropriate.
- Clearly communicate whether the student can continue.
- Avoid unnecessarily accusatory language.
- Provide the permitted recovery or contact instructions.

## 10.6 Live Proctor Dashboard

Teachers must be able to see:

- Assigned examinations.
- Participant list.
- Current attempt status.
- Connection status.
- Time remaining.
- Answer progress where permitted.
- Unreviewed incident count.
- Blocked sessions.
- Submitted and incomplete attempts.

Suggested status labels:

- Not Started.
- Ready.
- In Progress.
- Warning.
- Blocked.
- Disconnected.
- Submitted.
- Grading Pending.
- Completed.

Statuses must be based on actual server-side records, not static frontend demonstrations.

## 10.7 Proctor Actions

Authorized teachers can:

- Inspect a student's examination status.
- Review relevant event history.
- Issue a documented manual warning.
- Block a session where permitted.
- Unlock a blocked session.
- Resume an eligible attempt.
- Record an intervention note.
- Escalate an incident to an administrator.

Unlocking must require confirmation and create an audit record.

The server must authorize each action and verify that the teacher is assigned to the examination or otherwise has permission.

## 10.8 Session Enforcement

The backend must be the source of truth for whether an attempt is allowed to proceed.

When an attempt is blocked:

- Reject prohibited answer modifications.
- Reject attempts to start a duplicate session.
- Prevent a modified frontend from unblocking the attempt.
- Preserve accepted answers.
- Require an authorized server-side transition to resume.

A warning or blocking event must never silently erase answers.

## 10.9 Limitations

Ordinary browser-based controls cannot guarantee that students will not use another device or circumvent browser restrictions.

The product must describe this feature as browser-event monitoring and policy enforcement, not as a guarantee of cheating prevention.

Secure-browser integration is a potential future enhancement.

---

# 11. Grading and Result Management

## 11.1 Automatic Grading

Automatically grade supported objective questions using the question's versioned grading configuration.

The system must:

- Apply the correct answer key.
- Respect configured point values.
- Avoid double-counting scores.
- Support explicit partial-credit policies where enabled.
- Recalculate scores deterministically when authorized.
- Record relevant grading changes.

## 11.2 Manual Grading

Teachers can grade essay questions.

Required features:

- Answer review.
- Maximum score.
- Score input.
- Optional rubric.
- Teacher feedback.
- Save draft grading.
- Finalize grading.
- Review status.

Only authorized teachers and administrators can grade or modify results.

## 11.3 Result Publication

Each examination must define its result-release policy.

Supported policies:

- Release automatically after completion, if permitted.
- Release manually by an authorized teacher.
- Release after all required grading is finalized.

A student must not see an unfinished total score as a finalized result unless the interface explicitly labels it as provisional.

## 11.4 Result Reports

Provide:

- Student-level result.
- Examination-level participant summary.
- Score and completion status.
- Pending grading count.
- Class-level score distribution.
- CSV or XLSX export.

Apply authorization and privacy rules to all reports and exports.

## 11.5 Result Integrity

Finalized scores must not be silently overwritten.

Changes to finalized results must require explicit authorization, a reason, and an audit record containing the previous and new values.

---

# 12. Notifications and Audit Logs

## 12.1 Notifications

Support in-app notifications for:

- New examination schedules.
- Schedule changes.
- Examination availability.
- Examination warnings and blocking events.
- Result publication.
- Essay grading completion where relevant.
- Administrative announcements.

External messaging integrations are outside the initial MVP unless explicitly approved.

## 12.2 Audit Logs

Record security-sensitive and academically significant actions.

Examples:

- Account creation and role changes.
- Password resets initiated by administrators.
- Academic year activation.
- Student placement changes.
- Examination creation and publication.
- Question or grading configuration changes.
- Examination blocking and unlocking.
- Manual submission or reopening.
- Result finalization and modification.
- Data import and export.
- Relevant configuration changes.

Audit entries should include the actor, action, affected entity, timestamp, and relevant before/after metadata where appropriate.

Audit logs must not contain plaintext passwords, authentication tokens, or unnecessary sensitive information.

Authorized administrators can search and filter audit records.

---

# 13. Data Model Requirements

Use a relational database with explicit relationships, foreign keys, appropriate indexes, and transaction handling.

Recommended core entities:

## Identity and Permissions

- users
- roles
- permissions
- role_permissions
- user_roles, if multiple roles per account are supported
- user_sessions

## Academic Structure

- academic_years
- semesters
- majors
- class_groups
- student_enrollments
- subjects
- subject_offerings
- teacher_assignments

## Question Bank

- questions
- question_versions
- question_options
- question_media
- question_categories

## Examination

- examinations
- examination_questions
- examination_participants
- examination_attempts
- examination_answers
- examination_events
- examination_policy_settings
- examination_proctor_assignments

## Grading and Reporting

- grading_records
- examination_results, if maintained separately from attempts
- result_publications
- grading_rubrics, where applicable

## Platform Operations

- notifications
- audit_logs
- import_jobs
- system_settings

The final schema may differ if a simpler structure satisfies all requirements, but these concepts and their integrity constraints must be preserved.

### Data Integrity Rules

- Every examination belongs to an appropriate academic context.
- Every attempt belongs to one student and one examination.
- Student participation must be validated against enrollment or explicit participant assignment.
- Answers must reference valid questions in the attempt's examination snapshot.
- Scores must be derived from validated grading data.
- Historical results must remain connected to their original examination and academic context.
- Soft deletion or archival should be used where historical references must survive.
- Critical multi-step operations must use database transactions.

Do not store multiple independent copies of the same authoritative value without a defined consistency strategy.

---

# 14. Hybrid Deployment Architecture

## 14.1 Architecture Principle

Use one application deployment with one authoritative database.

The application should support access from the school's local network and authorized internet users without creating separate, conflicting examination databases.

Preferred initial topology:

- Browser clients.
- HTTPS application entry point.
- Application backend.
- PostgreSQL database.
- Private media and file storage.
- Backup destination.
- Optional reverse proxy or secure remote-access gateway.

## 14.2 Local Access

When deployed on the school network, clients can access the application using the approved local DNS name or private IP address.

Local access must not bypass authentication, authorization, session checks, or examination rules.

The application must support a documented local access URL.

## 14.3 Internet Access

Remote access must be explicitly configured.

Preferred options include:

- A properly secured public HTTPS endpoint.
- A VPN or secure remote-access gateway.
- A carefully configured reverse proxy or tunnel where appropriate.

Do not expose the database directly to the internet.

Do not assume a local server is remotely reachable without addressing firewall rules, ISP restrictions, DNS, TLS, and connectivity.

## 14.4 Single Source of Truth

The system must not independently accept examination answers into two uncoordinated databases.

If offline or disconnected operation is required, its synchronization and conflict-resolution behavior must be separately specified and tested.

The MVP may preserve the last confirmed saved answers during connectivity loss without claiming complete offline examination support.

## 14.5 Deployment and Operations

Provide:

- Environment-variable-based configuration.
- Docker Compose deployment where suitable.
- Documented database migrations.
- HTTPS configuration instructions.
- Health checks.
- Structured application logging.
- Database backup and restore procedures.
- Upgrade and rollback procedures.
- Separate development and production configurations.

Never commit real credentials, production secrets, or student data into source control.

---

# 15. Security and Privacy Requirements

The application must implement:

- Server-side authentication and authorization.
- Secure session cookies and session expiration.
- CSRF protections where applicable.
- Output encoding and input validation.
- Protection against SQL injection and unauthorized data access.
- Secure upload validation.
- Rate limiting for sensitive endpoints.
- Safe error messages.
- Appropriate access control for examination answers and results.
- Audit logging for critical operations.
- Backup access restrictions.
- Secrets management through environment configuration.
- HTTPS for internet access.
- Database migration and recovery procedures.

Students must never receive correct answers or sensitive grading configuration through client responses before authorized release.

All server endpoints must independently validate permissions and examination state. Hiding a menu or disabling a button is not sufficient security.

Collect only the data necessary to operate the platform. Establish suitable access, retention, and archival rules for student information and examination records.

---

# 16. Non-Functional Requirements

## Reliability

- Avoid losing confirmed saved answers during normal navigation or refresh.
- Prevent duplicate attempts and duplicate submissions.
- Recover gracefully from temporary network interruptions.
- Preserve historical records during routine administrative changes.

## Performance

Initial performance targets, subject to validation against the actual deployment hardware:

- Typical dashboard responses: under 2 seconds at the 95th percentile under the agreed test load.
- Typical examination answer-save responses: under 1 second at the 95th percentile under the agreed test load.
- Support a configurable target of 200 concurrent examination sessions for initial load testing.

These are engineering targets, not guaranteed performance claims. Actual limits must be verified through load testing.

## Accessibility

- Clear labels and readable typography.
- Keyboard-accessible navigation.
- Visible focus indicators.
- Sufficient color contrast.
- Status information that does not rely on color alone.
- Responsive forms and error messages.

## Maintainability

- Modular application architecture.
- Typed interfaces and shared validation schemas where supported.
- Consistent naming and coding conventions.
- Database migrations.
- Automated tests for critical logic.
- Documented setup and deployment procedures.

---

# 17. Testing and Acceptance Criteria

The MVP is not complete until the following scenarios pass.

## Authentication and Permissions

- A valid student can log in and reach the student dashboard.
- A teacher cannot access unauthorized administrative endpoints.
- A student cannot access another student's attempt or result.
- An unauthenticated user cannot access protected pages.
- Disabled accounts cannot start new examination sessions.

## Academic Management

- An administrator can create an academic year and its semesters.
- Students can be assigned to class groups.
- A student can move to a new class group without losing historical results.
- Creating a new academic year does not delete previous records.
- Subjects can be reused across academic years.

## Examination Creation

- A teacher can create and publish a valid examination.
- Invalid question configurations are rejected with actionable messages.
- Only eligible students can start the examination.
- Randomized question order remains stable within an attempt.
- Unauthorized users cannot change published examination configuration.

## Examination Delivery

- All six required question types can be rendered and answered.
- The timer continues according to server-side time.
- Refreshing does not reset the timer or discard confirmed answers.
- Autosave failures are visible to the student.
- A valid submission is recorded exactly once.
- Expired or blocked attempts cannot submit unauthorized answer changes.

## Anti-Cheat and Proctoring

- Supported visibility and focus events are recorded.
- A configured first violation can display a warning.
- Reaching the configured threshold blocks the session when applicable.
- The assigned teacher can view the event history.
- Unauthorized users cannot unblock a session.
- Unlocking requires authorization and creates an audit entry.
- Network disconnection alone does not automatically constitute cheating.
- The student's accepted answers remain preserved during blocking and recovery.

## Grading and Results

- Objective questions are graded according to their configured answer keys.
- Essay questions can be graded manually.
- Result release follows the examination policy.
- Finalized score changes are authorized and audited.
- Students cannot access unpublished results or answer keys.

## Deployment and Recovery

- The application can be accessed through the approved local endpoint.
- Authorized internet access works through the configured secure entry point.
- The database is not publicly exposed.
- A database backup can be restored using documented procedures.
- A production deployment can be configured without committing secrets.

---

# 18. Implementation Plan

## Phase 0: Foundation

- Inspect the repository and existing project files.
- Confirm the application framework and database.
- Define architecture and module boundaries.
- Create design tokens and reusable UI components.
- Define environment configuration.
- Create the initial database schema and migrations.
- Document unresolved architectural decisions.

## Phase 1: Authentication and Academic Management

- Login and session management.
- Role-based access control.
- Role-specific dashboard shells.
- User management.
- Academic years and semesters.
- Majors, class groups, subjects, and assignments.
- Student enrollment and bulk import.

## Phase 2: Question Bank and Examination Configuration

- Question CRUD.
- Six required question types.
- Media upload.
- Question validation.
- Examination creation and scheduling.
- Participant assignment.
- Publication and examination state transitions.

## Phase 3: Examination Engine

- Student examination interface.
- Server-controlled timer.
- Answer persistence and autosave.
- Attempt management.
- Submission and automatic grading.
- Essay grading workflow.
- Result publication.

## Phase 4: Anti-Cheat and Live Proctoring

- Browser-event monitoring.
- Configurable violation policy.
- Warning and blocking flow.
- Live participant status.
- Teacher intervention and unlocking.
- Examination event history and audit logging.

## Phase 5: Reporting, Deployment, and Hardening

- Reports and exports.
- Audit log interface.
- Performance and security testing.
- Backup and recovery validation.
- LAN and internet deployment.
- Documentation and production acceptance testing.

Each phase must deliver working, tested functionality before the next phase expands the scope.

---

# 19. Out of Scope for MVP

Unless explicitly approved, do not implement:

- Multi-tenant school management.
- Public student registration.
- Parent or guardian accounts.
- Native mobile applications.
- AI-based cheating detection.
- Webcam recording or biometric monitoring.
- Guaranteed offline examination synchronization.
- Automated essay grading using AI.
- Complex school finance or attendance modules.
- Unrequested third-party integrations.

Do not introduce additional modules simply because they appear useful. Record them as future enhancements instead.

---

# 20. Definition of Done

A feature is considered complete only when:

1. The required UI is implemented.
2. The feature is connected to actual backend logic.
3. Authentication and permissions are enforced.
4. Data is persisted correctly.
5. Loading, empty, validation, and error states are handled.
6. Relevant automated tests pass.
7. Critical edge cases are verified.
8. The feature is documented where appropriate.
9. No known critical security or data-integrity defect remains.
10. The implementation does not falsely claim support for behavior the browser or deployment cannot guarantee.

---

# 21. Final Product Direction

The School CBT Platform should become a dependable examination system that school staff can operate without requiring technical intervention for routine tasks.

The first release prioritizes reliable examinations, practical academic administration, usable dashboards, and transparent supervision.

Future expansion should be based on actual school needs and validated operational experience.

**Primary success criterion:** students can take assigned examinations reliably, teachers can supervise and evaluate them effectively, and administrators can manage academic transitions without losing historical data or compromising examination integrity.