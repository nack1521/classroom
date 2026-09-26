# REVIEW-006C1 — one-sided missing callback IDs

**Reviewed:** 2026-09-25; branch `fix/gate0-auth`.  
**Verdict:** **Accept this narrow 006C.1 correction**: each of four one-sided missing-ID cases fails closed in the production callback, and matching PKCE/hash cases still succeed. **Gate 0 remains blocked** by the four existing unsafe error-reflection RED tests and remaining live UI/OAuth boundaries. No commit, push, deploy or real account was used.

## Evidence

- Protected production diff hash moved from `28baec434dd4e085278173cc5907b8152ce77927054045e185a2e6499faf49c9` to `8c716d13a942a6a097ada61e1f12e3aa7a787ea07fd94ce5c0c9b8e77a61af79`. Recent production change limited to `app/utils/auth.ts:467-517`; added four distinct RED→GREEN fixtures in `tests/diagnostic-handoff006a.test.ts:214-333`. The two existing positive fixtures in `tests/review002-integration.test.ts:191-225` were aligned to include `session.user.id`; inspect this test-only fixture change when attributing green regression counts. `git diff --check` exits 0.
- Independent fresh `npm run lint`, `npm run typecheck`, `npm run build`: all exit 0. Case 1 tests: **10/10**; four missing-ID tests plus a prior contradictory-ID test: **5/5**; two matching controls: **2/2**. Fresh-build full suite: **65 passed, exactly four expected Case 3 error-reflection RED failures**, exit 1. Sign-out integration 20/20, real SDK Case 2 3/3 (other tests skipped by filter), SSR regression 15/15. Missing built artifact negative control explicitly fails and four HTTP cases are skipped rather than counted green.
- Read-only independent probe invoked actual `processAuthCallback()` with six synthetic controlled clients: PKCE/hash × missing session ID or missing response ID returned `success:false,user:null` and generic error without the synthetic ID; both PKCE/hash matching-ID controls returned `success:true,user` present. This validates each row independent of the agent's report and test titles. It does **not** prove real SDK/cloud response shapes or live browser page behavior.

## Scope and remaining work

- In `app/utils/auth.ts`, the established session ID and response user ID must both be non-empty after trimming and equal; the old `sessionUserId || responseUserId` fallback is gone. The verified ID must also match. Existing `getSafeUserDisplay()` coerces IDs to strings; this review does not claim arbitrary malformed non-string SDK identities have been exhaustively tested. None of the four missing-ID fixtures remains accepted.
- The four unsafe provider/SDK error-reflection tests are untouched and intentionally RED; full callback page rendering, delayed SDK events and authorized Google OAuth remain unverified. Do not claim full auth sign-off, merge or student pilot from 006C.1 acceptance alone. Broad Handoff 006 stays HOLD.
