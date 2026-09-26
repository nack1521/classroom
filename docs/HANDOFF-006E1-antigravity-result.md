# Antigravity Handoff 006E1 Result — Denied Callback with an Older Session Diagnostic

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Test-only diagnostic for Handoff 006E1. Strictly zero production source edits, configuration changes, or dependency additions. Preserved all existing dirty and untracked files.

---

## 1. Executive Summary & Answer to Core Question

### Core Question:
> When a user cancels a new Google OAuth attempt with `?error=access_denied`, does the *actual app path* deny this callback without silently revoking a separately valid older session, while allowing access to `/protected` only after a later **deliberate** navigation and independent verification?

### Diagnostic Finding: **YES.**
1. **Callback Denial Fails Closed Without Revocation:**
   - When `handleCallback('.../auth/callback?error=access_denied...')` executes through production `useAuth()`, it calls `processAuthCallback()`, extracts `access_denied`, and returns `success: false, error: 'OAuth sign-in was denied (access_denied)...', user: null`.
   - `auth.authError.value` receives the safe category and `auth.user.value` is reset to `null` to prevent false success continuation.
   - **Crucially, neither `processAuthCallback()` nor `handleCallback()` invokes `signOut()` or asserts remote revocation.**
   - The underlying persisted SDK session remains active and intact in storage (or session cookies).
2. **Deliberate `/protected` Navigation Re-Verifies Before Granting Access:**
   - When the user later deliberately visits `/protected`, the route reaches the production route middleware handler (`authMiddlewareHandler` from `app/middleware/auth.ts`).
   - Because `auth.user.value?.signedIn` is currently `null`, `authMiddlewareHandler` invokes `await auth.checkVerifiedUser()`.
   - `checkVerifiedUser()` calls `fetchVerifiedUser()` → `resolveVerifiedUser(client)` → `client.auth.getUser()`.
   - The request/browser SDK contacts the Auth server endpoint with the bearer token/cookie, which independently verifies the token.
   - Upon successful verification, `auth.user.value` is restored with the verified older user (`signedIn: true, id: 'user-older-101'`).
   - `authGuard` evaluates `isAuthenticated = true` and allows access without redirection.
3. **Negative Controls Fail Closed:**
   - If the older session is **absent**, `authMiddlewareHandler` checks verified user, finds no session, and redirects to `/?auth_required=true`.
   - If the older session is **forged/invalid**, `authMiddlewareHandler` re-verifies via `getUser()`, the Auth endpoint returns `401 Unauthorized`, verification fails (`verified: false`), `auth.user.value` remains `null`, and the route guard redirects to `/?auth_required=true`.

---

## 2. Verification Metrics & Status

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **Production 5-Auth-File Diff Hash (Pre-Task)** | `git diff --binary -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `2b50de1002c41ef3d18bc0bc01b42ec61a96887a8e714a9473f3b3161538cb75` |
| **Production 5-Auth-File Diff Hash (Post-Task)** | `git diff --binary -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `2b50de1002c41ef3d18bc0bc01b42ec61a96887a8e714a9473f3b3161538cb75` (**Exact match, 0 production code changes**) |
| **Focused 006E1 Diagnostic Tests** | `npx vitest run tests/diagnostic-handoff006e1.test.ts` | 0 | **9/9 passed (100% GREEN, exit code 0)** |
| **ESLint Check** | `npm run lint` | 0 | 0 errors |
| **Typecheck** | `npm run typecheck` | 0 | 0 errors |
| **Production Build** | `npm run build` | 0 | Clean Nuxt + Nitro node-server build |
| **Fresh-Build Full Test Suite** | `npm run test` | 0 | **87 passed across all 6 test files (100% GREEN, exit code 0)** |
| **Git Diff Whitespace / Conflict Check** | `git diff --check` | 0 | Clean (exit code 0) |

---

## 3. Three-Case Diagnostic Matrix

All three cases were tested against a live Node.js loopback HTTP server (`127.0.0.1`) acting as the Supabase Auth endpoint (`/auth/v1/user`), exercising real SDK HTTP request dispatching.

| Case | Older Session Fixture | Callback Action & Outcome | Deliberate `/protected` Navigation Outcome | Status |
|---|---|---|---|---|
| **1. Valid Older Session (Positive Control)** | Token `valid-older-token`; loopback stub returns HTTP 200 with `{ id: 'user-older-101', email: 'older101@rpr.ac.th' }`. | `handleCallback` with `?error=access_denied`: returns `success: false`, `user: null`, safe error message. Persisted SDK session remains active in storage. No sign-out executed. | `authMiddlewareHandler` invokes `checkVerifiedUser()`, SDK makes HTTP GET to stub with bearer token, identity is re-verified, `user.value` restored, access to `/protected` allowed (no redirect). | **PASS (Control Verified)** |
| **2. Absent Older Session (Negative Control 1)** | Empty storage / no cookie session. | `handleCallback` with `?error=access_denied`: returns `success: false`, `user: null`. | `authMiddlewareHandler` invokes `checkVerifiedUser()`, SDK finds no session, `user.value` remains `null`, middleware redirects to `/?auth_required=true`. | **PASS (Fail-Closed Verified)** |
| **3. Invalid/Forged Older Session (Negative Control 2)** | Token `forged-older-token`; loopback stub returns HTTP 401 (`Invalid JWT token`). | `handleCallback` with `?error=access_denied`: returns `success: false`, `user: null`. | `authMiddlewareHandler` invokes `checkVerifiedUser()`, SDK makes HTTP GET with forged bearer token, stub rejects with 401, verification fails, `user.value` remains `null`, middleware redirects to `/?auth_required=true`. | **PASS (Fail-Closed Verified)** |

