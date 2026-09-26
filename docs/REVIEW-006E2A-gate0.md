# REVIEW-006E2A — browser diagnostic harness correction

**Reviewed:** 2026-09-25; branch `fix/gate0-auth`. **Verdict:** Accept the narrow harness correction for the current RED diagnosis and authorize planning of one bounded route-guard RED→GREEN slice, with the test-control issue below fixed *before* changing production source. Gate 0 remains NOT passed. No production source, existing tests, dependency, commit, push, deployment, or real account was changed by this review.

## Independent evidence

- Worktree inspected; protected five-auth-file diff hash remains `2b50de1002c41ef3d18bc0bc01b42ec61a96887a8e714a9473f3b3161538cb75`; `git diff --check` exits 0.
- Fresh `npm run build`, `npm run lint`, `npm run typecheck` all exit 0. Fresh-build `npm run test -- --reporter=dot`: **87/87 pass across 6 files**. Browser `--case=controls` exits 0 with current-route-rendering, absent-session, and hard-reload controls passing. Browser `--case=red` exits 1: revoked and still-valid sessions both make **zero fresh `/user` requests** on SPA protected navigation; revoked token still sees `/protected` and verified banner. Missing host Playwright module exits 2 before servers start. No Classroom built-server orphan remains after these runs, unlike 006E2. Signal-interruption cleanup and missing built-artifact path were not independently probed.
- `main()` now reaches `finally { await cleanup() }` before exiting; child/Browser/HTTP stub cleanup is materially improved. Startup timeout now throws rather than silently proceeding. The still-valid route-rendering control is explicitly distinguished from the fresh-verification contract (RED); no fake GREEN claim for the latter.

## Required correction when moving to GREEN

`tests/browser-diagnostic-006e2.mjs:383-451` (Control 3) first clicks `/protected` **while the revoked token is already rejected**, then hard-reloads that page. It passes only because the current SPA guard incorrectly lets the click enter `/protected`. Once the guard is fixed, the click should redirect to `/`, so reloading would test `/` instead and the control would fail for an unrelated reason. Make this control independent of the bug: first enter `/protected` while the token is valid, then revoke it and hard-reload the already-open protected page; assert a new Auth verification request and redirect without a verified banner. Show that rewritten control still passes against the unchanged source before any guard edit. Keep the two policy contracts RED for the intended reason, then make only the guard change and verify both GREEN.

The harness's `sanitizeError()` redacts specific synthetic values and URLs but is not a general-purpose secret scrubber; continue using only synthetic data and avoid raw stderr/payload printing. Current normal-exit process behavior is verified, not all possible failure/signal paths.

**Next slice:** one test-control setup correction, then `app/middleware/auth.ts` protected-navigation verification only (no register feature, role/schema, callback refactor, or new dependency), with current browser contracts, SSR controls, full checks, and independent browser re-test. External Google OAuth and other Gate 0 boundaries remain open.
