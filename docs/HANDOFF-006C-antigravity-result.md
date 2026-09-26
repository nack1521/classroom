# Antigravity Handoff 006C Result — Callback Identity Binding Only

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Strictly bounded callback identity-binding slice only (Handoff 006C). No work on error reflection (Case 3); no sign-out, SSR, schema, Google configuration, dependency changes, commits, pushes, deployment, or access to real accounts/secrets.

---

## 1. Executive Summary & Verification Metrics

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **Baseline Protected Diff SHA-256** | `git diff --binary -- app/ nuxt.config.ts package.json package-lock.json vitest.config.ts \| shasum -a 256` | 0 | `c80e736d8c3563eef92296edb1c7db46369f598b82c50761f35862a4a7f2b805` |
| **Post-Slice Protected Diff SHA-256** | `git diff --binary -- app/ nuxt.config.ts package.json package-lock.json vitest.config.ts \| shasum -a 256` | 0 | `28baec434dd4e085278173cc5907b8152ce77927054045e185a2e6499faf49c9` |
| **Case 1 Diagnostics (RED first)** | `npx vitest run tests/diagnostic-handoff006a.test.ts -t 'Case 1'` | 1 | 4 failed, 2 passed, 7 skipped (all 4 identity mismatch/binding tests failed RED as expected) |
| **Case 1 Diagnostics (GREEN)** | `npx vitest run tests/diagnostic-handoff006a.test.ts -t 'Case 1'` | 0 | 6/6 passed (2 PKCE mismatch, 2 hash mismatch/missing, 2 positive controls) |
| **Diagnostic Test Suite** | `npx vitest run tests/diagnostic-handoff006a.test.ts` | 1 | 9 passed, 4 failed (Case 1: 6/6 passed, Case 2: 3/3 passed, Case 3: 4/4 strictly preserved RED) |
| **Review 002 Integration** | `npx vitest run tests/review002-integration.test.ts` | 0 | 20/20 passed |
| **Focused Sign-Out Suite** | `npx vitest run tests/diagnostic-handoff006a.test.ts -t 'Case 2'` | 0 | 3/3 passed (including real SDK remote-500 characterization) |
| **SSR & Regression Suite** | `npx vitest run tests/regression-review001.test.ts` | 0 | 15/15 passed (including 4 real built-server HTTP SSR tests) |
| **Auth Base Unit Tests** | `npx vitest run tests/auth.test.ts` | 0 | 14/14 passed |
| **ESLint** | `npm run lint` | 0 | 0 lint errors |
| **Typecheck** | `npm run typecheck` | 0 | 0 TypeScript errors |
| **Production Build** | `npm run build` | 0 | Nuxt + Nitro built cleanly (node-server) |
| **Full Test Suite (Fresh Build)** | `npm run test` | 1 | 61 passed, exactly 4 failed (the 4 authorized Case 3 RED tests) |
| **Git Diff Whitespace / Conflict Check** | `git diff --check` | 0 | Clean (exit code 0) |

---

## 2. Paths Changed in This Slice

