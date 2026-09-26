# Gate 0 correction result 005 — Antigravity

**Date:** 2026-09-25  
**Branch:** `fix/gate0-auth`  
**Working tree status:** Uncommitted changes ready for Hermes's independent review. No git commits or pushes made.

---

## 1. Summary of Actions Taken

In accordance with [docs/HANDOFF-ANTIGRAVITY-005.md](file:///Users/nack/Classroom/docs/HANDOFF-ANTIGRAVITY-005.md) and [docs/REVIEW-004-gate0.md](file:///Users/nack/Classroom/docs/REVIEW-004-gate0.md), Antigravity completed the bounded auth corrections and verification:

1. **OAuth Callback Single-Ownership & Truthful Verification:**
   - Completely eliminated the process-global `processedCodes` Set in [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts).
   - Enforced strict validation of exchange responses:
     - If `exchangeCodeForSession()` returns `{ data: { session: null, user: null }, error: null }`, it is immediately rejected as an invalid exchange and never falls back to any pre-existing verified session.
     - If an authorization code is reused on another client, exchange fails and client B's old session is never returned.
     - If hash fragment tokens arrive without `setSession` or if `setSession` fails, the callback immediately rejects and never adopts the previous user.
     - Tokens, refresh tokens, and authorization codes are strictly scrubbed from error reporting and logs.
   - Configured `createBrowserClient` with `{ auth: { detectSessionInUrl: false } }` in [app/utils/supabaseClient.ts](file:///Users/nack/Classroom/app/utils/supabaseClient.ts) so the application's callback page is the sole, explicit owner of PKCE code exchange, eliminating client initialization auto-exchange races.

2. **State Invalidation Across Sign-Out & Auth Events:**
   - Updated [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts) `createSafeAuthStateHandler` to check generation freshness (`getGeneration() !== startGen || sequence !== startSeq`) before scheduling, before execution, and before invoking `onUserVerified`.
   - Wired production [app/composables/useAuth.ts](file:///Users/nack/Classroom/app/composables/useAuth.ts) to pass `() => stateGeneration.value` to `createSafeAuthStateHandler`.
   - Established an explicit, honest sign-out policy:
     - `stateGeneration` is incremented immediately at the start of `signOut()`, invalidating any background verification that has **already started** before sign-out.
     - If `client.auth.signOut()` succeeds, `user.value` is cleared to `null` and the user is redirected to `/`.
     - If `client.auth.signOut()` fails on the provider, `user.value` is **retained intact** (honestly reflecting that the persisted session remains active on the provider), `signOutError` is visibly populated, and no silent redirect occurs.
   - Added automated tests proving:
     - An auth event verification that has already begun execution (`getUser()` in-flight) cannot restore `user.value` after `signOut()` even when no `SIGNED_OUT` notification arrives.
     - Failed sign-out preserves `user.value` and reports the error visibly.

3. **Complete SSR Integration Proof & Built Nuxt Production Server Testing:**
   - Updated [nuxt.config.ts](file:///Users/nack/Classroom/nuxt.config.ts) with `experimental: { asyncContext: true }` so Nuxt route middleware retains asynchronous context across `await checkVerifiedUser()`, enabling clean 302 redirects without `[NUXT_E1001]` context loss.
   - Refactored [tests/regression-review001.test.ts](file:///Users/nack/Classroom/tests/regression-review001.test.ts) to remove all hand-written mock auth objects. All SSR middleware tests now traverse the production `authMiddlewareHandler` -> production `useAuth(event)` -> request-scoped client -> `resolveVerifiedUser()` -> local HTTP Auth stub.
   - Added automated tests verifying that separate concurrent SSR requests maintain isolated identities without cross-contamination.
   - Added end-to-end SSR tests in [tests/regression-review001.test.ts](file:///Users/nack/Classroom/tests/regression-review001.test.ts) that spawn the built Nuxt production server (`.output/server/index.mjs`) against the local HTTP Auth stub, verifying real network HTTP requests:
     - Unauthenticated `/protected` -> 302 Found (`/?auth_required=true`)
     - Valid cookie `/protected` -> 200 OK with rendered student identity
     - Forged cookie `/protected` -> 302 Found (`/?auth_required=true`)
     - Concurrent overlapping HTTP requests -> 200 OK with strictly isolated identities.

4. **Whitespace & Diff Hygiene:**
   - Fixed the trailing blank line at EOF in [tests/review002-integration.test.ts](file:///Users/nack/Classroom/tests/review002-integration.test.ts).
   - Verified `git diff --check` passes with 0 warnings.
   - Preserved all existing untracked/dirty files, including Hermes's [PLANNING_PAPER.md](file:///Users/nack/Classroom/PLANNING_PAPER.md) and review documents.

---

## 2. Verification Evidence

### Automated Test Suite (`npm run test`)
```
 RUN  v5.0.1 /Users/nack/Classroom

 ✓ tests/auth.test.ts (14 tests)
 ✓ tests/middleware.test.ts (3 tests)
 ✓ tests/review002-integration.test.ts (13 tests)
 ✓ tests/regression-review001.test.ts (15 tests)

 Test Files  4 passed (4)
      Tests  45 passed (45)
   Duration  779ms
```

### Static Analysis & Build Checks
- `npm run lint`: **0 errors, 0 warnings** (exit code 0).
- `npm run typecheck`: **0 TypeScript errors** (exit code 0).
- `npm run build`: Client, Server, and Nitro output successfully built into `.output/` (exit code 0).
- `git diff --check`: **0 whitespace errors or warnings** (exit code 0).

### Fresh Built-Server HTTP Probes
Conducted against `.output/server/index.mjs` running with local HTTP Auth stub (server stopped immediately after probes):
```json
{
  "root": {
    "status": 200
  },
  "unauthenticated_protected": {
    "status": 302,
    "location": "/?auth_required=true"
  },
  "valid_cookie_protected": {
    "status": 200,
    "bodyContainsEmail": true
  },
  "forged_cookie_protected": {
    "status": 302,
    "location": "/?auth_required=true"
  },
  "callback_page": {
    "status": 200
  }
}
```

---

## 3. Changed Files

- [nuxt.config.ts](file:///Users/nack/Classroom/nuxt.config.ts): Added `experimental: { asyncContext: true }`.
- [app/utils/supabaseClient.ts](file:///Users/nack/Classroom/app/utils/supabaseClient.ts): Added `{ auth: { detectSessionInUrl: false } }` to `createBrowserClient`.
- [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts):
  - Removed process-global `processedCodes`.
  - Added strict session/user existence checks on code exchange and hash token setup.
  - Added generation and sequence freshness checks in `createSafeAuthStateHandler`.
- [app/composables/useAuth.ts](file:///Users/nack/Classroom/app/composables/useAuth.ts):
  - Passed `() => stateGeneration.value` to `createSafeAuthStateHandler`.
  - Updated `signOut()` to retain `user.value` on remote failure and invalidate in-flight verifications.
- [app/middleware/auth.ts](file:///Users/nack/Classroom/app/middleware/auth.ts): Cleaned default route middleware to invoke `useAuth()` and standard `authMiddlewareHandler`.
- [tests/review002-integration.test.ts](file:///Users/nack/Classroom/tests/review002-integration.test.ts):
  - Added tests for reused code failure, missing session failure, and hash `setSession` failure without adopting old sessions.
  - Added test verifying in-flight verification already started cannot restore state after `signOut()`.
  - Added test verifying sign-out failure preserves `user.value` and reports error.
  - Cleaned EOF newline.
- [tests/regression-review001.test.ts](file:///Users/nack/Classroom/tests/regression-review001.test.ts):
  - Updated SSR middleware tests to use production `useAuth(event)`.
  - Added built Nuxt server end-to-end SSR HTTP tests.
- [vitest.config.ts](file:///Users/nack/Classroom/vitest.config.ts): Defined `import.meta.client: true` for happy-dom test runner.

---

## 4. Synthetic vs. Real Boundaries & Remaining Gates

- **What was proven locally:**
  - Complete SSR pipeline: HTTP Cookie -> Nitro Node server -> `app/middleware/auth.ts` -> production `useAuth(event)` -> request-scoped client -> local HTTP Auth stub -> 302 redirect / 200 render.
  - Zero cross-contamination between concurrent overlapping requests.
  - Rejection of reused, forged, or missing credentials.
  - Invalidation of race conditions across sign-out and auth event streams.
- **What remains external / unproven (real-world gates):**
  - **Live Google Cloud OAuth:** No real Google OAuth client ID/secret, redirect URI whitelist in Google Cloud Console, or school domain restriction policy (`hd=rpr.ac.th`) has been executed against live Google servers.
  - **Live Supabase Project:** No live Supabase project, service keys, dashboard configuration, or database RLS policies have been touched.
  - **Real Student Data & Production Deployment:** Zero real school roster or student data was loaded; no cloud deployment was attempted.

---

## 5. Next Step

All bounded implementation and verification requirements of Handoff 005 are complete. Antigravity has stopped here for Hermes's independent review.
