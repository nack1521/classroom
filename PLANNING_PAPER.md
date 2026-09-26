# Classroom — AI-Native SDLC Learning Plan

> **Status:** Active  
> **Started:** 2026-09-24  
> **Owner:** Nack  
> **Workspace:** `/Users/nack/Classroom`

## 1. Purpose

Build a personal learning-and-teaching web application while deliberately learning how to work as a developer with AI.

This is not initially a full LMS. It is a controlled learning project where every meaningful feature becomes practice in:

- product discovery and requirements
- software design and UI/UX
- implementation and testing
- independent review and verification
- Git, pull requests, deployment, and iteration
- agent harnesses, skills, subagents, and measured AI workflows

## 2. Personal Outcome

By the end of this project, I should be able to explain and demonstrate:

1. How I turn a real user problem into a testable specification.
2. How I split a feature into small, independently verifiable tickets.
3. How I use AI as a collaborator without handing it unchecked authority.
4. How I use tests, review, and evidence to decide whether work is complete.
5. How I design, build, and deploy a web application that I can show in a developer portfolio.

## 3. Product Direction

### Discovery update — 2026-09-24

- Nack has not prepared lesson content yet. The first concrete reference is the public-post reading experience at `https://mikelopster.dev`, not a commitment to copy its full product.
- The product should serve two contexts: a private authoring space for the teacher and a public reading space for learners.
- Canva is sometimes used for teaching materials; how to include those materials (link, embed, export, or upload) remains undecided.
- The desired destination is an integrated teaching website, but the scope and order of capabilities need discovery before any MVP is approved.
- **Working candidate flow, not yet approved:** teacher drafts a post, previews it, publishes it, then a learner opens and reads it.
- **Open questions:** Which specific post features are essential (formatting, table of contents, tags, media, search, comments, etc.)? What does “easy to create” mean in concrete editing steps? Must drafts remain private? What should Canva support look like? Is learner login required for reading?
- **Next discovery step:** identify must-have reading/authoring behaviors and rank them; do not choose the stack or start implementation yet.

### Discovery update — authoring, reading, and courses (2026-09-24)

- **Reference image:** the university class page shows published course cards, each with a course code/title and section/semester metadata. Treat it as a reference for course navigation, not as a requirement to copy the visual design or all LMS functions.
- **Teacher-side expectation:** a button-driven rich-text editor, similar in ease to a document editor. Desired content includes text formatting, code blocks, diagrams/images, and links. Canva materials may also be linked or embedded, subject to a later decision.
- **Learner-side expectation:** a readable article experience organized under subjects/courses. Nack wants learners to log in because the same site should later support assignment submission and grade tracking.
- **Design recommendation to validate:** prefer consistent semantic styles (headings, body, callouts, lists) with bold/underline over arbitrary font families and sizes per span; a course can contain posts without every post needing complex formatting.
- **Security distinction:** login establishes identity; membership/authorization determines which courses, posts, submissions, and grades an account can access. The exact access rule is still open.
- **Candidate first slice, pending approval:** teacher creates/edits a formatted draft (headings, emphasis, link, image, code block), publishes it to one course, and an authorized signed-in learner reads it. Native diagram editing, Canva embed, assignments, grading, and broad Word-style typography remain to be prioritized.
- **Decision required:** Are course posts visible to any signed-in student or only enrolled students? Are courses/posts ever public? What minimum editor blocks must ship first? How will student accounts be created?

### Discovery update — roster onboarding and public posts (2026-09-24)

- **Approved product direction:** use a constrained, button-driven rich-text editor with consistent heading/body styles rather than unrestricted Word-style font controls. Diagrams are created externally and inserted as images; no native diagram editor.
- **Approved product direction:** support public articles as well as restricted course articles, but the exact publication controls and first-release scope are not yet approved.
- **Proposed model, pending validation:** a class/group contains students; a subject is a reusable subject definition; a course offering links a subject to a class/group and term/year; enrollment links each student to the relevant offering. A student account is separate from the student's school record and may be activated later.
- **Proposed onboarding:** teacher supplies a school-authorized roster through an approved protected channel; OCR/transcription produces a reviewable import preview, the teacher corrects names/identifiers, then confirms creation/enrollment. Importing a roster is not the same as setting login credentials. Do not send real student rosters, IDs, or initial passwords to the project chat while the school's authorization, legal basis, and secure handling are unresolved; use fictitious test data for planning.
- **Proposed publication scopes:** `public` (any visitor), `course` (only enrolled learner / authorized teacher), and `draft` (teacher only). An optional `all signed-in users` scope requires a separate decision. Never publish student identities, submissions, or grades in a public article.
- **Open governance questions:** Does the school authorize use of student records in this independently developed site and with AI-assisted import? What data fields are truly necessary? How are accounts activated, errors corrected, records retained/deleted, and access removed when a student changes class or term?

### Discovery — Google-only student onboarding (2026-09-25; partial decisions approved)

- **Nack's proposed change:** Keep Google as the only sign-in/sign-up method, but do not require `@rpr.ac.th`. A newly arriving account starts as a student; only an administrator may grant teacher/admin privileges. On first sign-in, collect a title (นาย/นาง/นางสาว/ด.ช./ด.ญ.), Thai given/family names, a unique five-digit student identifier, a teacher-created class selected from a list, and a class number selected from 1–45. The detailed form, schema and real-data handling still require a reviewed spec.
- **Approved decisions (2026-09-25):** Any Google account may request student registration, but access remains pending Nack's approval; no automatic course enrollment from claimed fields. The five-digit student identifier must be unique across the system **for all time**, not reset per academic year. Preserve leading zeros and define an explicit policy for correction, deletion, alumni and never-reuse before implementation.
- **Recommended distinction for review:** Google authentication, student profile completion, teacher-approved enrollment, and teacher/admin role assignment are separate steps. Self-entered name, ID, class and class number must not by themselves authorize access to restricted course content; an unknown Google account should remain pending until matched/approved. A pending ID claim must not reserve the identifier against its rightful owner: record duplicate claims for private administrator review, then enforce lifetime uniqueness on approved student records and retain an explicit retired-ID reservation after deactivation if the no-reuse rule is literal. Privileged roles require an administrator-controlled assignment and a bootstrap owner, not self-service registration.
- **Roster available (Nack confirmed 2026-09-25):** Nack has a student roster for manual comparison of submitted name, five-digit ID, class and class number before approval. This confirms the existence of a review source, not permission to upload it to this chat, a repository, AI tools or the app; protected intake and school authorization remain release gates. Use fictitious records in the spec/tests.
- **Approved review workflow (Nack confirmed 2026-09-25):** Nack will teach and onboard one class at a time (~40 students) and manually compare/approve requests one by one. No roster upload, bulk approval, or auto-match is required for the first release.
- **Open product decisions:** What happens for mismatch/duplicate claims? May the student edit after submitting, or must an administrator correct, transfer, suspend and archive records? Is class number unique within a class and school year? Who may see the fields? How does the first admin bootstrap? Does school authorization cover collection/hosting of real student profiles and Google account use?
- **Gate impact (updated 2026-09-26):** This onboarding direction revises the prior school-email assumption and requires an update to the live-release spec/tickets before implementation. Gate 0 auth spike passed in the agreed local scope (`docs/REVIEW-006F1-gate0.md`) with an owner-reported school-managed OAuth pilot; a student-designated account pilot, course authorization/RLS, school approval for real student data processing/hosting, and release readiness remain separate gates.
- **OAuth pilot readiness (Nack reported 2026-09-26):** Nack has a personal Google account and a school Google account for testing. The teacher responsible for the school's Google accounts has authorized use of the school account for this project test; Nack has described the project to the teacher, who expressed interest. This is evidence of permission to attempt the account pilot, **not** blanket permission to collect/host student records or proof that a student-designated account can sign in. Do not put credentials/tokens in chat or repo; record only outcomes.

