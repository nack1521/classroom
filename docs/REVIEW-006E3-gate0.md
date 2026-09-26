# REVIEW-006E3 — protected SPA route verification

**Reviewed:** 2026-09-25; branch `fix/gate0-auth`. **Verdict:** ACCEPT this bounded route-guard correction. The prior stale-client-state SPA navigation defect is GREEN under the synthetic browser boundary. **Gate 0 remains NOT PASSED**; no commit, push, cloud change, or real school OAuth was performed by this review.

## Independent verification

- Inspected the IDE report, `app/middleware/auth.ts`, browser diagnostic, and new focused handler tests. Compared the protected-auth-file diff hash to the pre-task `2b50de1002c41ef3d18bc0bc01b42ec61a96887a8e714a9473f3b3161538cb75`; current hash is `54c0f2766ac6a685c1c14e31fcbcbcf4901ce69f91d99f777e82d899925501b6`. The implementation's production edit is confined to the route-guard seam; pre-existing dirty/untracked files remain. `git diff --check` passes.
- Fresh `npm run build` succeeds. `npm run lint`, `npm run typecheck` exit 0. `npm run test -- --reporter=dot`: **92/92 tests across 7 files pass**; focused 006E3 handler suite **5/5** passes. Vitest emits pre-existing synthetic SDK warnings/expected HTTP error logs; passing tests do not mean those other auth boundaries are complete.
- Ran browser `--case=controls`, `--case=contract1`, `--case=contract2` independently and the combined default case against the freshly built app with synthetic cookie and loopback Auth stub: **all exit 0**. Hard-reload control enters `/protected` while valid, then revokes and reloads: fresh Auth requests, redirect to `/?auth_required=true`, no verified banner. On deliberate SPA protected navigation after denial/home hydration: revoked token causes **1 fresh Auth request**, redirect to `/?auth_required=true`, no verified banner; still-valid token causes **1 fresh Auth request**, reaches `/protected` with verified banner. Absent-session control redirects. No Classroom built-server orphan detected after runs.
- Source now calls `checkVerifiedUser()` on every protected route navigation even when cached `signedIn` is true, bases this route decision on the fresh return value, and fails closed for unconfigured/exception/null result. Public routes retain the prior behavior. This review proves route/UI behavior at the tested browser boundary; it does not establish server-side data authorization, cross-tab identity quarantine, or live OAuth.

## Nonblocking test-label debt and remaining gates

`tests/browser-diagnostic-006e2.mjs` still labels the two contracts “Expected RED” and has a stale comment suggesting delta 0, even though both now pass. These are misleading comments/headings only, not assertions or a failed check. Clean them when next touching this diagnostic; do not reopen a production fix for label polish.

Next Gate 0 boundaries remain distinct: mismatch/ambiguous-identity quarantine across SDK sessions, in-flight real-SDK auth-event race, safe user-visible error categories outside callback, rendered successful callback/navigation, and authorized live Google OAuth. The draft onboarding spec is not part of this slice.
