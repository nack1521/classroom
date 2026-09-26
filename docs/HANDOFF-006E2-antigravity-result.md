# Antigravity Handoff 006E2 Result — Browser Regression for Stale Auth on SPA Navigation

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Strictly test-only browser regression diagnostic for Handoff 006E2. Zero production code edits, zero configuration changes, and zero repository dependencies added. Preserved all existing dirty and untracked files.

---

## 1. Executive Summary & Answer to Core Question

### Core Question:
> Can a previously valid older session, which becomes invalid *after* a denied OAuth callback and home-page hydration, still open `/protected` through a deliberate client-side Vue-router click without a fresh Auth verification?

### Diagnostic Finding: **YES, CONFIRMED (CONTRACT RED PROVEN).**
Using the fresh production built Nuxt server, a controlled loopback Auth endpoint, and host-installed Playwright/Chromium (`/Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs` via `PLAYWRIGHT_MODULE_PATH`), the full end-to-end browser sequence was executed against unchanged production code:

1. **Callback Denial:**
   - Navigating to `/auth/callback?error=access_denied&error_description=...` renders the error notice.
   - Zero links to `/protected` exist in the callback content; no automatic redirect occurs.
2. **Home Hydration:**
   - Clicking `Return to Public Home` (`a[href="/"]`) navigates to `/`.
   - The home page client hydrates to an active authenticated session displaying `older101@rpr.ac.th`.
   - 2 Auth verification hits recorded by the loopback stub.
3. **Token Invalidation on Auth Endpoint:**
   - The Auth endpoint stub is switched to reject the token (`tokenMode = 'rejected'`).
4. **Deliberate Client-Side SPA Navigation to `/protected`:**
   - Clicking `#test-protected-btn` (`Test Protected Route (/protected)`) executes client-side Vue-router navigation.
   - **Verification Request Delta = 0:** Exactly zero verification requests were dispatched to the Auth endpoint.
   - **Route Allowed:** The route remained on `/protected` and displayed `Authentication Verified`.
   - **Contract Violation:** The expected contract (new verification request `delta > 0` and route redirect to `/?auth_required=true`) **failed as expected (RED)**.
5. **Characterization Hard Reload:**
   - Triggering a hard browser reload (`page.reload()`) causes the server-side request-scoped client to re-verify the session cookie during SSR against the Auth stub.
   - The stub returns HTTP 401 (`Invalid JWT token`).
   - The server issues HTTP 302 redirect to `/?auth_required=true`, proving that the vulnerability is strictly confined to client-side SPA navigation skipping re-verification.

