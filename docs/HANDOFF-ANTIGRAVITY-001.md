# Antigravity handoff — Gate 0: school Google OAuth spike

**Destination:** Antigravity IDE agent panel, workspace `/Users/nack/Classroom`  
**Submission:** Sent to the Antigravity IDE Agent panel on 2026-09-24 after Nack confirmed; IDE showed the request and began working. Implementation and verification are pending.  
**No account authorization is conveyed by this file.**

## Prompt to send once confirmed

Work only in `/Users/nack/Classroom`. Read `PLANNING_PAPER.md`, `docs/ADR-001-stack-and-launch.md`, `docs/SPEC-002-live-classroom-release.md`, `docs/TICKETS-002-live-release.md`, and `docs/SPIKE-001-school-google-login.md` first. Inspect the actual workspace; it currently contains planning documents and may not yet be a Git repository. Preserve all existing files and user changes.

Implement **only Gate 0's local coding part**: a minimal Nuxt + TypeScript app with Supabase Google OAuth sign-in, callback/session handling, sign-out, and a safe signed-in indicator. Add a route accessible only after login and one public route. Set up local Git/branch practices only if safe in the current workspace; do not commit or push without Nack's explicit request. Keep auth configuration in untracked local environment variables; provide an example with names only, no values.

Scope constraints:
- Do not create or alter Google Cloud/Supabase projects, OAuth client settings, billing, domain, or school admin policy; report the exact external setup values needed (e.g. callback URI) for a human-assisted step later.
- Do not accept or print passwords, OAuth tokens, client secrets, real student identifiers, or roster data; do not add secrets to Git or chat. Avoid logging Server Action/form arguments containing auth material in development output.
- Do not build course schema, import roster, add editor, public deployment, or unrelated features. No real student login attempt without Nack at the keyboard and school-authorized test account.
- A UI domain check or OAuth `hd` hint does not authorize course access. This spike proves only identity flow, not full classroom access.

Evidence required:
- Tests for callback/session guard and sign-out behavior where practicable. Run actual local check commands (tests, lint, typecheck, build), report exact results and limitations.
- Verify the app starts locally and show the unauthenticated route/guard; mark Google round-trip **blocked pending OAuth/Supabase configuration** if those external credentials are absent. Do not fabricate a successful Google login.
- Write a short handoff at `docs/HANDOFF-001-antigravity-result.md`: changed files, commands/results, known blockers, required external configuration (without secret values), and next manual verification steps. Stop after this bounded task.

Hermes will independently inspect the diff/handoff, run checks, and approve the next ticket. Do not mark the live release done.