### Primary product

A personal workspace for learning and teaching. It may contain:

- learning notes and blog-like articles
- teaching resources and lesson plans
- curated links, exercises, and materials
- a usable record of what I learned and built

### Later product direction — classroom operations

Only after the primary workspace is useful and stable, evaluate adding:

- attendance tracking
- assignment submission
- scoring or rubric-based assessment
- classroom / student management

### Non-goals for the first MVP

- A complete replacement for Google Classroom, Moodle, or an institutional LMS
- Automated high-stakes grading without teacher review
- Collecting unnecessary student personal data
- Building every module before releasing one useful flow

## 4. Operating Principles

1. **Human owns decisions.** AI may propose, implement, and critique; I approve goals, trade-offs, and high-impact actions.
2. **Evidence over confidence.** “Done” requires artifacts such as a spec, acceptance criteria, test result, screenshot, review report, or deployed behavior.
3. **Small vertical slices.** Finish one observable user outcome before expanding scope.
4. **Spec before implementation.** No feature begins as a vague request.
5. **Test behavior, not claims.** Prefer automated tests and repeatable checks over “it worked once.”
6. **Independent review.** The same AI context should not be the only verifier of its own work.
7. **Privacy by default.** Student data requires explicit purpose, minimum access, and auditability.
8. **Record learning.** Each completed feature produces a short learning log.

## 5. AI-Assisted SDLC Workflow

```text
Problem / opportunity
  → Discovery
  → Specification
  → Tickets
  → Design
  → Implement + tests
  → Independent review
  → Deploy / demo
  → Observe, learn, and improve
```

| Phase | My responsibility | AI can help with | Required output |
|---|---|---|---|
| Discovery | State the actual problem and user | Challenge assumptions; find edge cases; propose questions | Problem statement, user story, non-goals |
| Specification | Approve intended behavior | Draft requirements, error states, permissions | Spec + acceptance criteria |
| Tickets | Prioritize and set scope | Split work into vertical slices; estimate risks | Ordered ticket backlog |
| Design | Select a user flow and visual direction | Offer alternatives; critique usability and accessibility | User flow, wireframe/component plan |
| Implementation | Control scope; inspect changes | Write code, explain codebase, create tests | Diff + test evidence |
| Review | Resolve trade-offs and approve | Security, logic, spec-compliance, UI review | Review report and decision |
| Release | Decide when to ship | Release notes, deployment checklist | Working demo / deployment record |
| Learning loop | Record what happened | Summarize lessons and suggest next experiment | Learning log |

## 6. Initial AI Roles

Do not use a multi-agent swarm by default. Use additional roles only when they have a clear, different job.

- **Planner / analyst:** asks questions and turns an idea into a bounded spec.
- **Builder:** implements one approved ticket at a time.
- **Tester:** derives test cases from acceptance criteria.
- **Reviewer:** independently checks code or design against the spec.
- **Researcher:** compares technologies or documents sources; does not make final choices.
- **Human owner:** Nack; makes product, privacy, and release decisions.

## 7. Skills and Practices to Explore

| Practice / skill direction | Why it matters | First use case |
|---|---|---|
| Requirement grilling | Prevent solving the wrong problem | Define the first learning-resource feature |
| `to-spec` style workflow | Make work testable before coding | Create a one-page feature spec |
| `to-tickets` style workflow | Keep AI work small and reviewable | Turn the feature spec into 3–5 tickets |
| TDD / test-first | Prove intended behavior and reduce regressions | One API or UI behavior |
| Independent code review | Catch security, logic, and scope problems | Review each meaningful feature before merge |
| UI critique with references | Avoid generic “AI-looking” interfaces | Review mobile teaching-resource flow |
| Subagents | Separate implementation from verification | Builder + reviewer for one ticket |
| Agent harness / Hermes | Use tools, files, memory, skills, and task delegation deliberately | Run the whole workflow in this repository |
| Loop engineering | Automate a bounded repeated feedback cycle | PR or issue triage loop with stop conditions |
| Routing / Jev experimentation | Reduce cost for bounded classification decisions | Defer until a workflow has measurable traffic/data |

## 8. Learning Sequence

### Stage 0 — Setup and working agreement

- [ ] Create repository and basic README.
- [ ] Choose a minimal stack after a short comparison.
- [ ] Add project instructions for agents (`AGENTS.md` or `.hermes.md`).
- [ ] Define commands for test, lint, typecheck, build, and local run.
- [ ] Create an issue/ticket format and this planning paper becomes the source of direction.

**Exit condition:** a new agent can open the repository and know how to run and verify it.

### Stage 1 — One useful learning-workspace flow

Candidate flow:

> I can create, edit, organize, and read one learning resource from a mobile-friendly interface.

- [ ] Discovery and one-page spec
- [ ] Tickets
- [ ] UI flow / wireframe
- [ ] Implementation with tests
- [ ] Independent review
- [ ] Local demo or deployment
- [ ] Learning log

**Exit condition:** the feature works end-to-end and has evidence of verification.

### Stage 2 — Repeat the workflow

- [ ] Build a second feature using the same SDLC process.
- [ ] Improve templates based on actual friction.
- [ ] Start a simple PR/review convention.
- [ ] Measure time, token/cost if available, test results, and rework.

**Exit condition:** the workflow is repeatable rather than a one-off experiment.

### Stage 3 — Classroom feature exploration

- [ ] Research privacy, roles, and data requirements before student features.
- [ ] Prototype attendance as the first classroom-operation candidate.
- [ ] Keep teacher approval and audit history in scope.
- [ ] Do not add submissions or scores until the data and role model is validated.

## 9. Definition of Done for a Feature

A feature is done only when all applicable items are satisfied:

- [ ] Problem and user are identified.
- [ ] Scope and non-goals are written.
- [ ] Acceptance criteria are explicit.
- [ ] Tests were added or a documented reason explains why not.
- [ ] Relevant test, lint, typecheck, and build commands pass.
- [ ] A reviewer checked the diff independently.
- [ ] Permission, validation, error, and mobile states were considered.
- [ ] A demo, screenshot, or deployment proves the visible behavior.
- [ ] Learning log entry was written.