### Root Cause:
In [app/middleware/auth.ts:28-33](file:///Users/nack/Classroom/app/middleware/auth.ts#L28-L33):
```typescript
if (!auth.user.value?.signedIn && auth.isConfigured) {
  await auth.checkVerifiedUser()
}
const isAuthenticated = Boolean(auth.user.value?.signedIn)
return authGuard(to, from, isAuthenticated, redirectFn)
```
Because `auth.user.value?.signedIn` was already populated as `true` during home-page hydration, `checkVerifiedUser()` is skipped during client-side SPA navigation. The route guard relies entirely on cached client memory rather than re-verifying with the authoritative provider.

---

## 2. Verification Metrics & Status

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **Production 5-Auth-File Diff Hash (Pre & Post Task)** | `git diff --binary -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `2b50de1002c41ef3d18bc0bc01b42ec61a96887a8e714a9473f3b3161538cb75` (**Exact match, 0 production code changes**) |
| **Production Build** | `npm run build` | 0 | Clean Nuxt Nitro node-server build |
| **Browser Diagnostic Runner (All Cases)** | `PLAYWRIGHT_MODULE_PATH=/Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs node tests/browser-diagnostic-006e2.mjs` | 1 | **2 Controls PASSED, 1 Contract Regression FAILED RED (as intended)** |
| **Browser Diagnostic Controls Only** | `PLAYWRIGHT_MODULE_PATH=/Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs node tests/browser-diagnostic-006e2.mjs --case=controls` | 0 | **Case 2 (Positive) & Case 3 (Absent) PASSED (100% GREEN, exit 0)** |
| **Browser Diagnostic RED Contract Only** | `PLAYWRIGHT_MODULE_PATH=/Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs node tests/browser-diagnostic-006e2.mjs --case=red` | 1 | **Case 1 Contract Assertion FAILED RED (as intended, exit 1)** |
| **ESLint Check** | `npm run lint` | 0 | 0 errors |
| **Typecheck** | `npm run typecheck` | 0 | 0 errors |
| **Existing Vitest Test Suite** | `npm run test` | 0 | **87 passed across all 6 test files (100% GREEN baseline preserved)** |
| **Git Diff Whitespace / Conflicts** | `git diff --check` | 0 | Clean (exit code 0) |

---

## 3. Browser Diagnostic Execution Matrix

| Case | Older Session Condition | Callback Denial & Home Hydration | Endpoint State on SPA Click | SPA Click Outcome | Status |
|---|---|---|---|---|---|
| **Case 1: Negative / RED (Revoked Token Regression)** | Initially valid session (`valid-older-token`). | Callback denied; home hydrates to authenticated status (`older101@rpr.ac.th`). Verification count = 2. | Token revoked on stub (`tokenMode = 'rejected'`). | Clicks `#test-protected-btn`: **0 new verification hits (`delta = 0`)**. Stays on `/protected`, renders `Authentication Verified`. Expected redirect to `/?auth_required=true` failed. Reload redirected to `/?auth_required=true`. | **CONTRACT RED (Failed as intended)** |
| **Case 2: Positive Control (Still-Valid Session)** | Valid session (`valid-older-token`). | Callback denied; home hydrates to authenticated status (`older101@rpr.ac.th`). Verification count = 2. | Token remains valid (`tokenMode = 'valid'`). | Clicks `#test-protected-btn`: Reaches `/protected`, displays `Authentication Verified` and `older101@rpr.ac.th`. `delta = 0` (cached client state). | **PASS (Positive Control Verified)** |
| **Case 3: Absent-Session Control** | No session cookie. | Callback denied; home displays `Unauthenticated (Visitor)`. | No token. | Clicks `#test-protected-btn`: Redirects to `/?auth_required=true`, no verified banner. | **PASS (Absent-Session Control Verified)** |

---

## 4. Exact Execution Log Excerpts

### Full Diagnostic Run:
```bash
$ PLAYWRIGHT_MODULE_PATH=/Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs node tests/browser-diagnostic-006e2.mjs
```
```text
============================================================
Handoff 006E2: Browser Regression Diagnostic
Playwright Module: /Users/nack/.hermes/hermes-agent/node_modules/playwright/index.mjs
Built Server:      /Users/nack/Classroom/.output/server/index.mjs
Mode:              all
============================================================

============================================================
Case 2: Positive Control (Token Continues to Verify)
============================================================
  [PASS] Callback denied rendered without protected link
  [PASS] Home page hydrated with active verified session
  [INFO] URL after click: http://127.0.0.1:61294/protected
  [INFO] Auth verification hits before: 2, after: 2, delta: 0
  [INFO] Shows "Authentication Verified": true
  [PASS] Positive control: protected route reached with verified identity

============================================================
Case 3: Absent-Session Control (No Session in Storage)
============================================================
  [PASS] Callback denied rendered without protected link
  [PASS] Home page shows unauthenticated visitor status
  [INFO] URL after click: http://127.0.0.1:61294/?auth_required=true
  [INFO] Shows "Authentication Verified": false
  [PASS] Absent-session control: redirected to /?auth_required=true

============================================================
Case 1: Negative / RED (Token Revocation After Home Hydration)
============================================================
  [PASS] Step 1: Callback denied rendered, no protected link, no auto-redirect
  [PASS] Step 2: Home page hydrated with active verified session
  [INFO] Verification requests before deliberate click: 2
  [INFO] Step 3: Revoking token on Auth endpoint (tokenMode = "rejected")...
  [INFO] Step 4: Deliberately clicking #test-protected-btn (client-side SPA navigation)...
  [INFO] URL after SPA click: http://127.0.0.1:61294/protected
  [INFO] Auth verification hits before: 2, after: 2, delta: 0
  [INFO] Page displays "Authentication Verified": true
  [INFO] Step 5: Executing hard reload of current page for comparison...
  [INFO] URL after hard reload: http://127.0.0.1:61294/?auth_required=true
  [INFO] Auth verification hits on reload: 3

------------------------------------------------------------
>>> CONTRACT VIOLATION DETECTED (EXPECTED RED) <<<
------------------------------------------------------------
  Expected Verification Request Delta > 0, but received: 0
  Expected Route Redirect to "/?auth_required=true", but stayed on: "http://127.0.0.1:61294/protected"
  Expected NO "Authentication Verified" banner, but banner was: PRESENT
  Root Cause:
    In app/middleware/auth.ts:28-33, authMiddlewareHandler checks:
      if (!auth.user.value?.signedIn && auth.isConfigured) { await auth.checkVerifiedUser() }
    Because auth.user.value?.signedIn was already set to true by home-page hydration,
    the client-side SPA navigation skipped re-verification entirely (delta = 0).
    Consequently, the revoked session gained protected access under stale client state.
    Hard reload, by contrast, triggered server-side SSR verification and correctly redirected:
      Reload URL: "http://127.0.0.1:61294/?auth_required=true" (verified: true)
------------------------------------------------------------

[SUITE RESULT] 2 Controls PASSED, 1 Contract Regression FAILED RED (as intended).
```

---

## 5. Changed Files List

| File Path | Description |
|---|---|
| `tests/browser-diagnostic-006e2.mjs` | Standalone browser diagnostic test runner utilizing host-installed Playwright via `PLAYWRIGHT_MODULE_PATH`. Implements Case 1 (Negative/RED), Case 2 (Positive Control), and Case 3 (Absent Control). Ensures automatic child process and server cleanup. |
| `docs/HANDOFF-006E2-antigravity-result.md` | This result document. |

---

## 6. Scope Adherence & Stop for Hermes Review

- **Zero Production Source Changes:** Diff hash `2b50de1002c41ef3d18bc0bc01b42ec61a96887a8e714a9473f3b3161538cb75` is unchanged.
- **Zero Dependencies Added:** Host Playwright was imported via path without altering `package.json` or `package-lock.json`.
- **Green Baseline Preserved:** `npm run test` remains 100% green across all 6 Vitest suites (87/87 pass).
- **No Fix Applied:** Route guard in `app/middleware/auth.ts` remains unmodified.

Execution is stopped for Hermes's independent review.