- [`app/utils/auth.ts`](file:///Users/nack/Classroom/app/utils/auth.ts): Production callback seam in `processAuthCallback()`:
  - Added strict identity binding between the just-established OAuth session/user (`sessionUserId` / `exchangeUserId`) and the verified identity (`verifiedUserId` from `resolveVerifiedUser(client)`).
  - Enforced mutual agreement when both `session.user.id` and `user.id` are returned.
  - Fail closed on missing, invalid, or mismatched identity with generic, sanitized error message (`"Authentication failed: OAuth session identity could not be verified."`) and `user: null`.
- [`tests/diagnostic-handoff006a.test.ts`](file:///Users/nack/Classroom/tests/diagnostic-handoff006a.test.ts):
  - Preserved existing RED mismatch tests for PKCE and hash token callbacks.
  - Added negative control: `RED CONTRACT: rejects callback when exchange returns contradictory session identity or missing ID`.
  - Added app-level composable test: `RED CONTRACT (useAuth): handleCallback() fails closed on identity mismatch, clears pre-existing UI user, and exposes authError without protected continuation`.
- [`docs/HANDOFF-006C-antigravity-result.md`](file:///Users/nack/Classroom/docs/HANDOFF-006C-antigravity-result.md): This report document.

*Note: All prior dirty and untracked work in `PLANNING_PAPER.md`, `app/middleware/auth.ts`, `app/pages/auth/callback.vue`, `app/utils/supabaseClient.ts`, `app/composables/useAuth.ts`, `nuxt.config.ts`, `vitest.config.ts`, `tests/regression-review001.test.ts`, `tests/review002-integration.test.ts`, and prior handoff/review docs were strictly preserved without modification.*

---

## 3. Strict RED-First Evidence (Pre-Fix Failures)

Before making any production edits to `app/utils/auth.ts`, the full Case 1 suite (including the two existing Handoff 006A tests, the negative control, and the app-level state test) was executed against the unpatched codebase.

### Command
```bash
npx vitest run tests/diagnostic-handoff006a.test.ts -t "Case 1"
```

### Pre-Fix Output
```text
 ❯ tests/diagnostic-handoff006a.test.ts (13 tests | 4 failed | 7 skipped) 8ms
   ❯ Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) (6)
     × RED CONTRACT: rejects callback when PKCE code exchange returns user A but getUser() returns different user B 5ms
     ✓ POSITIVE CONTROL: accepts callback when PKCE code exchange and getUser() identities match 0ms
     × RED CONTRACT: rejects hash callback when setSession() returns user A but getUser() returns different user B 0ms
     ✓ POSITIVE CONTROL: accepts hash callback when setSession() and getUser() identities match 0ms
     × RED CONTRACT: rejects callback when exchange returns contradictory session identity or missing ID 0ms
     × RED CONTRACT (useAuth): handleCallback() fails closed on identity mismatch, clears pre-existing UI user, and exposes authError without protected continuation 1ms

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/diagnostic-handoff006a.test.ts > Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) > RED CONTRACT: rejects callback when PKCE code exchange returns user A but getUser() returns different user B
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ tests/diagnostic-handoff006a.test.ts:36:28

 FAIL  tests/diagnostic-handoff006a.test.ts > Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) > RED CONTRACT: rejects hash callback when setSession() returns user A but getUser() returns different user B
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ tests/diagnostic-handoff006a.test.ts:91:28

 FAIL  tests/diagnostic-handoff006a.test.ts > Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) > RED CONTRACT: rejects callback when exchange returns contradictory session identity or missing ID
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ tests/diagnostic-handoff006a.test.ts:143:28

 FAIL  tests/diagnostic-handoff006a.test.ts > Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) > RED CONTRACT (useAuth): handleCallback() fails closed on identity mismatch, clears pre-existing UI user, and exposes authError without protected continuation
AssertionError: expected true to be false // Object.is equality
- Expected
+ Received
- false
+ true
 ❯ tests/diagnostic-handoff006a.test.ts:198:28

 Test Files  1 failed (1)
      Tests  4 failed | 2 passed | 7 skipped (13)
```

### Pre-Fix Flaws Confirmed
1. **Silent Fallback to Stale Session:** `processAuthCallback()` performed `exchangeCodeForSession()` or `setSession()`, verified that session/user was non-null, and then called `resolveVerifiedUser(client)`. However, it never compared the established session user ID against `verifiedResult.user.id`. If `getUser()` returned a stale pre-existing user (e.g. from a prior login or unpurged storage), the callback falsely succeeded with the old identity.
2. **Contradictory Session Identity Accepted:** When exchange returned a session whose `session.user.id` contradicted `user.id`, the mismatch was ignored.
3. **App-Level Continuation Risk:** On mismatch, `useAuth().handleCallback()` would have preserved an authenticated state for the stale user and allowed the callback page to redirect or continue to `/protected`.

---

## 4. Minimal GREEN Implementation

### Changes in `app/utils/auth.ts`
In `processAuthCallback()`:
1. **Established ID Extraction:**
   - For PKCE:
     ```ts
     const sessionUserId = exchangeRes.data.session?.user?.id ? String(exchangeRes.data.session.user.id).trim() : null
     const exchangeUserId = exchangeRes.data.user?.id ? String(exchangeRes.data.user.id).trim() : null

     if ((sessionUserId && exchangeUserId && sessionUserId !== exchangeUserId) || (!sessionUserId && !exchangeUserId)) {
       return {
         success: false,
         error: 'Authentication failed: OAuth session identity could not be verified.',
         user: null,
       }
     }
     establishedUserId = sessionUserId || exchangeUserId
     ```
   - For Hash Tokens:
     ```ts
     const sessionUserId = sessionRes.data.session?.user?.id ? String(sessionRes.data.session.user.id).trim() : null
     const responseUserId = sessionRes.data.user?.id ? String(sessionRes.data.user.id).trim() : null

     if ((sessionUserId && responseUserId && sessionUserId !== responseUserId) || (!sessionUserId && !responseUserId)) {
       return {
         success: false,
         error: 'Authentication failed: OAuth session identity could not be verified.',
         user: null,
       }
     }
     establishedUserId = sessionUserId || responseUserId
     ```
2. **Verified Identity Comparison:**
   ```ts
   const verifiedUserId = verifiedResult.user.id ? String(verifiedResult.user.id).trim() : null
   if (!establishedUserId || !verifiedUserId || establishedUserId !== verifiedUserId) {
     return {
       success: false,
       error: 'Authentication failed: OAuth session identity could not be verified.',
       user: null,
     }
   }
   ```
3. **Sanitized Error Output:**
   - Any missing, invalid, or mismatched identity emits `'Authentication failed: OAuth session identity could not be verified.'`.
   - Contains no user IDs, auth codes, access tokens, URLs, or provider/SDK error strings.

### App-Facing State Verification
In `useAuth().handleCallback()`:
- When `processAuthCallback` fails closed (`result.success === false`), `useAuth()` sets:
  ```ts
  authError.value = result.error
  if (gen === stateGeneration.value) {
    user.value = null
  }
  ```
- Tested directly in `RED CONTRACT (useAuth)`:
  - Pre-existing UI user (`pre-existing-ui-user`) is immediately nulled (`auth.user.value === null`).
  - `authError` is populated with the generic sanitized message and contains zero leaked tokens, codes, or user IDs.
  - Return value is `{ success: false, error: '...', user: null }`.

### GREEN Run Evidence
```bash
npx vitest run tests/diagnostic-handoff006a.test.ts -t "Case 1"
```
```text
 ✓ tests/diagnostic-handoff006a.test.ts (13 tests | 7 skipped) 4ms
   ✓ Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) (6)
     ✓ RED CONTRACT: rejects callback when PKCE code exchange returns user A but getUser() returns different user B 2ms
     ✓ POSITIVE CONTROL: accepts callback when PKCE code exchange and getUser() identities match 0ms
     ✓ RED CONTRACT: rejects hash callback when setSession() returns user A but getUser() returns different user B 0ms
     ✓ POSITIVE CONTROL: accepts hash callback when setSession() and getUser() identities match 0ms
     ✓ RED CONTRACT: rejects callback when exchange returns contradictory session identity or missing ID 0ms
     ✓ RED CONTRACT (useAuth): handleCallback() fails closed on identity mismatch, clears pre-existing UI user, and exposes authError without protected continuation 1ms

 Test Files  1 passed (1)
      Tests  6 passed | 7 skipped (13)
```

---

## 5. Status of the Four Remaining Case 3 RED Contract Tests

The four Case 3 error-reflection contract tests were left completely untouched. They remain strictly RED as planned:

1. `tests/diagnostic-handoff006a.test.ts:506`: `RED CONTRACT: processAuthCallback() does not reflect raw provider error_description from query string` (FAIL)
2. `tests/diagnostic-handoff006a.test.ts:523`: `RED CONTRACT: processAuthCallback() does not reflect raw provider error_description from hash fragment` (FAIL)
3. `tests/diagnostic-handoff006a.test.ts:539`: `RED CONTRACT: processAuthCallback() does not reflect raw SDK exchange error message` (FAIL)
4. `tests/diagnostic-handoff006a.test.ts:559`: `RED CONTRACT: processAuthCallback() does not reflect raw SDK getUser error message` (FAIL)

Full test suite execution (`npm run test`) exits with code 1 solely due to these 4 tests:
- Total tests: 65
- Passed: 61
- Failed: 4 (Case 3 only)

---

## 6. Unverified Boundaries & Evidence Limits

1. **Callback Page DOM Rendering Boundary:**
   - In `tests/diagnostic-handoff006a.test.ts`, the app-level state contract was verified against production `useAuth().handleCallback()`, asserting `user.value === null`, `authError.value` populated, and `{ success: false, user: null }` returned.
   - In `app/pages/auth/callback.vue:9-17`, the page consumes `result`:
     ```ts
     if (!result.success) {
       callbackStatus.value = 'error'
       errorMessage.value = result.error || authError.value || 'Authentication failed'
     }
     ```
     This confirms by direct code inspection that no redirect to `/protected` occurs (`router.push('/protected')` is only inside `result.user?.signedIn`). However, mounting the full Vue SFC within an in-memory browser DOM is not part of the Vitest harness and is noted as an unmounted page boundary.
2. **Delayed SDK Auth Events:**
   - A late `onAuthStateChange` event firing after callback completion could theoretically schedule an async verification if not generation-guarded. In `app/composables/useAuth.ts`, the generation guard (`stateGeneration`) and `createSafeAuthStateHandler` protect against this; however, a live OAuth round-trip with asynchronous network delays was not executed.
3. **No Account / Cloud Mutation:**
   - No real Supabase or Google Cloud credentials or accounts were accessed or changed.

---

## 7. Stop Condition Met

- Callback identity binding is strictly implemented and verified GREEN.
- All Case 1 tests (6/6) pass.
- All 4 Case 3 error-reflection tests remain RED without test modification.
- All regression, SSR, built-server, sign-out, lint, typecheck, and build checks pass cleanly.
- No Git commits, pushes, or deployments were performed.
- All untracked and dirty files remain preserved.
- Ready for Hermes independent review.
