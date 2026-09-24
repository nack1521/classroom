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

## Learning checkpoint — where Nack is now

- **Currently practicing:** discovery (actors, teacher/learner journeys, references, constraints), requirements vs recommendations, V1 scope, and acceptance criteria. Artifact: `docs/SPEC-001-course-posts.md` (draft).
- **Next:** review drafted vertical-slice tickets → UI flow and technology decision → TDD implementation → independent review → demo/retrospective.
- **Skills actually available and relevant:** `ai-assisted-product-discovery` (local), `hermes-agent` (builtin), `test-driven-development` (builtin), `requesting-code-review` (builtin), and UI/design skills such as `design-md` (builtin). Load them only for the matching phase.
- **Not installed from GitHub/hub:** `grill-with-docs`, `to-spec`, `to-tickets`, `implement`, `code-review` as named community workflows. Do not present earlier conceptual descriptions as evidence that these skills ran.
- **Candidate to inspect later:** official `grill-me` (adversarial plan interview). Do not install or broadly enable third-party skills before reviewing their source and need.

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

### 2026-09-24 — Gate 0 correction brief and GitHub plan

- Prepared `docs/HANDOFF-ANTIGRAVITY-004.md` for Nack's review; not yet submitted to IDE. It scopes a race-safe verified auth state, OAuth callback success tied to the actual code exchange, and SSR tests crossing production middleware/request cookies/Auth verification. Requires independent local review and leaves live school OAuth pilot separate.
- Git repository is on `main` with no commits and no remote; `gh` CLI is unavailable in this environment. `.env` is absent, and `.gitignore` excludes `.env`, build outputs, and dependencies. A narrow candidate-credential signature scan of currently untracked source/docs found no hits; this does not certify the repo safe to publish. No student roster or real account data has been added.
- **Recommendation:** GitHub is appropriate for version control before launch, not a deploy or release approval. Prefer a private repository while school sharing/hosting policy is unresolved. After manual file/secret review, make an initial snapshot commit (clearly marked WIP if Gate 0 remains open); use a fix branch for the auth corrections and push only after confirming the chosen remote/visibility. A clean Gate 0 review is a useful milestone before merging to `main`, not a prerequisite for private WIP history. Do not push credentials or real student data even to private GitHub.

## 12. Current Backlog

### Now

- [x] Rank essential first-flow capabilities in SPEC-001; defer optional editor features.
- [x] Decide course access rule: enrolled members only; public posts open to everyone. Account onboarding remains deferred for real students.
- [ ] Confirm school authorization and protected processing before any real roster import; use synthetic records for design.
- [x] Approve first user flow and audience rule; remaining implementation assumptions still open.
- [x] Draft first feature spec: `docs/SPEC-001-course-posts.md` (no code authorized yet).
- [ ] Create repository working agreement.
- [x] Select Nuxt + Supabase for the isolated Gate 0 spike; production choice remains conditional on results.
- [x] Re-scope the demo plan for October 28 as SPEC-002/TICKETS-002; school authorization and actual login tests remain open release gates.
- [x] Draft launch-specific `docs/SPEC-002-live-classroom-release.md` and `docs/TICKETS-002-live-release.md` (not implemented).
- [x] Confirm and submit bounded Gate 0 coding handoff to Antigravity IDE; the coding result exists. Independent review and fixes remain open before acceptance.
- [ ] Decide onboarding for ~200 real learners and confirm authority for roster use before launch.
- [ ] Obtain school IT confirmation for Google OAuth with student accounts and external hosting; test authorized student login.
- [x] Choose personal Google Cloud ownership for Classroom OAuth; draft `docs/SPIKE-001-school-google-login.md` (not yet executed).
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