## 10. Decision Log

Use this for decisions that would otherwise be forgotten or relitigated.

| Date | Decision | Why | Alternatives considered | Revisit when |
|---|---|---|---|---|
| 2026-09-24 | Start with learning/teaching workspace, not a full LMS | Keeps scope small while supporting portfolio and teaching needs | Start with attendance / full classroom system | After Stage 2 |
| 2026-09-24 | Use AI-assisted SDLC with human approval gates | AI increases leverage but needs verification and ownership | Fully autonomous build | After repeatable verification workflow exists |
| 2026-09-24 | Course posts require enrollment; public posts need no login | Nack confirmed the audience rule | All signed-in learners read all courses | If the school changes access policy |
| 2026-09-24 | Hermes owns product/technical decisions; Antigravity implements coding tickets | Nack requested separate planning and implementation roles | Hermes writes and codes everything | Review after first delegated ticket |
| 2026-09-24 | Nuxt + Supabase selected for the isolated OAuth spike, not yet for live school rollout | Aligns with Vue/Postgres learning, split services, and deadline | Self-host Directus/Postgres before launch | After OAuth pilot and deployment check |
| 2026-09-25 | Any Google account may request registration; student/course access stays pending Nack's approval | Avoids school-domain dependency without granting access from self-entered fields | School-domain-only or invite-only request | If school policy or approval workload changes |
| 2026-09-25 | Student identifier is exactly five digits and unique across all years | Nack wants no duplicate/reuse | Unique per academic year | If the school's identifier lifecycle contradicts it |
| 2026-09-25 | Approve student requests individually while onboarding one ~40-person class at a time | Nack will teach use of the system class by class and can verify against his roster | Bulk approval/import at launch | If approval workload exceeds classroom capacity |

## 11. Work Log

Add one entry whenever a meaningful work session ends.

### Template

```markdown
### YYYY-MM-DD — Short title

- **Goal:**
- **What I did:**
- **Artifacts changed:**
- **Evidence:** tests / screenshots / demo / review
- **Decision made:**
- **What I learned:**
- **Next smallest step:**
- **Blockers / questions:**
```

### 2026-09-24 — Project direction and planning paper

- **Goal:** Turn broad interest in AI agents and development into a bounded learning project.
- **What I did:** Defined the project as a learning-and-teaching workspace first, with future classroom operations as a later direction. Chose AI-assisted SDLC as the working method.
- **Artifacts changed:** Created `PLANNING_PAPER.md`.
- **Evidence:** This planning paper.
- **Decision made:** Do not start by building a complete LMS.
- **What I learned:** Skills, agents, and loops are useful only when linked to a clear SDLC stage and verifiable output.
- **Next smallest step:** Set up the repository working agreement and select the first end-to-end learning-workspace flow.
- **Blockers / questions:** Tech stack, initial user flow, and deployment target are still undecided.

### 2026-09-24 — First product-discovery answers

- **Goal:** Find a concrete starting point for the teaching website.
- **What I did:** Identified Mikelopster-style posts as the reading reference, a simple teacher authoring space as the other half, and occasional Canva teaching materials.
- **Artifacts changed:** Updated the discovery section of `PLANNING_PAPER.md`.
- **Evidence:** Nack's answers in the planning conversation; reference site to be analyzed separately.
- **Decision made:** None yet on feature scope, editor, or technology. A draft-to-public-post flow is a candidate, not an approved MVP.
- **What I learned:** “All in one” is the long-term vision; the first slice still needs specific reading and writing behaviors.
- **Next smallest step:** Have Nack rank essential post and editing features before writing the first spec.
- **Blockers / questions:** Essential post features, Canva integration method, draft privacy, and learner authentication remain open.

### 2026-09-24 — Rich-text and course access discovery

- **Goal:** Clarify how teachers write and how learners navigate and access posts.
- **What I did:** Collected a university-course screenshot and requirements for rich-text, code, media, links, courses, and signed-in reading.
- **Artifacts changed:** Updated discovery notes in `PLANNING_PAPER.md`.
- **Evidence:** Nack's answers and attached screenshot in the planning conversation.
- **Decision made:** Learner login is a desired product requirement; exact course access, account onboarding, editor scope, and MVP boundaries still require approval.
- **What I learned:** The product is better framed as a course-based teaching site with blog-quality articles than as either a generic blog or a full LMS from day one.
- **Next smallest step:** Decide whether access is course-enrollment only or all signed-in learners, then approve minimum authoring blocks for the first slice.
- **Blockers / questions:** Account creation, course membership, public visibility, diagram authoring, Canva behavior, and grades/submission timing.

### 2026-09-24 — Roster import concept and public content

- **Goal:** Connect class rosters, subjects, student accounts, and future assignments/grades without collecting real student data prematurely.
- **What I did:** Captured the teacher's proposal to import students class by class from photographed rosters, associate classes with subjects, and allow public articles.
- **Artifacts changed:** Updated `PLANNING_PAPER.md` discovery notes.
- **Evidence:** Nack's planning message; no roster was received or processed.
- **Decision made:** Use externally created diagrams as images, prefer constrained rich-text styles, and include public articles in the product direction. Actual roster intake and account creation remain conditional on school authorization, privacy safeguards, and a reviewed import design.
- **What I learned:** Class grouping, subject/course offering, enrollment, and login account need separate concepts so future grades and submissions can respect permissions.
- **Next smallest step:** Confirm who may authorize use of real rosters, and design the flow with fictitious data first.
- **Blockers / questions:** School authorization/legal basis, protected intake, student account activation, and allowed visibility by course.

### 2026-09-24 — First feature spec and skill inventory

- **Goal:** Turn discovery into a reviewable first-slice specification and establish which workflows are real installed skills.
- **What I did:** Drafted `docs/SPEC-001-course-posts.md` for teacher authoring, course-restricted reading, and optional public publication using fictitious demo users. Checked Hermes's actual skill inventory and registry search without installing new skills.
- **Artifacts changed:** `docs/SPEC-001-course-posts.md`, `PLANNING_PAPER.md`.
- **Evidence:** Spec file creation confirmed; `hermes skills list` reported 63 enabled (57 builtin, 6 local, 0 hub-installed). Registry search found community skills with names such as `grill-with-docs`, `to-spec`, and `to-tickets`; these are not installed here.
- **Decision made:** Treat SPEC-001 as a draft for product-owner review, not an implementation approval. Build and test with fictitious data before any real roster is used.
- **What I learned:** This session is at the discovery-to-spec gate; a skill used through `skill_view` is real, but merely discussing a named workflow does not install its GitHub skill.
- **Next smallest step:** Review SPEC-001's access rules and non-goals with Nack, then create tickets and evaluate the stack.
- **Blockers / questions:** Course membership policy, image storage approach, account onboarding, and real-student-data governance.

