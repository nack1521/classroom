# REVIEW-006A — diagnostic/test-only checkpoint

**Reviewed:** 2026-09-25  
**Branch:** `fix/gate0-auth`  
**Verdict:** Diagnostic evidence substantially validated, with explicit app/UI coverage limits. **Gate 0 remains unaccepted.** No authority to run production Handoff 006, commit, push, or claim real OAuth.

## Independent rerun

- `npm run lint`, `npm run typecheck`, `npm run build`: exit 0.
- Fresh built artifact, `npm run test`: exit 1; **6 RED contract tests failed as intended, 48 tests passed**. Both PKCE/hash identity mismatch assertions fail because the callback reports success; four provider/SDK error-reflection assertions fail because the error contains a synthetic marker. Positive identity controls pass. These are failures of existing behavior, not a broken test harness (`tests/diagnostic-handoff006a.test.ts:6-117,223-307`).
- `npx vitest run tests/regression-review001.test.ts` after build: exit 0, 15/15 pass. The tests make real local built-app HTTP requests with controlled Auth responses; `maxConcurrentStubRequests >= 2` now distinguishes overlap from a bare `Promise.all` (`tests/regression-review001.test.ts:344-539`).
- `TEST_BUILT_SERVER_PATH=/Users/nack/.hermes/cache/scratch/definitely-missing-006A/index.mjs npx vitest run tests/regression-review001.test.ts`: exit 1 with an explicit missing-artifact assertion. Four dependent tests show as skipped, not green; the file is failed (`tests/regression-review001.test.ts:353-354,382-387`). This tests absence, not build freshness. Freshness came from the preceding successful build command.
- `git diff --check`: exit 0. The new test and result document are untracked; source files in `app/` remain modified from the earlier 005 work, with file modification times predating 006A's new test/report. No observed 006A production/dependency/config change; Git alone cannot attribute older uncommitted changes to an agent without a pre-task diff snapshot.

## Interpretation and limits

1. The two callback RED cases use a controlled `AuthCallbackClient` mock, **but execute the production `processAuthCallback()`**. They prove a logic contract violation when exchange/setup and verified IDs disagree, not that Supabase normally produces that mismatch during real Google OAuth.
2. The sign-out characterization uses the installed `GoTrueClient` with loopback HTTP 500 and real SDK notification/storage. It passes and supports local session removal plus `SIGNED_OUT` despite an error (`tests/diagnostic-handoff006a.test.ts:120-221`). However **this new test does not call production `useAuth().signOut()` or assert its final UI/error/navigation state or the in-flight failed-sign-out race**. The 006A result infers the UI effect from the SDK event and source; label it an inference, not a demonstrated app-level regression. The current old mock test still asserts user retention on error (`tests/review002-integration.test.ts:446-493`), so the app policy is unresolved.
3. Error RED cases check `processAuthCallback()` return strings, not a mounted callback page. `app/pages/auth/callback.vue:9-12,45-48` forwards returned errors into displayed text, so a visible leak is plausible by direct source inspection, **not independently rendered in 006A**. Synthetic markers appear verbatim in the agent's result and Vitest failure output; no real credentials were used, but future reports should avoid reproducing even synthetic marker-bearing payloads when only the boolean failure matters.
4. The missing-build guard is a real improvement. It does not independently assert exact Auth request count/path on every HTTP case; no such exhaustive claim is accepted here. Built-server positive controls and overlap are grounded in a fresh local build only.

## Decision before implementation

Stop the automatic correction loop. Adopt a small behavioral contract first: (a) callback succeeds only when the established and verified identities match; (b) if the installed SDK removed the local session during a remote sign-out error, local UI must not claim the user is still signed in, but should warn that remote revocation is unconfirmed; (c) provider/SDK error text is categorized and safe for display, never passed through verbatim; (d) built-app HTTP verification requires a fresh build and fails loudly if absent. In the next *approved* implementation slice, have Antigravity make the existing RED contract tests green and add one production `useAuth()` + real SDK remote-500 test for local UI/error/in-flight behavior before changing sign-out code. Do not send the broad Handoff 006 as-is or test real accounts yet.
