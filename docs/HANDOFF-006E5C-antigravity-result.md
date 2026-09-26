# Antigravity Handoff 006E5C Result — Failure-Boundary Diagnostic

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-26  
**Execution Scope:** Row A test-only diagnosis from `docs/HANDOFF-ANTIGRAVITY-006E5C-failure-boundary-diagnostic.md`, `docs/REVIEW-006E5B-gate0.md`, `docs/GATE0-AUTH-POLICY.md`, and `docs/GATE0-REMAINING-PLAN.md`. Strictly test-only diagnosis. Zero production code edits (`app/`, middleware, callback page, config), dependency changes, or commits. Preserved all dirty worktree changes; stopped for Hermes scope/policy review.

---

## 1. Executive Summary & Answer to Core Question

### Core Question:
> *After a callback's SDK exchange/setup has established or possibly changed local state, can a failed verification plus a failed/unknown local cleanup leave a later `/protected` visit admitting an ambiguous identity?*

### Diagnostic Finding: **YES (Vulnerability Confirmed; Policy Contracts Fail RED on Current Unchanged Code)**

1. **Failure-Boundary Behavior Under Current Unchanged Code:**
   - In `app/utils/auth.ts:384-392`, `quarantineLocalSession` invokes `client.auth.signOut({ scope: 'local' })` inside a `try ... catch` block that silently swallows exceptions. If `signOut` throws before completing local removal (e.g. storage lock, unhandled error) or is absent/unavailable on the client, local credentials remain persisted in storage (`inspectLocalSessionState(client)` remains `'confirmed_present'`).
   - In `app/utils/auth.ts:492-498` and `:543-549`, if `exchangeCodeForSession` or `setSession` mutated underlying SDK storage but returned an incomplete response (`{ data: { session: null, user: null }, error: null }`), the callback fails closed immediately **without calling `quarantineLocalSession`**. Storage remains `'confirmed_present'`.
   - On a subsequent deliberate SPA navigation or fresh document request to `/protected`, production middleware (`authMiddlewareHandler` in `app/middleware/auth.ts`) executes `auth.checkVerifiedUser()`. Because the session remains in storage, `client.auth.getUser()` verifies User B with the provider and **admits User B to `/protected` without redirection**.
   - Consequently, 5 policy stress contracts fail RED on unchanged production code.

2. **Repaired Checked-in Browser Diagnostic (All Controls & Contract GREEN):**
   - Repaired `tests/browser-diagnostic-006e5a.mjs`:
     - Control 1 now strictly asserts matching-positive verification delta > 0.
     - Contract 1 now strictly asserts explicit local-scope logout request count > 0 (`logoutRequests.length > 0`) and forbids global scope (`scope=global` count === 0).
     - Contract 1 now performs a deliberate SPA click from public home (redirects to `/?auth_required=true`), and **separately performs a fresh document request to `/protected`** (using `await page.goto(`${nuxtBaseUrl}/protected`)`), confirming SSR redirection to `/?auth_required=true` with no User A or User B displayed.
   - All 3 controls and Contract 1 pass GREEN in the browser runner against the current build.

3. **Passing Controls Preserved:**
   - Ordinary handled remote HTTP 500 on `signOut({ scope: 'local' })` correctly cleans up SDK storage via `GoTrueClient._signOut` and redirects to `/?auth_required=true`.
   - Pre-establishment `access_denied` preserves an independently valid older session B, re-verifying and admitting it on deliberate `/protected` navigation.
   - Incomplete SDK response with **no** new persistence preserves an older valid session B, re-verifying and admitting it.
   - Local session state inspection strictly classifies `confirmed_present`, `confirmed_absent`, and `unknown` (on error, thrown exception, or missing method).

---

## 2. Verification Metrics & Status

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **5-Auth-File Diff Hash (Baseline & Post-Task)** | `git diff -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3` (**Exact match, 0 production code changes**) |
| **Production Seam Isolation** | `git diff app/` | 0 | **Clean (0 production changes)** |
| **Production Build** | `npm run build` | 0 | Clean Nuxt + Nitro server build (3.18 MB) |
| **Browser Diagnostic (Controls Mode)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs controls` | 0 | **All 3 controls PASSED** |
| **Browser Diagnostic (Contract Mode)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs contract` | 0 | **Contract 1 PASSED (GREEN)** (Local logout > 0, global forbidden, SPA click redirected, fresh `/protected` SSR redirected) |
| **Browser Diagnostic (All Scenarios)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs all` | 0 | **3 controls PASSED, Contract 1 PASSED (100% GREEN)** |
| **Existing Browser Controls (006E2A)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e2.mjs` | 0 | **3 controls PASSED, 2 contracts PASSED (100% GREEN)** |
| **Focused 006E5A Vitest Suite** | `npx vitest run tests/diagnostic-006e5a.test.ts` | 0 | **9/9 passed (100% GREEN)** (Contract 1C assert updated) |
| **Focused 006E5C Failure-Boundary Suite** | `npx vitest run tests/diagnostic-006e5c.test.ts` | 1 | **4 controls PASSED, 5 expected RED policy contracts failed** |
| **Full Vitest Test Suite** | `npm run test` | 1 | **111 passed across 9 suites, 5 expected RED in `diagnostic-006e5c.test.ts`** |
| **ESLint Check** | `npm run lint` | 0 | 0 errors, 0 warnings |
| **Typecheck** | `npm run typecheck` | 0 | 0 errors |
| **Git Diff Whitespace Check** | `git diff --check` | 0 | Clean (exit code 0) |
| **Child Process Leak Check** | `ps aux \| grep -E "node /Users/nack/Classroom\|playwright" \| grep -v grep` | 1 | **0 matching processes (No owned process leaks)** |

