# HANDOFF-006F1 — Natural SDK SIGNED_IN Event Race Diagnostic Result

**Date:** 2026-09-26  
**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Status:** **COMPLETE (TEST-ONLY PASS)** — Stopped for Hermes review. Gate 0 remains **NOT PASSED** pending Hermes acceptance of this boundary.  
**5-Auth-File Diff Baseline SHA-256:** `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3` across `app/composables/useAuth.ts`, `app/middleware/auth.ts`, `app/pages/auth/callback.vue`, `app/utils/auth.ts`, `app/utils/supabaseClient.ts` (**VERIFIED UNCHANGED — EXACT MATCH**).

---

## 1. Executive Summary & Verdict

This diagnostic executes `docs/HANDOFF-ANTIGRAVITY-006F1-natural-sdk-event.md` strictly as a **test-only** verification addressing the one missing fact identified in `docs/REVIEW-006F-gate0.md`:
In 006F Row B, private `_notifyAllSubscribers('SIGNED_IN', ...)` was manually called while the held `/user` request was actually the SDK's internal pre-event `_getUser()` call in `_setSession()`.

In **006F1**, `tests/diagnostic-006f-row-b.test.ts` was refactored to:
1. **Cause `SIGNED_IN` 100% naturally** via installed `@supabase/auth-js` (`client.setSession(...)`) against a controlled loopback server.
2. **Never** invoke `_notifyAllSubscribers` or fabricate any auth event/session.
3. **Distinguish Request #1 from Request #2**:
   - **Request #1 (`pre_event_sdk_user`):** The SDK's pre-event verification in `GoTrueClient.ts:3646-3660` before storage persistence.
   - **Request #2 (`deferred_listener_user`):** The production listener's deferred `client.auth.getUser()` verification scheduled via `setTimeout(..., 0)` in `createSafeAuthStateHandler`.
4. **Hold Request #2 in flight** while verifying that Request #1 completed, the natural `SIGNED_IN` event was emitted, and `auth.user.value` is unverified (`null`).
5. **Initiate production `auth.signOut()`**, prove synchronous invalidation started (`stateGeneration.value` bumped), release the held deferred response, and await completion without deadlock.
6. **Assert Negative Race:** Late resolution of Request #2 is dropped by generation/sequence checks (`isStale()`), keeping `auth.user.value` strictly `null`.
7. **Assert Positive Control:** Uninterrupted natural `setSession()` resolves both requests and populates `auth.user.value` with verified `userA@rpr.ac.th` (`signedIn: true`).
8. **Use deterministic bounded polling** (`waitForCondition` with loud timeout failure) instead of arbitrary fixed sleeps.

| Test Case | Method | Mode | Verdict | Summary |
|---|---|---|---|---|
| **Negative Event Race** | Natural `client.setSession()` → natural `SIGNED_IN` → Request #2 held in flight → `auth.signOut()` → release Request #2 | Real installed SDK & production `useAuth` composable | **PASS (GREEN)** | Late response dropped by generation check; `auth.user.value` remains `null`. |
| **Positive Control** | Natural `client.setSession()` → natural `SIGNED_IN` → Request #1 & Request #2 resolve without sign-out | Real installed SDK & production `useAuth` composable | **PASS (GREEN)** | `auth.user.value` correctly populated with verified user (`userA@rpr.ac.th`, `signedIn: true`). |

---

## 2. Event and Request Ordering Evidence

### Negative Race Ordering Log
```
1. Client initializes GoTrueClient with in-memory storage & attaches useAuth().initAuth() listener
2. Storage empty; auth.user.value is null
3. Gate configured: hold Request #2, allow Request #1
4. client.setSession({ access_token: [valid JWT], refresh_token: [token] }) called naturally
5. [NETWORK REQUEST #1] GET /auth/v1/user (type: pre_event_sdk_user, SDK internal verification)
   --> Loopback responds 200 OK with User A
6. SDK GoTrueClient sets session in storage and calls _notifyAllSubscribers('SIGNED_IN', session)
   --> Natural subscriber receives SIGNED_IN event (captured by test listener)
   --> Production listener createSafeAuthStateHandler receives SIGNED_IN and schedules setTimeout(verifyFn, 0)
7. setSession() promise resolves with data.session
8. Production listener timeout triggers fetchVerifiedUser() -> client.auth.getUser()
9. [NETWORK REQUEST #2] GET /auth/v1/user (type: deferred_listener_user, production verification)
   --> Network gate holds Request #2 in flight
10. PRE-SIGNOUT ASSERTIONS VERIFIED:
    - Request #1 type: pre_event_sdk_user (completed)
    - Request #2 type: deferred_listener_user (in flight, held)
    - deferredResponseSent: false
    - auth.user.value: null
11. Production auth.signOut() initiated
    - auth-state-generation bumped synchronously from 0 to 1 (genAfter > genBefore)
12. Network gate releases held Request #2 response (200 OK with User A)
    - deferredResponseSent: true
13. [NETWORK REQUEST #3] POST /auth/v1/logout (type: logout)
    - Loopback responds 200 OK
14. Natural SIGNED_OUT event emitted by SDK
15. signOutPromise resolves
16. Production listener receives late response for Request #2:
    - Handler checks isStale() -> generation changed (0 !== 1)
    - Stale response discarded!
17. POST-RACE ASSERTIONS VERIFIED:
    - auth.user.value is strictly null
    - auth.user.value?.signedIn is falsy
```

