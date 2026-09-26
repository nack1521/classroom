# REVIEW-006C — callback identity binding

**Reviewed:** 2026-09-25  
**Branch:** `fix/gate0-auth`  
**Verdict:** PKCE/hash *mismatched* IDs now fail closed; **006C not fully accepted** because the explicit missing-ID condition remains false-success on all four one-sided-ID combinations. Gate 0 remains blocked. No commit/push/deploy or real account was used.

## Independent verification

- Protected production diff hash after 006C: `28baec434dd4e085278173cc5907b8152ce77927054045e185a2e6499faf49c9`; before: `c80e736d8c3563eef92296edb1c7db46369f598b82c50761f35862a4a7f2b805`. Reviewed `app/utils/auth.ts:439-541`, Case 1 tests and result report. Recent source changes are limited to `app/utils/auth.ts`; `app/composables/useAuth.ts` and callback page retain earlier edits, and `tests/diagnostic-handoff006a.test.ts` gained two tests. `git diff --check` exited 0.
- Independent fresh `npm run lint`, `npm run typecheck`, `npm run build`: all exit 0. `npx vitest run tests/diagnostic-handoff006a.test.ts -t 'Case 1'`: 6 pass, 7 skipped. Fresh-build full suite: **61 pass, exactly 4 existing Case 3 error-reflection RED fail**, exit 1. Sign-out integration 20/20, real-SDK Case 2 3/3 with 10 other tests skipped by filter, SSR regression 15/15; missing-build negative control explicitly fails and dependent four HTTP cases are skipped, not counted as green.
- Actual `useAuth().handleCallback()` is called in the new test: controlled mismatch with a pre-existing UI user returns failure, clears `user.value`, sets generic `authError`. The callback page itself was **not mounted/rendered**; the result's claim of no protected continuation is from source inspection of the `result.success` branch, not an exercised router. Real OAuth and late SDK event delivery also remain unverified.

## Blocking discrepancy with the written contract

- Handoff 006C explicitly requires the **same, non-empty ID in each** of `data.session.user.id`, `data.user.id`, and `getUser()` result, and says a missing ID at *any one* point must fail. However `app/utils/auth.ts:467-477,507-517` rejects only **both** established IDs missing or two non-empty IDs disagree, then uses `sessionUserId || responseUserId`. If exactly one is missing, a matching `getUser()` ID yields `success:true` and authenticated user.
- Read-only independent probe of production `processAuthCallback()` confirms false success for **PKCE missing session ID, PKCE missing response ID, hash missing session ID, and hash missing response ID** (four synthetic controlled clients; all returned `success:true`, user present). These fixtures are synthetic and do not establish that the installed SDK normally emits such a shape. But they contradict the explicit acceptance contract and the IDE result's claim of fail-closed missing IDs.
- The added test named “contradictory session identity or missing ID” at `tests/diagnostic-handoff006a.test.ts:121-145` actually exercises only **contradictory IDs**; no missing ID is constructed. That is why 6/6 Case 1 green does not prove this requirement. Add a minimal test for each missing side (PKCE and hash), observe RED, then fix only the identity comparison in 006C; preserve matching controls and the four intentionally RED Case 3 tests. Do not launch the broad Handoff 006 or claim Gate 0 passed.

## Remaining gates

Four Case 3 error-reflection tests are pre-existing RED. Actual rendered callback/error text, pending SDK `SIGNED_IN` event race, and authorized real school OAuth have not been verified. Keep this scoped finding separate from those later checks; a passing unit suite alone is not an OAuth pilot approval.
