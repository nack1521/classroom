# TICKETS-002 — Live classroom release backlog

**Status:** Hermes plan; not submitted to Antigravity or implemented  
**Source:** `SPEC-002-live-classroom-release.md`  
**Implementer:** Antigravity IDE, one bounded task at a time  
**Reviewer/decision owner:** Hermes, with Nack deciding any institutional or account permission

## Gate 0 — OAuth feasibility spike (first IDE task)

**Outcome:** A tiny isolated Nuxt page can complete Google OAuth through Supabase with an authorized school test account, then show a safe signed-in state and sign out. Start with fake data; do not import a roster.

**Checks:** personal-project OAuth app uses a separate Classroom client; External audience; correct callback; secrets outside Git/chat; reload/session/logout work. A student-designated account is tested before treating the spike as proof for students. Record an access block instead of bypassing it.

**Stop condition:** after a working local/staging sign-in demo and check output, or at the first external-account/admin blocker. Do **not** continue into content models, roster handling, public deployment, or a full UI.

**Dependency:** Nack's approval for account configuration and for submitting this precise task to Antigravity. No secret values in the IDE handoff.

## Slice 1 — Teacher can publish a private course text article

**Outcome:** Teacher can sign in, create and reopen a draft, preview it, and publish to one configurable course offering. Drafts are not reader-visible.

**Checks:** explicit teacher role, validation, persistence, direct-URL draft denial, save failure, tests and independent review. Use fictitious accounts and data during implementation.

**Dependency:** Gate 0 result, project scaffolding and Git working agreement.

## Slice 2 — Enrolled learner can read; outsiders cannot

**Outcome:** One authorized student signs in and sees only published articles in their offering; a second nonmember and a visitor cannot read content by page/API URL.

**Checks:** real school login pilot with permission, enrollment mapping, server/RLS deny-by-default, wrong-course tests, sign-out/reload. Do not import all 200 yet.

**Dependency:** Slice 1 plus school OAuth/hosting decision.

## Slice 3 — Teacher can add teaching content with protected images

**Outcome:** Teacher inserts headings, link, code block, and an uploaded diagram/image; learner can read it on a phone while a nonmember cannot fetch the image.

**Checks:** editor round trip, image alt text, code whitespace, XSS rejection, private storage access, mobile/desktop demo. Use a ready-made editor component, not a full custom document editor.

**Dependency:** Slice 2.

## Slice 4 — Teacher-reviewed five-class enrollment and launch rehearsal

**Outcome:** Teacher reviews a protected import preview, resolves mismatches, confirms five course offerings and students, then a sample from each class can sign in and see only its own offering.

**Checks:** no real roster in chat/Git; duplicate/unmatched rows held for review; import dry-run and rollback; RLS/direct URL/media matrix; database/media backup and restore; quota and school-device rehearsal; documented teaching fallback.

**Dependency:** Slices 1–3 and explicit school authorization for external hosting/real records.

## After live reading is stable

Public articles, extra formatting controls, attendance, assignments, grades, co-authoring, and Directus/Kubernetes learning experiments. They must not preempt the October 28 reading/access release gate.

## Delegation protocol

Hermes writes the scoped ticket and evaluates trade-offs. Antigravity reads the repo instructions, implements **one** ticket, runs checks, and records evidence in a handoff file; it stops without deployment or scope expansion. Hermes independently reads the diff and test output and verifies behavior before approving the next ticket. Do not claim completion from an IDE-agent summary alone.