### 2026-09-24 — Access rule approved and tickets drafted

- **Goal:** Move from the first spec to testable implementation slices.
- **What I did:** Nack confirmed enrolled-only course articles and visitor-readable public articles. Updated SPEC-001 accordingly and drafted five end-to-end tickets in `docs/TICKETS-001-course-posts.md`.
- **Artifacts changed:** `docs/SPEC-001-course-posts.md`, `docs/TICKETS-001-course-posts.md`, `PLANNING_PAPER.md`.
- **Evidence:** Confirmed access rule in conversation; written acceptance criteria and ticket dependencies; independent planning critique returned six findings, incorporated into SPEC-001 and tickets.
- **Decision made:** Access policy approved. Protected course-image uploads are required and delete/archive is deferred from V1. Stack, storage provider, and auth service remain open until before coding.
- **What I learned:** A useful first ticket delivers a teacher-visible saved draft; the next ticket delivers an enrolled learner-visible published article and denies outsiders.
- **Next smallest step:** Review ticket breakdown, choose stack, and initialize repository/working agreement before Ticket 1.
- **Blockers / questions:** Image-storage provider and access design, authentication choice, and publication defaults.

## Learning checkpoint — where Nack is now (updated 2026-09-24)

- **Current SDLC practice:** discovery, access rules, specs and vertical-slice tickets are drafted; now practicing a bounded implementation → automated checks → independent review → correction loop on the Gate 0 Nuxt/Supabase authentication spike. This is not yet an accepted Gate 0 or the first complete teacher-to-learner article feature. The repeated auth findings demonstrate why passing tests and an agent's completion claim are not sufficient.
- **Tools used, not just discussed:** Hermes plans, delegates and reviews; Antigravity IDE codes from a written handoff; independent review (including a subagent) checks claims; local tests/lint/typecheck/build and HTTP probes provide limited evidence. A private GitHub WIP snapshot was pushed on `main` (`cb68158551f0`); correction work is isolated on local branch `fix/gate0-auth`. Neither a PR nor deployment has happened. No claim of strict test-first TDD is made for the current spike.
- **Immediate gate (updated 2026-09-25 after handoff 005):** Antigravity completed handoff 005; Hermes reran 45 tests/lint/typecheck/build and a post-build test run. A separate controlled-stub probe confirms the production SSR cookie → default middleware → `useAuth()` → `getUser()` boundary locally, and installed SDK browser auto PKCE exchange was disabled as intended. Independent review `docs/REVIEW-005-gate0.md` still rejects local Gate 0: callback may report an old, different user after a successful exchange; the installed SDK removes local session and emits `SIGNED_OUT` on some remote sign-out errors despite the app's retain-user claim; arbitrary callback error text can expose codes/tokens; built-server tests silently pass without `.output`. `docs/HANDOFF-ANTIGRAVITY-006.md` is prepared but **not submitted**. Real school OAuth and live-user/privacy gates remain separate before October 28.
- **Next tool-learning sequence:** (1) finish Gate 0 review and a real authorized OAuth pilot; (2) settle the first article flow/UI and implement small approved tickets with deliberate test-first practice where feasible; (3) use a Git branch, PR, CI and independent review before merging; (4) critique the functioning UI with design references, considering Hallmark only if its actual instructions suit the IDE; (5) deploy, rehearse access/restore, and write a learning retrospective. Subagent/loop automation and model-routing/Jev experiments come after a repeatable measured workflow, not as a substitute for the launch gates.
- **Available skills, not proof of use:** `ai-assisted-product-discovery`, `hermes-agent`, `test-driven-development`, `requesting-code-review`, and UI/design skills such as `design-md`. Named community workflows `grill-with-docs`, `to-spec`, `to-tickets`, `implement`, and `code-review` were not installed from GitHub/hub when checked. Inspect a third-party skill before adoption; Hallmark was reviewed as a possible later UI aid, not installed or used for auth.
- **Approved next integration experiment (after the current IDE task):** Nack agreed to trial Antigravity CLI (`agy`) on one small, non-sensitive, bounded task rather than automate the IDE GUI. Wait for Nack's completion notice and independently review Gate 0 first; do not interrupt the running agent. Before installing or authenticating, verify current official CLI documentation and agree on the exact pilot task and permissions. Run it in an isolated branch/worktree, compare handoff reliability, output readability, review effort and cost with the IDE path, and stop if CLI cannot provide a verifiable result. `agy` was not found in PATH during the initial check; nothing was installed, authenticated, or submitted for this experiment yet. CLI use must not be represented as control of an existing IDE conversation.

## Stack discovery — decision pending (2026-09-24)

**Decision drivers from SPEC-001:** custom teacher and learner experience; structured rich-text/code/image authoring; course membership and server-side access checks; protected images; public articles; a deployable portfolio project. Development uses fictitious accounts only.

**Option A (provisional recommendation if TypeScript/full-stack portfolio matters):** Next.js + TypeScript for app/UI, Supabase Postgres/Auth/Storage for identity/data/private media, Tiptap for the editor. Strong custom UI flexibility and managed primitives, but requires careful SSR auth, SQL/RLS policies, protected-media delivery, and coordination across two services.

**Option B (if Python and getting an editorial back office quickly matters more):** Django + Wagtail + PostgreSQL with appropriately private object storage. Wagtail supplies an editorial/admin foundation; a tailored learner-facing course experience and access-controlled media still require custom work and deployment decisions.

**No choice yet.** Compare against the user's language familiarity, target developer role, available time and monthly cost, deployment comfort, and whether the teacher editor must be bespoke or an existing CMS/admin UI is acceptable. Do not choose a stack solely because its components are popular. Verify tool capabilities in official product docs when deciding.

**Questions for Nack:** (1) JS/TS vs Python current ability and desired dev role? (2) prioritize shipping a usable editor quickly or building a custom portfolio UI? (3) acceptable ongoing hosting budget/deployment comfort? (4) first release stays a demo or needs real students and school-approved hosting soon?

### Answers and deadline — 2026-09-24

- Nack has some TypeScript/NestJS backend exposure; Python needs a refresh. Learning goals emphasize AI-assisted development, Git branching/version control, and current engineering practices; Kubernetes is a later learning interest, not a first-release dependency.
- Nack is happy to use an existing article-management interface; Vue + PostgreSQL is the preferred new stack to learn. JWT is familiar and may be used as an auth token format, but it is not itself authorization/session design.
- Target is free or under USD 3 per month, with interest in self-managing a server. This is a constraint to test against actual vendor prices and resource requirements; not a guarantee that a single cheap VPS can safely host the whole stack.
- Nack needs real use by **October 28, 2026**, ahead of teaching **October 29, 2026** (34 days from September 24). This conflicts with SPEC-001's demo-only V1; clarify what users and functions must be live before revising acceptance criteria/tickets.
- **Provisional stack direction:** Nuxt (Vue/TypeScript) + PostgreSQL + Directus (ready-made content admin) as one option; Nuxt + managed PostgreSQL/Auth/Storage (such as Supabase) with a smaller custom teacher editor as a lower-operations alternative. Directus access policies, code/image editor UX, and private-media access must be proved in a spike, not assumed. Low-cost/free tiers may be subject to limits or availability.
- **Next questions:** What does usable on October 28 mean—teacher only, public readers, or enrolled students with real logins? How many students/classes and how will initial accounts be issued? Is a platform-split free tier acceptable or must all services be on one self-managed server? Is the budget strict including domain/backups?