---

## 4. Runtime Boundaries Tested & Reached

### Boundary 1: Composable & Route Middleware Handler Integration (VERIFIED)
- **Production Seams Exercised:**
  - `app/composables/useAuth.ts` (`handleCallback`, `checkVerifiedUser`, `fetchVerifiedUser`)
  - `app/middleware/auth.ts` (`authMiddlewareHandler`, `authGuard`)
  - Real `@supabase/supabase-js` `GoTrueClient` instance
  - Local HTTP loopback stub server (`127.0.0.1`) handling `/auth/v1/user`
- **Observations:**
  - `authMiddlewareHandler` does not blindly accept a pre-computed boolean; when `user.value?.signedIn` is absent, it executes the async verification chain.
  - The real GoTrueClient dispatches HTTP requests across loopback to the auth stub.
  - Calling `handleCallback` resets the in-memory `user.value` for that composable instance, but does not wipe persisted storage unless an explicit sign-out or session overwrite is performed.

### Boundary 2: Built Nuxt Production Server End-to-End SSR HTTP (VERIFIED)
- **Production Seams Exercised:**
  - Full Nuxt Nitro production server (`.output/server/index.mjs`) spawned as child process on a local port
  - Real HTTP requests via `http.request`
  - Request-scoped server client (`app/utils/supabaseClient.ts:38` `createServerClient`) parsing cookies from H3 request events
  - Default Nuxt route middleware registered via `defineNuxtRouteMiddleware`
- **HTTP Evidence:**
  1. `GET /auth/callback?error=access_denied&error_description=Denied`: returns HTTP 200 (renders callback card, does not issue HTTP 302 redirect).
  2. `GET /protected` with valid session cookie: returns HTTP 200, response body contains `older101@rpr.ac.th`.
  3. `GET /protected` with absent cookie: returns HTTP 302 redirect with `Location: /?auth_required=true`.
  4. `GET /protected` with forged session cookie: returns HTTP 302 redirect with `Location: /?auth_required=true`, stub records 401 rejection.
  5. `GET /` with valid session cookie: returns HTTP 200 without redirect, no error alerts.
- **Architectural Discovery on Public Route SSR:**
  - Route middleware `auth.ts` is explicitly attached to `/protected` via `definePageMeta({ middleware: ['auth'] })`, but is **not** attached to `/`.
  - In `app/app.vue`, `initAuth()` is invoked inside `onMounted(() => initAuth())`, which executes only in the browser client during hydration, not during SSR.
  - Consequently, on `GET /`, initial SSR HTML renders the visitor view, and client hydration resolves the session. On `/protected`, route middleware forces server-side cookie verification during SSR, rendering the verified identity directly into the initial HTML.

### Boundary 3: Browser DOM Rendering & Interactive Click-Navigation (UNVERIFIED)
- **Seams Not Reached:**
  - Real browser DOM event dispatch (clicking links/buttons, client-side Vue router transitions).
  - Vitest environment uses Happy-DOM without `@vitejs/plugin-vue` for compiling `.vue` Single File Components directly.
  - `package.json` contains no browser automation drivers (`playwright` or `puppeteer`). Running Playwright would require installing unapproved dependencies from npm, violating the strict task constraints.
- **Status:** **UNVERIFIED.** In accordance with Handoff 006E1 line 13:
  > *"If deterministic old-session browser setup is blocked, explain exactly why and mark that branch UNVERIFIED; do not replace the SDK with a hand-written mock and claim the real boundary passed."*
  This branch is formally marked UNVERIFIED and reserved for external browser/Playwright verification.

---

## 5. Changed Files List

| File Path | Description |
|---|---|
| `tests/diagnostic-handoff006e1.test.ts` | New focused diagnostic test suite (9 tests covering 3 cases across Composable+Middleware handler, Built Server SSR HTTP, and boundary characterization). |
| `docs/HANDOFF-006E1-antigravity-result.md` | This result document. |

---

## 6. Stop for Hermes Review

All checks specified in Handoff 006E1 have been completed. No production source, configurations, or packages were modified. No commits, pushes, deployments, or real accounts were used. Stopping execution for Hermes independent review.