---

## 3. Evidence Matrix

All cases exercise real `@supabase/supabase-js` `GoTrueClient` instances and real `@supabase/ssr` browser clients connecting to an ephemeral Node.js loopback HTTP Auth stub (`127.0.0.1`).

| Evidence Category | Test Case | Storage State Before & After | Route Verification on Unchanged Code | Classification & Status |
|---|---|---|---|---|
| **Policy Stress Case A1** | **PKCE `signOut` Throws Before Cleanup** | Before: `confirmed_absent` (0 keys). After: `confirmed_present` (User A token in storage). | `authMiddlewareHandler` calls `checkVerifiedUser()`, resolves User B with stub, and admits User B (`guardResult === undefined`, `user.id === 'user-B'`). | **EXPECTED RED** (`expected undefined to be '/?auth_required=true'`) |
| **Policy Stress Case A2** | **Token/Hash `signOut` Throws Before Cleanup** | Before: `confirmed_absent`. After: `confirmed_present` (User A token in storage). | `authMiddlewareHandler` resolves User B and admits User B (`guardResult === undefined`, `user.id === 'user-B'`). | **EXPECTED RED** (`expected undefined to be '/?auth_required=true'`) |
| **Policy Stress Case B1** | **`signOut` Method Absent / Unavailable** | Before: `confirmed_absent`. After: `confirmed_present` (User A token in storage). | `authMiddlewareHandler` resolves User B and admits User B (`guardResult === undefined`, `user.id === 'user-B'`). | **EXPECTED RED** (`expected undefined to be '/?auth_required=true'`) |
| **Policy Stress Case C1** | **PKCE Incomplete Response After Storage Change** | Before: `confirmed_absent`. After simulated write: `confirmed_present`. Callback returns error without quarantine. | `authMiddlewareHandler` resolves User B and admits User B (`guardResult === undefined`, `user.id === 'user-B'`). | **EXPECTED RED** (`expected undefined to be '/?auth_required=true'`) |
| **Policy Stress Case C2** | **Token/Hash Incomplete Response After Storage Change** | Before: `confirmed_absent`. After simulated write: `confirmed_present`. Callback returns error without quarantine. | `authMiddlewareHandler` resolves User B and admits User B (`guardResult === undefined`, `user.id === 'user-B'`). | **EXPECTED RED** (`expected undefined to be '/?auth_required=true'`) |
| **Passing Control 1** | **Handled Remote HTTP 500 on Local Sign-Out** | Before: `confirmed_present`. After: `confirmed_absent`. | `authMiddlewareHandler` fails verification and redirects to `/?auth_required=true`. | **PASS (GREEN)** |
| **Passing Control 2** | **Older Valid Session B + `access_denied`** | Before: `confirmed_present` (older session B). After: `confirmed_present` (older session B preserved). | `authMiddlewareHandler` re-verifies older session B with stub and allows access (`guardResult === undefined`, `user.id === 'user-older-101'`). | **PASS (GREEN)** |
| **Passing Control 3** | **Incomplete Response with NO New Persistence** | Before: `confirmed_present` (older session B). After: `confirmed_present` (older session B preserved). | `authMiddlewareHandler` re-verifies older session B with stub and allows access (`guardResult === undefined`, `user.id === 'user-older-101'`). | **PASS (GREEN)** |
| **Passing Control 4** | **Local Session State Inspection Classification** | Evaluates: (a) valid session object, (b) null session, (c) read error, (d) thrown exception, (e) missing method. | Strictly classifies: (a) `confirmed_present`, (b) `confirmed_absent`, (c) `unknown`, (d) `unknown`, (e) `unknown`. | **PASS (GREEN)** |

---

## 4. Repaired Browser Harness & Fresh `/protected` SSR Evidence

The browser test in `tests/browser-diagnostic-006e5a.mjs` was upgraded to fulfill all requirements of Handoff 006E5C:

1. **Matching-Positive Control (Control 1):**
   - Asserts that after returning to home and clicking `#test-protected-btn`, the verification delta is strictly > 0 (`vDelta = 1`).
   - Asserts page URL is `/protected`, displays "Authentication Verified", and displays `userA@rpr.ac.th`.
2. **Explicit Local-Scope Logout Assertion (Contract 1):**
   - Records all requests to `/logout` or `/auth/v1/logout` on the Auth stub.
   - Strictly asserts `localLogouts.length > 0` (`logoutRequests` with `scope=local`).
   - Strictly asserts `globalLogouts.length === 0` (forbidding `scope=global`).