### 2026-09-24 — Deadline-driven stack discovery

- **Goal:** Select technology in service of an actual classroom launch date, not a portfolio demo.
- **What I did:** Recorded Vue/PostgreSQL/JWT preference, existing CMS preference, USD 3/month budget, server-operations interest, and the October 28/29 timeline; researched official framework/CMS/cloud documentation.
- **Artifacts changed:** `PLANNING_PAPER.md`; flagged the demo-only conflict in `docs/SPEC-001-course-posts.md`.
- **Evidence:** Nack's answers and current date check. No vendor account, server, or application has been created.
- **Decision made:** No stack approved yet. A real-student launch cannot inherit demo-only acceptance criteria without a scope and privacy review.
- **Next smallest step:** Clarify day-one actor and must-have flow, then compare Nuxt/Directus/self-host vs Nuxt/managed services against the strict budget and deadline.
- **Blockers / questions:** Real-user scope, school approval/data handling, hosting topology, and account provisioning.

### Confirmed launch constraints — 2026-09-24

- October 28, 2026 means **real students must log in and read articles restricted to their enrolled course**, not merely a teacher-only demo or public page. Teaching starts October 29.
- Expected scope: **five classes of approximately 40 students each (~200 students)**; two subjects, taught to two and three classes respectively. The exact subject names and curricula are not known yet, so titles/content cannot be hard-coded into the architecture.
- Nack accepts splitting web application and database/auth/media across services. Free or at most USD 3/month remains the preferred budget. Self-hosting is a learning goal, but not mandatory for day-one operations.
- **Implication:** SPEC-001 and TICKETS-001 are currently demo-only and are **not launch-ready**. They must gain real account onboarding, course membership provisioning, privacy/authority checks, backup/recovery, and an end-to-end rehearsal for ~200 accounts before shipping.
- **Provisional launch-oriented option:** Nuxt/Vue/TypeScript frontend on a free deployment tier + managed PostgreSQL/Auth/private file storage (e.g. Supabase free tier); a minimal structured teacher editor may have to replace Directus in the deadline release. This is a trade-off against the preferred ready-made admin, not a final stack decision. Current provider quotas and pause policies need validation with a traffic/storage estimate.
- **Higher-operations option:** Nuxt + Directus + PostgreSQL, requiring a place to run Directus and careful role/media access design. A no-cost VM may be unavailable in time; a sub-USD-3 single VPS should not be assumed adequate. Consider as a spike/future improvement, not a promise for October 28.
- **Next decision:** How will ~200 learners receive identities (school email/SSO, personal email invitation, or no email)? Who authorizes the school's roster use and live website? What minimum teacher editor must be present by October 28?

### 2026-09-24 — First-day scale clarified

- **Goal:** Resolve whether the first release is a prototype or a live classroom launch.
- **What I did:** Recorded the five-class, two-subject, ~200-student scope and the requirement that learners sign in by October 28; compared hosted and self-hosted paths against the budget and deadline.
- **Artifacts changed:** `PLANNING_PAPER.md`; SPEC-001/tickets still need a revised live-launch version after identity and authority questions are answered.
- **Evidence:** Nack's answers in the planning conversation; current provider documentation consulted for deployment/free-tier and Directus resource limits.
- **Decision made:** Multi-service hosting is acceptable. No particular vendor or stack approved yet.
- **Next smallest step:** Decide account onboarding and school authority before finalizing the deployment/auth stack and revising acceptance criteria.
- **Blockers / questions:** Students' usable email/SSO, identity handout/recovery, school's data permission, editor day-one minimum, and outage/backup plan.

### School Google identities and provisional stack — 2026-09-24

- Nack reports that students have school Google accounts following a `student-id@rpr.ac.th` convention. This supports testing Google OAuth, but domain string alone must not authorize course access; bind a verified account to teacher-reviewed enrollment records.
- Nack reports that the mentor teacher approved using the roster and expressed interest in trying the site later. This is encouraging but does **not** establish that the school Google Workspace administrator has approved a third-party OAuth app or that the school has approved the external hosting/data-processing arrangement.
- **ADR drafted:** `docs/ADR-001-stack-and-launch.md` recommends Nuxt + Supabase PostgreSQL/Auth/Storage + a small teacher-admin page with a ready-made editor component, conditional on an authorized school Google login pilot, approval of external data hosting, access-control tests, and free-tier/deployment spikes. Directus remains a later spike option; not chosen for the deadline baseline.
- Google Workspace for Education may block unconfigured third-party apps for users designated under 18; a real school-authorized test account and admin contact are a **critical path** before claiming Google sign-in will work for all learners.
- Supabase free-tier capacity for ~200 users is plausible by MAU count alone, but media egress, storage, inactivity pauses, backup/recovery, and provider limits must be measured, not assumed.
- **Next ask:** identify whether the school Google Workspace administrator can approve a third-party OAuth app, and whether school approval covers external service hosting; then update SPEC-001/tickets for real-student onboarding before implementation.

### 2026-09-24 — Identity and architecture gate

- **Goal:** Convert school Google login availability into a conditional architecture decision.
- **What I did:** Researched official Google Workspace, Supabase, Nuxt, Directus, and editor documentation; wrote a cited ADR and verified its source list.
- **Artifacts changed:** `docs/ADR-001-stack-and-launch.md`, `PLANNING_PAPER.md`.
- **Evidence:** User-reported school account pattern and mentor approval; ADR citation check passed. No real account or roster was accessed.
- **Decision made:** Nuxt + managed Postgres/Auth/Storage is recommended but not finalized. School-admin OAuth and hosting approval are launch gates.
- **Next smallest step:** Run a school-authorized Google login pilot and confirm external hosting authority, then revise SPEC-001/tickets for launch.
- **Blockers / questions:** School IT administrator, student age designation, third-party app access, hosting permission, and day-one editing scope.

### 2026-09-24 — Google sign-in configuration clarified

- Nack has a school test account and asked whether checking the school email domain in the website is enough. It is not: Google OAuth requires a Google Cloud consent screen and web OAuth client, registered Supabase callback, Supabase Google provider setup, and app callback/session handling.
- A `@rpr.ac.th` UI filter does not prove Google Workspace membership and does not confer course enrollment. Enrollments must be reviewed and authorized separately from identity.
- The school test account enables an early staging pilot once the OAuth app exists. If school policy blocks an external app, the school Workspace administrator must configure app access; the developer cannot fix this with a website-only domain check. The mentor's roster permission does not grant admin control over Workspace app policy.
- **Decision status:** No OAuth app configured and no login tested. Do not claim the school's Google sign-in works until the actual staging flow succeeds with an authorized test student account. Details and source-backed steps are in `docs/ADR-001-stack-and-launch.md`.
- **Next smallest step:** choose/approve the provisional stack for an isolated OAuth spike; create only the minimal Google/Supabase configuration, then test the school account without importing any roster.

