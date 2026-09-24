# Antigravity handoff 003 — Finish Gate 0 auth verification

**Destination:** Antigravity IDE Agent panel, workspace `/Users/nack/Classroom`  
**Status:** Submitted to Antigravity after Nack confirmed; Antigravity reported completion in `HANDOFF-003-antigravity-result.md`. Hermes independent review is recorded in `REVIEW-003-gate0.md` (Gate 0 not yet accepted).  
**Scope:** Correct only the review-002 blocker and the missing integration evidence. No accounts, student data, deployment, Git commit/push, course features, or unrelated refactor.

## Prompt after confirmation

Read `docs/REVIEW-002-gate0.md`, `docs/HANDOFF-ANTIGRAVITY-002.md`, the current auth code/tests, and Git status. Preserve all unrelated and untracked changes.

1. Fix `app/composables/useAuth.ts` so its `onAuthStateChange` subscriber never **awaits** a Supabase call from within the auth callback. The installed auth-js notification awaits subscribers; calling `getUser()` inside can deadlock the auth lock. Schedule verified-user synchronization only after the callback returns, with error handling and stale-event/race handling (e.g. a later SIGNED_OUT must not be overwritten by a pending SIGNED_IN verification). Do not trust `getSession().user` for authorization.
2. Replace the misleading “Request-Scoped Server SSR Guard Integration” tests in `tests/regression-review001.test.ts` with a real request/cookie-boundary test: at minimum exercise the Nuxt/H3 request-scoped client adapter and verified-user guard using synthetic cookie/session and a stubbed Auth endpoint/client; best is a local HTTP request to the built app. Demonstrate authenticated request -> protected content, absent/invalid cookie -> redirect, and separate requests do not share identity. A pure `authGuard(..., true)` assertion alone is insufficient. No genuine school account or secret needed. If that harness cannot be built, state the exact limitation and do not claim the SSR reload criterion passed.
3. Add an event-flow regression test proving the auth-state callback returns without waiting for a reentrant Supabase call; assert subsequent auth calls settle. Keep tests genuinely connected to the production path, not a copied helper with boolean inputs.

Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and local unauthenticated routes. Report changed files, commands/results, synthetic-vs-real evidence, and residual blockers in `docs/HANDOFF-003-antigravity-result.md`. Do not claim an actual Google round-trip or authenticated browser reload without authorized external configuration. Stop after this bounded task.

Reference: official Supabase async auth-callback deadlock note at `https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0`.
