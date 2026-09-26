# HANDOFF-006F — Local Gate 0 Evidence Pass Diagnostic Result

**Date:** 2026-09-26  
**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Status:** **COMPLETE (TEST-ONLY PASS)** — Stopped for Hermes review. Gate 0 remains **NOT PASSED** pending authorized live Google OAuth pilot.  
**Baseline Diff Hash:** `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3` across `app/composables/useAuth.ts`, `app/middleware/auth.ts`, `app/pages/auth/callback.vue`, `app/utils/auth.ts`, `app/utils/supabaseClient.ts` (VERIFIED UNCHANGED).

---

## 1. Executive Summary & Verdicts

This diagnostic pass executes Handoff 006F strictly as a **test-only** verification pass answering three separate remaining local questions without speculative production modifications, schema changes, real accounts, or commits.

| Area | Scope & Boundary | Mode | Verdict | Summary |
|---|---|---|---|---|
| **Row A1 (Supported Integration)** | Real `@supabase/ssr` `createBrowserClient` / `createServerClient` cookie flows | Real SDK / Adapter | **GREEN** | Ordinary mismatch clears cookies locally (`scope: 'local'`); deliberate SPA and SSR `/protected` fail closed; older valid session survives `access_denied` and is admitted. |
| **Row A2 (Adapter Failure)** | Credible failure at storage/cookie adapter (e.g., cookie write/remove failure during local quarantine) | Real SDK / Adapter | **RED (Policy Blocker)** | If cookie adapter fails to remove session on local sign-out, storage retains ambiguous token, `/user` resolves to User B, and middleware fails open (`guardResult` undefined). |
| **Row B (Real-SDK Event Race)** | Real SDK `SIGNED_IN` event through installed client with deferred in-flight `getUser()` held on network, followed by `signOut()` before release | Real SDK / Stub Network | **GREEN** | Real SDK `onAuthStateChange` listener fired; held deferred verification completed after sign-out was dropped via `isStale()`; `user.value` remained null. Uninterrupted positive control passed. |
| **Row C (Rendered Success & Nav)** | Fresh built Nuxt server + controlled loopback Auth + Playwright Chromium | Real Browser / Built Server | **GREEN** | Matching callback visibly rendered `.state-success`, automatically navigated to `/protected` via `callback.vue` `setTimeout` without clicking, and persisted across hard reload. Negative callbacks rendered safe notices with no protected link and no auto-continuation. |
| **Stress Suite (006E5C)** | 5 fault-injected hardening cases + 4 controls in `tests/diagnostic-006e5c.test.ts` | Fault-Injection Stress | **4 PASS / 5 SKIPPED** (default)<br>**4 PASS / 5 RED** (`GATE0_STRESS=1`) | Explicitly classified; all 5 fail on pure fail-closed contract (`expect(guardResult).toBe('/?auth_required=true')`) without broken-state assertions. |

---

## 2. Row A: Supported Integration & Cookie Adapter Diagnostic

**Test File:** `tests/diagnostic-006f-row-a.test.ts`

### Row A1: Supported Integration (Real Cookie Flows) — GREEN
- **Browser Client (`createBrowserClient`):**
  - Cookie jar initialized; PKCE code verifier cookie written.
  - Code exchange executed against controlled loopback `/token` (issued for User A).
  - Verification against `/user` returned contradictory identity User B (identity mismatch).
  - Callback reported `success: false` with safe error `'Authentication failed: OAuth session identity could not be verified.'`.
  - Production `quarantineLocalSession` executed `client.auth.signOut({ scope: 'local' })`.
  - Cookie persistence check: session cookie was completely removed by `@supabase/ssr` (`cookieJar[storageKey]` is `undefined`).
  - Deliberate SPA visit to `/protected` checked via `checkRouteAccess`: `allowed: false`, redirected to `/`.
- **Server Client (`createServerClient`):**
  - Simulated request-scoped H3 event cookies.
  - Callback mismatch processed: cookies cleared.
  - Fresh SSR request to `/protected` via `authMiddlewareHandler`: redirected to `/?auth_required=true`.
- **Positive Policy Control (Older Session + `access_denied`):**
  - Valid older session (`older101@rpr.ac.th`) stored in cookie jar.
  - Pre-establishment callback denial: `/auth/callback?error=access_denied`.
  - Callback returned `success: false` with denial notice.
  - Older session cookie preserved intact (0 logout requests executed).
  - Deliberate `/protected` visit re-verified against `/user` and admitted `older101@rpr.ac.th` (`checkRouteAccess` allowed: true).