3. **Deliberate SPA Click vs. Fresh Document SSR Request Separation (Contract 1):**
   - After the mismatch callback error is displayed and the user returns to `/`:
     - Step 4 executes a real client-side SPA navigation via `await page.click('#test-protected-btn')`.
     - SPA navigation redirects to `/?auth_required=true`. Content asserts no User A, no User B, and shows "Access Denied:".
     - Step 5 executes a **fresh document request** directly to `/protected` via `await page.goto(`${nuxtBaseUrl}/protected`)`.
     - Nuxt Nitro server SSR evaluates the incoming request cookies (which were wiped on callback).
     - SSR server redirects the request to `/?auth_required=true`.
     - Page content asserts no User A, no User B, and shows "Access Denied:".
4. **Process Cleanup & Log Sanitization:**
   - Chromium, Nuxt server process, and stub server are cleanly terminated via `finally { await cleanup() }`.
   - Zero leaked child processes confirmed via `ps aux`.
   - Zero raw tokens, codes, or cookies appear in test logs.

---

## 5. Architectural Analysis of Seam for Fail-Closed Unknown State

As required by Handoff 006E5C Section 3:
> *If a genuinely fail-closed unknown state requires changes outside `app/utils/auth.ts`, identify the minimal additional seam and risk, but do not implement it. STOP for Hermes scope/policy review; do not move to row B.*

### The Problem:
1. When `processAuthCallback` encounters an identity mismatch, it attempts `quarantineLocalSession(client)` calling `client.auth.signOut({ scope: 'local' })`.
2. If `client.auth.signOut` throws an unexpected exception, is unavailable, or if an incomplete SDK exchange leaves mutated storage without triggering quarantine:
   - `processAuthCallback` returns `{ success: false, error: '...', user: null }`.
   - `useAuth().handleCallback()` sets `authError.value` and in-memory `user.value = null`.
   - However, the underlying storage/cookies still contain the token established by the exchange.
3. Later, when the user deliberately visits `/protected`:
   - `authMiddlewareHandler` executes `auth.checkVerifiedUser()`.
   - `checkVerifiedUser()` calls `fetchVerifiedUser()` → `client.auth.getUser()`.
   - `getUser()` reads the un-cleared session from storage/cookies, dispatches a verification request to `/user`, receives 200 with User B, and restores `auth.user.value = { signedIn: true, id: 'user-B' }`.
   - `authMiddlewareHandler` sees `isAuthenticated = true` and admits the user.

### Seam Evaluation:
- **Can this be solved in `app/utils/auth.ts` alone?**
  - Inside `app/utils/auth.ts`, `processAuthCallback` can inspect local state via `await inspectLocalSessionState(client.auth)` after cleanup. If the state is not `'confirmed_absent'` (i.e. `'confirmed_present'` or `'unknown'`), it can attempt direct fallback storage removal (`client.auth.storage?.removeItem(...)`).
  - However, in SSR cookie contexts (e.g. `@supabase/ssr`), client storage is mediated through cookie headers/chunks. If `signOut` throws, `app/utils/auth.ts` does not have access to Nuxt's cookie event context (`useRequestEvent()`, `setCookie`) without importing Nuxt/composable runtime hooks.
  - Moreover, `app/utils/auth.ts:492-498` and `:543-549` (incomplete SDK response) can call `quarantineLocalSession` directly when `!data?.session || !data?.user`.
- **Minimal Additional Seam Outside `app/utils/auth.ts`:**
  - If storage cannot be guaranteed absent when cleanup fails or local state is `unknown`:
    1. **Seam in `app/composables/useAuth.ts`:**
       Track a session validity / callback quarantine flag in application state (e.g. `isQuarantined` or `quarantinedSessionToken`). If a callback attempt ended in an unverifiable/mismatched state with unconfirmed cleanup, `useAuth` records the quarantine marker.
    2. **Seam in `app/middleware/auth.ts`:**
       When evaluating `auth.checkVerifiedUser()`, the middleware verifies that the active session is not subject to an unconfirmed callback quarantine, or verifies that the session matches an expected established login.
- **Risk Analysis:**
  - Adding state tracking in `useAuth.ts` or `app/middleware/auth.ts` introduces state synchronization complexity across browser tabs, hard reloads, and SSR server requests (where cookie state is the sole source of truth).
  - A fallback cookie-clearing helper in `useAuth.ts` or an explicit cookie-clearing header during callback handling is the cleanest SSR-safe seam, but widens scope beyond `app/utils/auth.ts`.
  - **Decision:** As instructed, **no production code changes have been made**. STOPPED for Hermes scope and policy review.

---

## 6. STOP for Hermes Review

- Diagnostic task 006E5C is complete.
- Production code was strictly untouched (diff hash matches baseline `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3`).
- Dirty worktree strictly preserved.
- No commit, push, deployment, cloud operations, real accounts, or student data.
- **STOPPED for Hermes scope/policy review.**
