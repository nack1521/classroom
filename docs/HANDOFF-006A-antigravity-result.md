# Gate 0 diagnostic result 006A — Antigravity

**Date:** 2026-09-25  
**Branch:** `fix/gate0-auth`  
**Execution Stage:** Diagnostic / Test-Only (Handoff 006A)  
**Production Changes:** NONE. No files in `app/` or production configurations were modified. No dependencies added. No commits or pushes made.

---

## 1. Executive Summary

In accordance with [docs/HANDOFF-ANTIGRAVITY-006A-diagnostic.md](file:///Users/nack/Classroom/docs/HANDOFF-ANTIGRAVITY-006A-diagnostic.md) and [docs/REVIEW-005-gate0.md](file:///Users/nack/Classroom/docs/REVIEW-005-gate0.md), Antigravity executed the diagnostic-only stage to establish deterministic evidence across the four identified local gaps without beginning Handoff 006 production fixes:

1. **Callback identity mismatch:** Established RED contract tests proving the current [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts) accepts mismatched identities (returning old session when code/token setup established a different user), accompanied by positive controls.
2. **Remote sign-out 500 characterization:** Characterized installed `@supabase/auth-js` (`GoTrueClient`) behavior against a local loopback 500 endpoint, demonstrating that the real SDK emits `SIGNED_OUT` and clears local storage despite the remote error, contrasting with the mock in [tests/review002-integration.test.ts](file:///Users/nack/Classroom/tests/review002-integration.test.ts).
3. **Unsafe error reflection:** Established RED contract tests proving [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts) reflects raw unscrubbed error descriptions and SDK messages into user-visible callback error properties.
4. **Built-server test harness hardening:** Made built-server path configurable via `TEST_BUILT_SERVER_PATH`, added explicit assertion failure when the artifact is absent (proving negative control fails cleanly rather than silently passing), and instrumented stub concurrency tracking to prove real HTTP request overlap.

---

## 2. Diagnostic Cases & Verified Evidence

### Case 1: Callback Identity Mismatch (RED Contract Tests)
- **Production Seam:** `processAuthCallback()` in [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts).
- **Test File:** [tests/diagnostic-handoff006a.test.ts](file:///Users/nack/Classroom/tests/diagnostic-handoff006a.test.ts).
- **Observations:**
  - *PKCE Code Exchange Mismatch (RED):* Controlled client where `exchangeCodeForSession()` returns `{ user: { id: 'user-exchanged-new' } }`, while `getUser()` returns `{ user: { id: 'user-stale-old' } }`. Asserting fail-closed (`success: false`, `user: null`) **FAILS** against present source because `processAuthCallback()` does not compare exchange user ID against verified user ID, returning `{ success: true, user: { id: 'user-stale-old' } }`.
  - *PKCE Positive Control (PASS):* When `exchangeCodeForSession()` and `getUser()` return matching `user-matching-101`, `processAuthCallback()` succeeds (`success: true`).
  - *Hash Token Setup Mismatch (RED):* Controlled client where `setSession()` returns `{ user: { id: 'user-hash-new' } }`, while `getUser()` returns `{ user: { id: 'user-stale-old' } }`. Asserting fail-closed **FAILS** against present source.
  - *Hash Positive Control (PASS):* When `setSession()` and `getUser()` return matching `user-hash-matching`, `processAuthCallback()` succeeds (`success: true`).
- **Sanitization:** Only synthetic IDs were used; no authorization codes or tokens were printed.

### Case 2: Remote Sign-Out 500 (Installed SDK Characterization)
- **Production Seam:** Installed `@supabase/auth-js` (`GoTrueClient`) interacting with local loopback HTTP stub returning 500 on `/logout`.
- **Test File:** [tests/diagnostic-handoff006a.test.ts](file:///Users/nack/Classroom/tests/diagnostic-handoff006a.test.ts).
- **Observations & Characterization Findings:**
  1. `client.signOut()` against HTTP 500 returns `{ error: { message: 'Internal Server Error on logout' } }`.
  2. The installed `GoTrueClient` calls internal `_removeSession()`, clearing local storage (`supabase.auth.token` is removed).
  3. `client.getSession()` returns `{ data: { session: null } }`.
  4. An `onAuthStateChange` subscriber receives event `'SIGNED_OUT'` with `session: null`.
- **Contrast with `tests/review002-integration.test.ts` Mock:**
  In [tests/review002-integration.test.ts:446-493](file:///Users/nack/Classroom/tests/review002-integration.test.ts#L446-L493), the test mock returned `{ error }` from `signOut()` but never emitted `SIGNED_OUT` or cleared storage. In reality, with the installed SDK, `onAuthStateChange` emits `SIGNED_OUT`, which triggers `createSafeAuthStateHandler` to set `user.value = null`. This characterization confirms Hermes's finding in Review 005 that the mock falsely supported a "retain user on remote error" policy that contradicts the installed SDK.

### Case 3: Unsafe Error Reflection (RED Contract Tests)
- **Production Seam:** `processAuthCallback()` in [app/utils/auth.ts](file:///Users/nack/Classroom/app/utils/auth.ts).
- **Test File:** [tests/diagnostic-handoff006a.test.ts](file:///Users/nack/Classroom/tests/diagnostic-handoff006a.test.ts).
- **Observations:**
  - *Query `error_description` (RED):* Query containing synthetic marker `SYNTHETIC_MARKER_QUERY`. Asserting `result.error` does not reflect the marker **FAILS** on present source (`result.error` contains `"OAuth Provider Error: access_denied - Denied with SYNTHETIC_MARKER_QUERY"`).
  - *Hash `error_description` (RED):* Hash fragment containing synthetic marker `SYNTHETIC_MARKER_HASH`. Asserting `result.error` does not reflect the marker **FAILS** on present source.
  - *SDK Exchange Error (RED):* Exchange error message containing `SYNTHETIC_MARKER_EXCHANGE`. Asserting `result.error` does not reflect the marker **FAILS** on present source (`result.error` contains `"Failed to exchange authorization code: ..."`).
  - *SDK getUser Error (RED):* getUser error message containing `SYNTHETIC_MARKER_GETUSER`. Asserting `result.error` does not reflect the marker **FAILS** on present source.
- **Sanitization:** Marker strings are purely synthetic and test assertions do not log raw URLs or payload dumps.

### Case 4: Built-Server HTTP Negative & Positive Controls
- **Test File:** [tests/regression-review001.test.ts](file:///Users/nack/Classroom/tests/regression-review001.test.ts).
- **Modifications:**
  - `builtServerPath` reads `process.env.TEST_BUILT_SERVER_PATH || path.resolve(__dirname, '../.output/server/index.mjs')`.
  - Replaced silent `if (!hasBuiltServer) return;` with an explicit assertion `expect(hasBuiltServer, 'Built server artifact is missing...').toBe(true)` in `beforeAll`.
  - Added in-flight request tracking to `stubServer` (`maxConcurrentStubRequests`) with controlled 50ms processing delay to verify true concurrency overlap.
- **Negative Control Execution:**
  - Command: `TEST_BUILT_SERVER_PATH=/tmp/missing-artifact/index.mjs npx vitest run tests/regression-review001.test.ts`
  - Exit code: **1** (FAILED as expected).
  - Result: Explicit `AssertionError: Built server artifact is missing at /tmp/missing-artifact/index.mjs. Run "npm run build" before running integration tests.: expected false to be true`. Proves missing artifact cannot silently produce green tests.
- **Positive Control Execution:**
  - Command: `npx vitest run tests/regression-review001.test.ts`
  - Exit code: **0** (15/15 PASSED).
  - Concurrency Overlap: `expect(maxConcurrentStubRequests).toBeGreaterThanOrEqual(2)` passed, proving concurrent HTTP requests overlapped in flight at the local Auth stub.

---

## 3. Command Execution Summary

| Command | Exit Code | Result | Note |
|---|:---:|---|---|
| `npm run lint` | 0 | PASSED | 0 lint errors, 0 warnings. |
| `npm run typecheck` | 0 | PASSED | 0 TypeScript errors. |
| `npm run build` | 0 | PASSED | Client, Server, and Nitro server built into `.output/`. |
| `TEST_BUILT_SERVER_PATH=/tmp/missing/index.mjs npx vitest run tests/regression-review001.test.ts` | 1 | EXPECTED RED | Negative control: explicitly fails on missing build artifact. |
| `npx vitest run tests/regression-review001.test.ts` | 0 | PASSED (15/15) | Positive control: valid, missing, forged cookies, and instrumented concurrency overlap. |
| `npx vitest run tests/diagnostic-handoff006a.test.ts` | 1 | EXPECTED RED (6 fail, 3 pass) | Cases 1 & 3 RED contract failures + Case 2 SDK characterization pass. |
| `npm run test` (full suite) | 1 | EXPECTED RED (6 fail, 48 pass) | 48 existing/control tests pass; exactly 6 diagnostic contract tests fail as intended. |
| `git diff --check` | 0 | PASSED | Clean; 0 whitespace warnings. |

---

## 4. Files Modified / Created

- [tests/regression-review001.test.ts](file:///Users/nack/Classroom/tests/regression-review001.test.ts): Configurable built server path, explicit failure on missing build artifact, and concurrency overlap tracking.
- [tests/diagnostic-handoff006a.test.ts](file:///Users/nack/Classroom/tests/diagnostic-handoff006a.test.ts): New test file housing Cases 1, 2, and 3 diagnostic contract and characterization tests.
- [docs/HANDOFF-006A-antigravity-result.md](file:///Users/nack/Classroom/docs/HANDOFF-006A-antigravity-result.md): Diagnostic report document.

**Preserved Files:**
- All files in `app/` (no changes made).
- [PLANNING_PAPER.md](file:///Users/nack/Classroom/PLANNING_PAPER.md) and all review/handoff documents preserved.

---

## 5. Next Step

All diagnostic requirements for Handoff 006A have been completed and verified. Antigravity has stopped here and will wait for Hermes's review before any production fixes in Handoff 006 are authorized.
