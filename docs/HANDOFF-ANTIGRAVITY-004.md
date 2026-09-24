# Antigravity handoff 004 — Close Gate 0 local auth gaps

**Workspace:** `/Users/nack/Classroom`  
**Status:** Prepared for Nack's review; **not submitted to IDE**.  
**Source of truth:** `docs/REVIEW-003-gate0.md`, `docs/HANDOFF-ANTIGRAVITY-003.md`, current auth code and tests. All files are currently untracked; preserve unrelated work.

## Goal

Remove the proven stale-auth and callback false-success bugs, and produce honest evidence at the actual SSR request/cookie/middleware boundary. This is still a local auth spike, **not** a claim that school Google OAuth, enrollment, RLS, or a student rollout works.

## Required corrections and acceptance evidence

1. **Race-safe identity state (`app/composables/useAuth.ts`, `app/utils/auth.ts`).** The `onAuthStateChange` subscriber must remain synchronous and make no in-callback Supabase call. `verifyFn` for the deferred event must not write `user.value` before the generation/cancellation check. A slow `SIGNED_IN` verification followed by `SIGNED_OUT` and then completion of the old verification must leave user state null. Exercise the *production composable wiring* in a test, not only the pure helper with a side-effect-free mock. Check the same stale-write hazard in initialization and direct verification paths; don't replace verified `getUser()` with untrusted `getSession().user`.
2. **Truthful OAuth callback (`app/utils/auth.ts`, `app/composables/useAuth.ts`, `app/pages/auth/callback.vue`).** A provider error always wins over an old session. A direct visit, empty/invalid `code`, or token-marker text alone must not be reported as a fresh successful OAuth flow just because a prior user is verified. Tie success to the actual PKCE exchange or a documented library-managed flow result; avoid exchanging the same code twice. Cover success and exchange-failure cases with an old session, using synthetic accounts and a controlled/mock Auth service. Do not claim a live Google login from mocks.
3. **Real SSR boundary evidence.** Replace `tests/regression-review001.test.ts:127-241`/`tests/review002-integration.test.ts:133-175` tests that merely construct unused cookie events or supply a hand-made auth client to an unused helper. Exercise the **production** `app/middleware/auth.ts` → `useAuth()` → `getSupabaseClient` request-scoped cookie adapter → `auth.getUser()` path, preferably through built-app HTTP requests with a controlled local Auth stub. Show valid synthetic session/cookie allows `/protected`, missing and invalid cookies redirect, and separate requests cannot share identity. A cookie fixture is meaningful only if it reaches the client and changes Auth verification; the test must fail if the cookie is removed, tampered, or swapped between requests. If full integration cannot be implemented locally, state exactly which boundary remains untested and do not label it proven.

## Constraints

No real account, roster, student identifiers, secrets, Google Cloud/Supabase dashboard changes, deploy, Git commit/push, unrelated features or refactor. Keep Nuxt SSR and the existing stack. Follow repo instructions and preserve all dirty/untracked files. Add a test dependency only if justified for the production-boundary harness. Never log tokens, passwords, or cookie values.

## Verification and handoff

Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build` and probe `/`, unauthenticated `/protected`, `/auth/callback` against a fresh local production server (stop it afterward). Report changed files, concrete test evidence (including a regression that was red before the fix and green afterward), limitations, and synthetic-vs-real status in `docs/HANDOFF-004-antigravity-result.md`. Stop for Hermes's independent review. Gate 0 local review is not finished until Hermes reproduces the behavior; a school-authorized student-account OAuth round-trip and authenticated browser reload remain separate external gates.