### 2026-09-24 — Personal OAuth app chosen

- Nack chose to own the Classroom Google OAuth app under his personal Google Cloud account; he previously implemented university-domain Google login for a room-booking system.
- The Classroom OAuth client/project should be separate from the earlier university app. It will be an **External** app relative to the school's Workspace. Familiarity with a different university domain does not establish that school student accounts can access this new app.
- Created `docs/SPIKE-001-school-google-login.md` with a narrow test plan for one authorized school account and a student-designated account if applicable; no Google Cloud or Supabase configuration has been changed yet.
- **Next smallest step:** Nack approves setting up the isolated OAuth/Supabase staging app in his accounts, then the sign-in flow is executed and recorded. If it is blocked by school policy, contact the Workspace admin; do not work around the block with a domain filter.
- **Open:** whether the first test account has the same age-based restrictions as students, who owns third-party app approval at the school, and whether external hosting is authorized for live data.

### 2026-09-24 — Hermes planning / Antigravity coding agreement

- Nack delegated requirement decisions, scope, planning, and review to Hermes; coding should be done by Antigravity IDE to minimize Hermes implementation-token use. Hermes remains responsible for independently checking results and never treating an IDE-agent summary as proof.
- Inspected `/Users/nack/Classroom`: it contains planning documents but is not yet a Git repository. Antigravity IDE is installed and running with this workspace, but **no task was submitted**.
- Re-scoped the old demo-only plan into `docs/SPEC-002-live-classroom-release.md` and `docs/TICKETS-002-live-release.md`. Selected Nuxt + Supabase only for an isolated OAuth spike; school production remains behind Google Workspace, data-hosting, access-control, and restore gates.
- Created `docs/HANDOFF-ANTIGRAVITY-001.md` with an exact, bounded Gate 0 coding task. Before sending it to Antigravity's IDE panel, confirm the destination and this precise scope with Nack at action time. No Google/Supabase project or live account has been configured or tested.
- **Next smallest step:** Ask for explicit confirmation to submit Gate 0 to Antigravity IDE in `/Users/nack/Classroom`; then verify panel submission, agent result, diff, tests, and actual local behavior. OAuth round trip remains pending external account setup and school test.

### 2026-09-24 — Gate 0 implementation received; independent review open

- Nack confirmed the bounded IDE submission. Antigravity initialized a local Git repository on `main` without commits and built the Nuxt/Supabase identity spike. Its result is in `docs/HANDOFF-001-antigravity-result.md`.
- Hermes reran 17 tests, lint, typecheck, and build successfully. A local production server returned 200 for `/`, 302 for unauthenticated `/protected`, and 200 for `/auth/callback`; the server was stopped. No real OAuth round-trip has occurred.
- `docs/REVIEW-001-gate0.md` records corrective blockers: hard reload of `/protected` cannot recover browser-stored auth on the server; client `getSession()` trusts a forgeable local session; a denied OAuth callback can appear successful when an old session exists; Google Cloud callback instructions confuse the Supabase provider callback with the app redirect allow list. Sign-out failure reporting and malformed error parsing also need correction. The independent reviewer corroborated the primary findings; Hermes reproduced the synthetic local-session issue separately.
- **Decision:** Keep SSR and use request-scoped cookie-backed Supabase auth plus verified identity for this spike; do not accept Gate 0 or configure school OAuth using current instructions. Submitted the bounded corrective task from `docs/HANDOFF-ANTIGRAVITY-002.md` to Antigravity IDE after Nack confirmed; the panel showed it working. Implementation and independent verification are pending. No school records or credentials have been used.

### 2026-09-24 — Gate 0 corrective review

- Antigravity's repair is documented in `docs/HANDOFF-002-antigravity-result.md`: request-scoped `@supabase/ssr` client, verified-user check, corrected redirect guidance, callback-error priority, and sign-out failure reporting. Hermes independently reran 26 tests, lint, typecheck, build, and unauthenticated production routes; all passed.
- `docs/REVIEW-002-gate0.md` identifies one new blocker: `onAuthStateChange` awaits another Supabase auth call inside its subscriber, which can deadlock the auth lock. The supposed SSR cookie integration tests only pass a boolean into a helper; they do not test an authenticated HTTP request with cookies. Neither Google OAuth nor authenticated reload has been tested with an authorized school account.
- **Decision:** Gate 0 is still open. A narrow correction and request/cookie-boundary test are needed before Nack configures external OAuth; no live/student rollout or commit yet.

### 2026-09-24 — Gate 0 handoff 003 review

- Nack confirmed Antigravity started and completed the bounded `docs/HANDOFF-ANTIGRAVITY-003.md` task. Hermes reran the checks: 33 tests, lint, typecheck, build all pass; local HTTP `/` 200, unauthenticated `/protected` 302, `/auth/callback` 200, forged synthetic cookie `/protected` 302. Test server stopped; no real OAuth account used.
- `docs/REVIEW-003-gate0.md` records independently corroborated blockers: a stale `getUser()` result can restore signed-in UI after sign-out because `checkVerifiedUser()` mutates state before the sequence guard; SSR tests construct cookie events but do not connect them to production middleware and auth verification; an arbitrary callback `code` plus an old verified session can report a false success. No evidence of an RLS bypass; real school OAuth and authenticated reload remain untested.
- **Decision:** Gate 0 remains unaccepted. Next work should correct those precise issues and demonstrate the true request/cookie/middleware boundary; do not represent passing mocks as proof of school sign-in or authorize a student rollout.

### 2026-09-24 — Gate 0 correction brief and private GitHub snapshot

- Submitted `docs/HANDOFF-ANTIGRAVITY-004.md` to Antigravity IDE after Nack approved the next work. It scopes a race-safe verified auth state, OAuth callback success tied to the actual code exchange, and SSR tests crossing production middleware/request cookies/Auth verification. IDE showed the task working; completion and independent review remain pending. The live school OAuth pilot is separate.
- Nack made `nack1521/classroom` private; visibility was checked before pushing. A reviewed WIP snapshot was committed as `cb68158551f0` and pushed to private `origin/main`; the remote ref was verified to match. A local `fix/gate0-auth` branch isolates the correction. `.env` was absent at the snapshot check and ignored; no real student roster or account data was intentionally added. Private visibility does not make secrets safe to commit.
- **Learning distinction:** Git history and a working IDE agent are not a passed Gate 0, reviewed PR, deployment, or permission to onboard real students. Review the correction and actual auth behavior before accepting Gate 0 or merging its branch.