### Positive Control Ordering Log
```
1. Client initializes GoTrueClient with in-memory storage & attaches useAuth().initAuth() listener
2. Storage empty; auth.user.value is null
3. Gate configured: allow all requests (holdDeferredVerification = false)
4. client.setSession({ access_token: [valid JWT], refresh_token: [token] }) called naturally
5. [NETWORK REQUEST #1] GET /auth/v1/user (type: pre_event_sdk_user) -> 200 OK
6. SDK GoTrueClient emits natural SIGNED_IN
7. Production listener triggers fetchVerifiedUser() -> client.auth.getUser()
8. [NETWORK REQUEST #2] GET /auth/v1/user (type: deferred_listener_user) -> 200 OK
9. Production listener updates auth.user.value:
   - id: "user-A"
   - email: "userA@rpr.ac.th"
   - signedIn: true
10. Trace confirms 1 pre_event_sdk_user and 1 deferred_listener_user request executed
```

---

## 3. Test Suite & Verification Results

### Focused Test Run
```bash
$ npx vitest run tests/diagnostic-006f-row-b.test.ts --reporter=dot
··
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  13:50:42
   Duration  494ms
```

### Full Test Suite Run
```bash
$ npm run test -- --reporter=dot
Test Files  12 passed (12)
     Tests  116 passed | 6 skipped (122)
  Start at  13:50:50
  Duration  1.54s
```

#### Breakdown of the 6 Default Skips
The 6 skipped tests are stress/fault-injection cases that require `GATE0_STRESS=1` and are preserved per policy and review agreements:
1. `tests/diagnostic-006e5c.test.ts` — Case A1 (PKCE — Policy Stress): local signOut throws before cleanup; storage remains present and route middleware fails open on unchanged code
2. `tests/diagnostic-006e5c.test.ts` — Case A2 (Token/Hash — Policy Stress): local signOut throws before cleanup; storage remains present and route middleware fails open on unchanged code
3. `tests/diagnostic-006e5c.test.ts` — Case B1 (Method Absent — Policy Stress): signOut method unavailable on client; storage remains present and route middleware fails open on unchanged code
4. `tests/diagnostic-006e5c.test.ts` — Case C1 (PKCE — Policy Stress): incomplete SDK exchange response after simulated storage change leaves session unquarantined and route fails open on unchanged code
5. `tests/diagnostic-006e5c.test.ts` — Case C2 (Token/Hash — Policy Stress): incomplete SDK setSession response after simulated storage change leaves session unquarantined and route fails open on unchanged code
6. `tests/diagnostic-006f-row-a.test.ts` — Row A2: demonstrates route outcome when storage adapter fails to clear cookie during local quarantine (Policy Stress)

### Linter
```bash
$ npm run lint
> lint
> eslint .
# Exit code 0 (clean, 0 errors, 0 warnings)
```

### Typecheck
```bash
$ npm run typecheck
> typecheck
> tsc --noEmit
# Exit code 0 (clean, 0 errors)
```

### Whitespace / Git Diff Hygiene
```bash
$ git diff --check
# Exit code 0 (clean)
```

### Baseline 5-Auth-File Diff Hash Verification
```bash
$ git diff -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts | shasum -a 256
8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3  -
```
**Hash Match:** `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3` is **IDENTICAL** to baseline. Zero production code edits were made.

### Process Hygiene
```bash
$ ps aux | grep -E "node.*\.output/server|chromium|playwright" | grep -v grep
nack  91281  0.0  0.4  ...  node --env-file=.env .output/server/index.mjs  # Live pilot server on port 3000 (preserved)
```
No test processes, Chromium instances, or Vitest workers were left running.

---

## 4. Scope and Guardrail Audit
- **Files Modified:** ONLY `tests/diagnostic-006f-row-b.test.ts` and `docs/HANDOFF-006F1-antigravity-result.md`.
- **Production Code Changes:** 0 lines added, 0 lines modified.
- **Git Actions:** Zero git commits, zero git pushes, zero deployments.
- **Security:** No actual tokens, user secrets, real accounts, or student data used or printed.
- **Next Step:** Stopping for Hermes review. Gate 0 is NOT claimed as passed.
