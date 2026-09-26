# SPEC-003 — Google-only student registration and manual approval (DRAFT)

**Date:** 2026-09-25  
**Owner:** Nack  
**Status:** Reviewable product draft; not an implementation authorization. It proposes a change to `SPEC-002-live-classroom-release.md`, whose school-email assumption has not yet been reconciled. Gate 0 local auth spike passed on 2026-09-26 (`REVIEW-006F1-gate0.md`); school approval for processing/hosting real student data, account-designation pilot, enrollment authorization/RLS, and release readiness remain separate gates.

## Purpose and confirmed decisions

For a first live class, roughly 40 students sign in with Google and request membership while Nack teaches them to use the site. Nack has a separate roster and manually checks and approves each request. The broader target is about five classes / 200 students.

- Any Google account may **request** student registration; `@rpr.ac.th` is not required. Google is the only intended sign-in/sign-up provider. Google identity alone never grants restricted course access.
- A new ordinary account has nominal student role but **pending** membership until Nack approves it. Teacher/admin privileges are administrator-assigned only; no self-selection.
- A five-digit student identifier is unique across the system for all years, including leading zeros and a no-reuse policy after an approved student becomes inactive. Pending claims do not reserve an identifier against its rightful owner.
- First release uses one-by-one approval against Nack's existing roster. No roster upload, bulk approval, or automatic roster match is required.

## Candidate journeys and observable acceptance criteria

1. **First Google sign-in.** An unrecognized Google identity lands on onboarding, not in a protected course. A returning pending applicant sees their own request status, not the form as a new independent account. Signed-out visitors cannot view student profiles or restricted course material. Session reload and sign-out still obey the Gate 0 auth contract.
2. **Student request form.** Applicant selects title (นาย/นาง/นางสาว/ด.ช./ด.ญ.), enters Thai given and family names and an exactly five-digit identifier (stored as text), selects one active class created by Nack (display label such as `ม.2/3`), and selects roll number 1–45. Validate on the server as well as in the UI. Missing or malformed fields cannot submit. The applicant can view only their own submitted fields and a pending status; the application does not disclose whether another person owns a claimed identifier.
3. **Private approval queue.** Nack, using an explicitly authorized account, filters pending requests by class and reviews the submitted name, identifier, class and roll number against his roster **outside this chat and repository**. A manual Approve action binds the verified Google-authenticated app identity to the approved student record and class/enrollment. Only then may the student read published articles for offerings to which the approved class is enrolled. No approval is implied by the student-entered data, a matching email domain, or a role label.
4. **Conflict and error states.** Two pending requests may claim the same five-digit identifier for review. At most one can become an approved owner of it across all years; an approval collision or mismatched claim must not transfer or overwrite the existing student record or reveal another student's details to applicants. Failed approval remains visible to the administrator with a safe, actionable status. Retries must not create duplicate approvals or enrollments. Pending/denied/suspended identities cannot fetch restricted articles, private images, submissions or grades by direct URL/API.
5. **Privileged identities.** A student cannot edit their own role or approval state via UI, API, metadata or database access. Only an authorized administrator can grant teacher/admin privileges to a verified Google identity; the initial administrator must be established through a separately reviewed bootstrap process before opening registration.
6. **Class lifecycle.** Applicants choose only currently active classes. Store the class as a stable record rather than trusting the display label; retain academic-year context so transfers and later class changes do not rewrite historical enrollment. A roll number is a class/year attribute, not an account identifier. Its uniqueness/edit rules remain open below.

## Access matrix (candidate)

- Visitor: no restricted course data; may initiate Google sign-in.
- Google-authenticated applicant without approved enrollment: own request/status only; no restricted course article, private media or privileged action.
- Approved student: own profile and enrolled offerings' published content only; no other student's profile or course.
- Teacher: only explicitly granted authoring/class review permissions (exact scope pending).
- Admin: approval/role/class-management functions; role grants and approvals must be auditable. Never derive this privilege from student-supplied fields.

## Non-goals for this slice

No email/password login, automatic enrollment from a guessed ID, school-domain filtering as authorization, roster OCR/import, bulk approval, open public student directory, self-service teacher/admin promotion, attendance, grading or submissions. Do not use real roster/student data in chat, Git or synthetic test fixtures.

## Open owner decisions before implementation tickets

1. For a mismatched or duplicate claim, should Nack mark **Needs correction** and allow the student to edit/re-submit, or reject it and require a new request? Who may correct an *approved* record?
2. Should roll number be unique within **class + academic year**, and may Nack edit it when students move? What happens if two students choose the same number while both requests are pending?
3. How will the first administrator be bootstrapped, and can a teacher approve students or only the admin/Nack?
4. What is the school-approved basis/channel for processing the real roster and externally hosted student profile data? What retention/removal rule applies when a student leaves, while the no-reuse identifier reservation persists?
5. Reconcile this Google-account-open request policy with SPEC-002's school-account pilot: personal and an authorized school-managed Google account worked in the Gate 0 owner pilot, but the tested school account was not established as student-designated. A student-designated account may face different Workspace restrictions; test before full-class rollout.

**Next gate:** Nack reviews the open decisions and access matrix, then revise SPEC-002/TICKETS-002 and split one small onboarding ticket with fictitious identities. Gate 0 auth is complete for its agreed scope; do not use real student records until separate school data-processing approval and access/privacy gates are resolved.