### 2026-09-25 — Gate 0 handoff 004 independent review

- **Goal:** Verify Antigravity's auth-race, callback, and SSR integration corrections independently.
- **What I did:** Inspected IDE completion, reviewed changed source/tests, reran 38 tests, lint, typecheck, build and fresh local HTTP probes; reproduced callback false success with synthetic clients and obtained a separate read-only reviewer verdict.
- **Artifacts changed:** `docs/REVIEW-004-gate0.md`, prepared (not submitted) `docs/HANDOFF-ANTIGRAVITY-005.md`, and this planning paper. Implementation remains Antigravity's uncommitted work on `fix/gate0-auth`.
- **Evidence/decision:** All automated checks passed but old-session/reused-code callback success and sign-out race remain; SSR tests still replace the production composable. Gate 0 not accepted; no merge, correction push, cloud account, or deployment.
- **Next smallest step:** Nack reviews the new bounded handoff and explicitly approves IDE submission if desired. Keep the Antigravity CLI pilot separate from the unresolved auth correction.

### 2026-09-25 — Gate 0 handoff 005 independent review

- **Goal:** Verify the updated callback, race handling and real SSR boundary against the previously failing criteria.
- **What I did:** Inspected source/tests and IDE result, reran 45 tests, lint, typecheck, build and a post-build test run; reproduced a callback identity mismatch and error-message marker exposure with synthetic clients. Two independent read-only reviewers checked actual installed SDK behavior and exercised the built Nuxt app against a local Auth stub.
- **Artifacts changed:** `docs/REVIEW-005-gate0.md`, prepared (not submitted) `docs/HANDOFF-ANTIGRAVITY-006.md`, and this paper. Antigravity's implementation is still uncommitted on `fix/gate0-auth`.
- **Evidence/decision:** Local SSR cookie/request isolation is materially improved and browser auto PKCE exchange is disabled, but callback identity binding, actual SDK sign-out failure semantics, safe error display, and fail-closed built-app tests need a small correction. Gate 0 is not accepted; no real school account used or cloud changes made.
- **Next smallest step:** Obtain Nack's explicit approval before submitting handoff 006; after a passing local review, arrange an authorized school Google OAuth pilot and authenticated reload without sharing credentials in chat.

### 2026-09-25 — Student self-registration discovery proposal

- **Goal:** Evaluate Google-only sign-up without a school-domain requirement, student profile fields, and admin-controlled privileged roles.
- **What I did:** Recorded Nack's proposed onboarding fields and separated Google identity, profile completion, teacher-reviewed enrollment, and administrator role assignment; flagged the guessable-ID and self-selected-class access risk.
- **Artifacts changed:** Discovery proposal and this work-log entry in `PLANNING_PAPER.md`.
- **Evidence:** Nack's planning message; no real student data or account was used.
- **Decision made:** Nack approved open Google-account requests, one-by-one manual approval against his roster while teaching each ~40-person class, and a five-digit student identifier unique across all years. Duplicate/correction handling, class/year lifecycle, and school data authority remain open before SPEC-002 or tickets change.
- **Next smallest step:** Review `docs/SPEC-003-student-onboarding-draft.md` with Nack, especially claim corrections, roll-number uniqueness, first-admin bootstrap and data authority; complete Gate 0 auth regression before any registration implementation.
- **Blockers / questions:** Gate 0 remains open; school/hosting permissions and authorized student Google sign-in remain external release gates.

### 2026-09-25 — Gate 0 protected-navigation review and next bounded task

- **Goal:** Remove stale authenticated UI access after a denied callback without revoking an independently valid older session.
- **What I did:** Independently reviewed Antigravity's 006E3 route-guard correction through fresh build, focused and full tests, and synthetic browser navigation; prepared a test-first 006E4 handoff for raw auth notices outside callback.
- **Artifacts changed:** `docs/REVIEW-006E3-gate0.md`, `docs/HANDOFF-ANTIGRAVITY-006E4-safe-auth-notices.md`, `docs/GATE0-RESUME.md`, and this work-log entry.
- **Evidence/decision:** 92/92 Vitest and five browser scenarios pass for the protected-navigation slice. Gate 0 is still open; next boundaries are safe non-callback errors, ambiguous-identity quarantine, real-SDK race, rendered callback success, and authorized real Google OAuth. No school account or roster was used.
- **Next smallest step:** Nack submits the narrow 006E4 prompt to Antigravity if desired, then Hermes independently reviews it. Do not start registration implementation from SPEC-003 yet.
- **Blockers / questions:** Live OAuth configuration, school authorization and a student-designated test account remain external dependencies; no fixed Gate 0 completion date can be promised without them.

### 2026-09-25 — Gate 0 safe notices and remaining-evidence matrix

- **Goal:** Remove raw SDK/provider errors from the public auth notice and reduce repeated Gate 0 handoff planning without granting a broad production fix.
- **What I did:** Independently reviewed 006E4, reran focused/full tests, build, lint, typecheck and browser regression, checked the actual home-page notice binding, then consolidated remaining acceptance boundaries in one plan.
- **Artifacts changed:** `docs/REVIEW-006E4-gate0.md`, `docs/GATE0-REMAINING-PLAN.md`, test-only `docs/HANDOFF-ANTIGRAVITY-006E5A-mismatch-diagnostic.md`, updated `docs/GATE0-RESUME.md`, and this log.
- **Evidence/decision:** 98/98 Vitest, five browser navigation cases and local checks pass. Accept the four fixed public error categories; the agent's fake template renderer is not browser evidence. Gate 0 still needs mismatched SDK-session quarantine, actual in-flight SDK event race, rendered callback success, and authorized live Google OAuth.
- **Next smallest step:** Nack may submit only 006E5A for test-only mismatch diagnosis; Hermes reviews before any production correction. Later rows share one matrix but retain separate stop points.
- **Blockers / questions:** External Google/Supabase configuration and school-account authorization; real student data and onboarding remain out of scope.

### 2026-09-25 — Gate 0 mismatch persistence RED

- **Goal:** Test whether a failed new callback can leave an ambiguous SDK session that later regains protected access.
- **What I did:** Independently reran 006E5A real-SDK/loopback diagnostics and built-browser controls; corrected a browser evidence gap with a scratch-only deliberate SPA click; scoped the next RED→GREEN correction.
- **Artifacts changed:** `docs/REVIEW-006E5A-gate0.md`, `docs/HANDOFF-ANTIGRAVITY-006E5B-local-quarantine.md`, `docs/GATE0-REMAINING-PLAN.md`, `docs/GATE0-RESUME.md`, and this log.
- **Evidence/decision:** Focused 7 pass/1 expected RED; full 105 pass/1 expected RED. The callback rejects synthetic A-versus-B identity, but SDK storage remains and later SPA or SSR protected access admits B. The agent browser runner mislabeled a full navigation as SPA and exits 0 on RED; the next handoff repairs these tests before touching one production seam. No real provider behavior was inferred from this synthetic contradiction.
- **Next smallest step:** Nack may submit only 006E5B for mismatch-specific local containment; Hermes reviews before row B real-SDK race work.
- **Blockers / questions:** Safe local-session removal under remote failure and unknown storage states; authorized real OAuth remains external.