### Row A2: Credible Adapter Failure — RED (Policy Blocker)
- **Credible Failure Scenario:** Real-world adapter failure where cookie removal is obstructed (e.g. committed response headers in SSR, read-only cookie attribute, or blocked storage deletion).
- **Observed Behavior:**
  - Code exchange establishes session for User A.
  - Identity mismatch detected; `quarantineLocalSession` attempts `client.auth.signOut({ scope: 'local' })`.
  - Adapter fails to delete the cookie, leaving the cookie in storage.
  - Later deliberate `/protected` visit reads the retained session and re-verifies via `client.auth.getUser()`.
  - `/user` endpoint resolves to User B.
  - Production `authMiddlewareHandler` sees verified identity and **fails open** (`guardResult` is `undefined` instead of `/?auth_required=true`).
  - **Verdict:** Reproducible RED/blocker under adapter failure conditions. Runnable via `GATE0_STRESS=1 npx vitest run tests/diagnostic-006f-row-a.test.ts`.

---

## 3. Row B: Real SDK Auth Event Race Diagnostic

**Test File:** `tests/diagnostic-006f-row-b.test.ts`

- **Execution Boundary:**
  - Real `GoTrueClient` instance created with local storage.
  - Production `useAuth().initAuth()` initialized client event listener:
    ```typescript
    client.auth.onAuthStateChange((event, session) => {
      authHandler(event, session)
    })
    ```
  - Sync listener schedules deferred verification via `createSafeAuthStateHandler`.
  - Network request to `/auth/v1/user` held in flight by stub server hook (`holdUserVerification = true`).
  - While verification was in flight on the network, executed production `useAuth().signOut()`.
  - Released held network response (`200 OK` with `{ id: 'user-A', email: 'userA@rpr.ac.th' }`).
  - `createSafeAuthStateHandler` evaluated `isStale()`: evaluated to `true` due to sequence increment and `stateGeneration` update.
  - **Result:** Stale verification was dropped. `auth.user.value` remained `null` (not restored).
- **Uninterrupted Positive Control:**
  - Real `SIGNED_IN` event fired through installed client without interruption.
  - Deferred verification resolved against `/auth/v1/user`.
  - `auth.user.value` successfully populated with `userA@rpr.ac.th` (`signedIn: true`).
- **Guardrails Observed:**
  - Real SDK event subscriber exercised; `createSafeAuthStateHandler` was NOT called manually.
  - No async SDK calls placed inside the `onAuthStateChange` callback.

---

## 4. Row C: Rendered Successful Callback & Automatic Navigation Diagnostic

**Test File:** `tests/browser-diagnostic-006f-row-c.mjs`  
**Harness:** Fresh built Nuxt server (`.output/server/index.mjs`) + controlled loopback Auth + Playwright Chromium.

- **Scenario 1: Matching Exchange & Rendered Success UI & Auto-Navigation & Hard Reload (PASS)**
  - Navigated to `/auth/callback?code=matching-code-a`.
  - Verified DOM rendered `.state-success`:
    - Heading: `"Authentication Succeeded"`
    - User display: `"Identity established for userA@rpr.ac.th"`
    - Redirect hint: `"Redirecting to protected classroom route..."`
    - Success button: `<NuxtLink to="/protected" class="btn btn-primary">Continue to Protected Area</NuxtLink>`
  - **Automatic Navigation:** Without clicking any button, waited for `callback.vue`'s `setTimeout(() => router.push('/protected'), 1200)`.
  - Browser automatically navigated to `/protected`.
  - `/protected` route rendered `"Authentication Verified"` and `"userA@rpr.ac.th"`.
  - **Hard Reload Persistence:** Reloaded `/protected` document (`page.reload()`).
  - Path remained `/protected`, verified identity remained `"userA@rpr.ac.th"`.
- **Scenario 2: Provider Denial (`access_denied`) (PASS)**
  - Navigated to `/auth/callback?error=access_denied&error_description=Consent+denied`.
  - Rendered `.state-error` with safe notice: `"OAuth sign-in was denied (access_denied). Please verify permissions and try again."`.
  - `.state-success` count: 0.
  - Callback card link to `/protected`: 0.
  - `Return to Public Home` link present.
  - Waited 1600ms: page remained on `/auth/callback` (no auto-navigation).
- **Scenario 3: Invalid Authorization Code (PASS)**
  - Navigated to `/auth/callback?code=invalid-code-123`.
  - Rendered `.state-error` with safe notice: `"Failed to exchange authorization code: Authentication provider rejected the authorization code."`.
  - No `.state-success`, no protected link, no auto-navigation after 1600ms.