### 2026-09-25 — Gate 0 local-quarantine correction review

- **Goal:** Independently verify whether 006E5B closed the ambiguous callback/session boundary, including cleanup-failure cases.
- **What I did:** Rebuilt, reran focused/full/browser checks, exercised a scratch-only protected SSR request and injected a throwing local sign-out into the actual callback utility. A second read-only reviewer checked the same seam independently.
- **Artifacts changed:** `docs/REVIEW-006E5B-gate0.md`, `docs/HANDOFF-ANTIGRAVITY-006E5C-failure-boundary-diagnostic.md`, `docs/GATE0-REMAINING-PLAN.md`, `docs/GATE0-RESUME.md`, and this log. No production edit by Hermes.
- **Evidence/decision:** Ordinary mismatch tests are GREEN (focused 9/9, full 107/107; browser controls/contracts pass), but injected cleanup throw returned callback failure while storage remained present and later B verification permitted protected access. Incomplete response after simulated storage change also remained present. Checked-in browser runner reloads redirected home, not protected SSR, although a separate scratch request to `/protected` redirects in the ordinary fixture. **Row A not accepted**; no Row B authorization.
- **Next smallest step:** Nack may submit only test-only 006E5C to characterize failure boundaries and correct protected SSR evidence; stop for Hermes scope/policy decision before any broader production changes.
- **Blockers / questions:** Robust fail-closed containment when local persistence cannot be confirmed absent may require another production seam. Authorized live OAuth remains external.

### 2026-09-26 — Gate 0 failure-boundary diagnostic review

- **Goal:** Verify the test-only 006E5C diagnosis and repair the protected SSR evidence gap without changing production.
- **What I did:** Ran fresh build, lint/typecheck, focused/full Vitest, and both browser diagnostics; inspected the five fault-injected RED fixtures, matching controls, and unchanged protected-file diff hash.
- **Artifacts changed:** `docs/REVIEW-006E5C-gate0.md`, `docs/GATE0-REMAINING-PLAN.md`, `docs/GATE0-RESUME.md`, and this log. No production edit by Hermes.
- **Evidence/decision:** 006E5A focused 9/9 passes; 006E5C focused 4 controls pass/5 policy RED; full 111 pass/5 RED across 10 files. Normal browser mismatch now explicitly checks a deliberate SPA click and a fresh document `/protected` request; both redirect. Fault-injected sign-out throw/missing method or incomplete post-persistence responses retain a session, then admit B through app-wired route verification. Accept diagnostic only; Row A and Gate 0 remain RED. Missing method/incomplete response are synthetic stress cases, not confirmed live SDK behavior.
- **Next smallest step:** Settle a durable fail-closed design and production scope that survives SSR/hard reload; convert broken-state characterization assertions to desired policy contracts before correction. Keep Row B on hold.
- **Blockers / questions:** Need a threat-model/scope decision for cleanup failure or unreadable persistence; live authorized OAuth remains external.

### 2026-09-26 — Gate 0 local auth-spike sign-off and next product gate

- **Goal:** Close a finite, independently reviewed authentication spike without claiming enrollment or deployment readiness.
- **What I did:** Bounded the threat model to installed SDK/actual browser behavior; independently reviewed ordinary mismatch, protected SPA/fresh SSR, rendered callback success and failure, and a natural SDK `SIGNED_IN` race. Nack privately tested personal and authorized school-managed Google accounts for sign-in, protected navigation/reload, sign-out, and signed-out denial.
- **Artifacts:** `docs/GATE0-AUTH-POLICY.md`, `docs/GATE0-LIVE-PILOT-CHECKLIST.md`, `docs/REVIEW-006F1-gate0.md`, and updated `docs/GATE0-RESUME.md`.
- **Evidence/decision:** Fresh build/lint/typecheck and browser contracts passed; Vitest 116 passed with six explicitly skipped fault-injection stress cases that remain RED when run separately. **Gate 0 passed only for the agreed local auth-spike scope.** This is not a release, student enrollment authorization, real-data permission, or proof for student-designated Workspace accounts.
- **Next smallest step:** Review `docs/SPEC-003-student-onboarding-draft.md` open decisions with Nack, reconcile SPEC-002/TICKETS-002, then implement one synthetic-data onboarding slice behind server/database authorization. Confirm school data-processing/hosting authority and a student-designated login pilot before live class rollout.
- **Blockers / questions:** Initial admin bootstrap, duplicate/correction policy, roll-number lifecycle, student-data retention and school hosting approval, course/article RLS, and deployment/backup rehearsal. Six stress failures remain future hardening debt.

## 12. Current Backlog

### Now

- [x] Rank essential first-flow capabilities in SPEC-001; defer optional editor features.
- [x] Decide course access rule: enrolled members only; public posts open to everyone. Account onboarding remains deferred for real students.
- [ ] Confirm school authorization and protected processing before any real roster import; use synthetic records for design.
- [x] Approve first user flow and audience rule; remaining implementation assumptions still open.
- [x] Draft first feature spec: `docs/SPEC-001-course-posts.md` (no code authorized yet).
- [ ] Create repository working agreement.
- [x] Select Nuxt + Supabase for the isolated Gate 0 spike; production choice remains conditional on results.
- [x] Re-scope the demo plan for October 28 as SPEC-002/TICKETS-002; school data authorization and student-designated login remain open release gates.
- [x] Draft launch-specific `docs/SPEC-002-live-classroom-release.md` and `docs/TICKETS-002-live-release.md` (not implemented).
- [x] Confirm, implement, and independently sign off the bounded Gate 0 local auth spike (`docs/REVIEW-006F1-gate0.md`); this is not a deployment or permission to use student records.
- [ ] Decide onboarding for ~200 real learners and confirm authority for roster use before launch.
- [ ] Obtain school IT confirmation for Google OAuth with student accounts and external hosting; test authorized student login.
- [x] Choose personal Google Cloud ownership for Classroom OAuth; owner-reported personal and authorized school-managed account pilot passed. Student-designated account restrictions remain untested.
- [ ] Review remaining spec assumptions and implementation decisions before coding.

### Next

- [x] Draft five vertical-slice tickets in `docs/TICKETS-001-course-posts.md`; independent critique incorporated (draft isolation, media access, public article without course, editor coverage, demo seeds, delete/archive deferral).
- [ ] Create user flow and low-fidelity UI.
- [ ] Implement first ticket with tests.
- [ ] Review and demo the first vertical slice.

### Later

- [ ] Add a repeatable AI review loop.
- [ ] Add deployment and CI.
- [ ] Evaluate attendance feature discovery.
- [ ] Evaluate Jev/routing only after measuring repeated agent workflows.