- **Scenario 4: Identity Mismatch (PASS)**
  - Navigated to `/auth/callback?code=mismatch-code-1`.
  - Rendered `.state-error` with safe notice: `"Authentication failed: OAuth session identity could not be verified."`.
  - No `.state-success`, no protected link, no auto-navigation after 1600ms.
- **Hygiene & Redaction:** No raw tokens or internal code verifiers logged or printed in DOM. Zero lingering server or browser processes.

---

## 5. Stress-Suite Accounting (006E5C Fault-Injection Cases)

**Test File:** `tests/diagnostic-006e5c.test.ts`

1. **Default Test Profile (`npm run test`):**
   - 4 Controls: **PASSED** (Remote 500 local cleanup, older session preservation, incomplete response without storage change, session state classification).
   - 5 Policy Stress Cases: **SKIPPED** via `const itStress = process.env.GATE0_STRESS ? it : it.skip`.
   - Exit Code: **0**.
2. **Stress Mode (`GATE0_STRESS=1 npx vitest run tests/diagnostic-006e5c.test.ts`):**
   - 4 Controls: **PASSED**.
   - 5 Policy Stress Cases: **FAILED (RED)** as pure fail-closed contracts:
     - Case A1 (PKCE throw before cleanup): `AssertionError: expected undefined to be '/?auth_required=true'`
     - Case A2 (Token throw before cleanup): `AssertionError: expected undefined to be '/?auth_required=true'`
     - Case B1 (Method absent wrapper): `AssertionError: expected undefined to be '/?auth_required=true'`
     - Case C1 (PKCE incomplete response after simulated persistence): `AssertionError: expected undefined to be '/?auth_required=true'`
     - Case C2 (Token incomplete response after simulated persistence): `AssertionError: expected undefined to be '/?auth_required=true'`
   - Exit Code: **1**.
   - Broken-state intermediate assertions (`auth.user.value.id === 'user-B'`) remain removed.

---

## 6. Verification Metrics & Reproduction Commands

### Command Suite

1. **Fresh Build:**
   ```bash
   npm run build
   ```
   *Result:* Clean Nitro production server bundle in `.output/server/index.mjs` (exit 0).

2. **Full Default Test Suite:**
   ```bash
   npm run test
   ```
   *Result:* 12 test files passed, 116 passed, 6 skipped (5 006E5C stress + 1 Row A2 stress), 0 failures (exit 0).

3. **Row A Focused Diagnostic:**
   ```bash
   npx vitest run tests/diagnostic-006f-row-a.test.ts
   GATE0_STRESS=1 npx vitest run tests/diagnostic-006f-row-a.test.ts
   ```
   *Result:* Default 3 passed / 1 skipped (exit 0). Stress mode: 3 passed / 1 failed RED (exit 1).

4. **Row B Focused Diagnostic:**
   ```bash
   npx vitest run tests/diagnostic-006f-row-b.test.ts
   ```
   *Result:* 2 passed / 0 failed in 544ms (exit 0).

5. **Row C Browser Regression Diagnostic:**
   ```bash
   node tests/browser-diagnostic-006f-row-c.mjs
   ```
   *Result:* All 4 scenarios passed (exit 0).

6. **Prior Browser Diagnostics:**
   ```bash
   node tests/browser-diagnostic-006e5a.mjs all
   node tests/browser-diagnostic-006e2.mjs all
   ```
   *Result:* Both browser suites pass 100% controls and contracts (exit 0).

7. **Stress-Suite Run:**
   ```bash
   GATE0_STRESS=1 npx vitest run tests/diagnostic-006e5c.test.ts
   ```
   *Result:* 4 passed, 5 RED (exit 1).

8. **Code Quality & Integrity Checks:**
   ```bash
   npm run lint
   npm run typecheck
   git diff --check
   git diff HEAD -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts | shasum -a 256
   ```
   *Result:* Lint clean (0 errors), Typecheck clean (0 errors), git diff --check clean, Hash: `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3`.

9. **Process Hygiene:**
   ```bash
   ps aux | grep -E "node.*\.output/server|chromium|playwright" | grep -v grep
   ```
   *Result:* Empty (no orphaned processes).

---

## 7. Hermes Review Checkpoint

- All requested evidence for Rows A, B, C, and stress accounting is recorded above.
- The dirty worktree is intact.
- Production code was not touched.
- Gate 0 is NOT claimed as passed.
- Stopping execution for Hermes review.
