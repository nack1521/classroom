# HANDOFF 006F1 — prove the natural SDK SIGNED_IN race (TEST-ONLY)

Read `docs/REVIEW-006F-gate0.md`, the original `docs/HANDOFF-ANTIGRAVITY-006F-fast-close-diagnostic.md`, `tests/diagnostic-006f-row-b.test.ts`, `app/composables/useAuth.ts`, and the installed SDK `node_modules/@supabase/auth-js/src/GoTrueClient.ts:3598-3660`.

**One missing fact:** 006F Row B manually called private `_notifyAllSubscribers('SIGNED_IN', fabricatedSession)` while the held `/user` request may have been the SDK's **pre-event** `setSession()` verification. Thus a passing test did not establish the natural event → production listener's deferred request actually in flight → sign-out → stale result discarded.

**Scope:** Edit ONLY `tests/diagnostic-006f-row-b.test.ts` and write `docs/HANDOFF-006F1-antigravity-result.md`. Do not modify production, other tests, configuration, package files, policy, or the live pilot; preserve unrelated dirty files. No real accounts, commits, pushes, deploys, or student data.

**Acceptance:**
1. Use installed SDK to cause `SIGNED_IN` naturally (e.g. real `setSession` against controlled loopback); **never** invoke `_notifyAllSubscribers` or fabricate the event/session. Distinguish SDK's pre-event `/user` request from the production handler's subsequent **deferred** `/user` request with counters/gates or equivalent assertions. Observe a natural `SIGNED_IN` notification and prove the second request has started before initiating sign-out. Avoid deadlock: if sign-out awaits an SDK lock, initiate it, prove invalidation began, release the held deferred response, then await completion.
2. Negative race: after sign-out, the late response must not restore `auth.user.value`; explicitly prove sign-out was invoked and the deferred response released. Positive control: same natural event with no sign-out populates verified user. Use deterministic bounded waits and fail loudly on timeout—no fixed 60ms sleep as sole evidence. Do not make SDK calls from within auth event callback.
3. On a test/environment constraint, report **UNVERIFIED**, do not manually dispatch the event to make a test pass. On real RED, stop and report precise ordering/fixture evidence; no production fix.

Run `npx vitest run tests/diagnostic-006f-row-b.test.ts --reporter=dot`, `npm run test -- --reporter=dot` (report 6 default skips separately), `npm run lint`, `npm run typecheck`, `git diff --check`, and the five-auth-file diff hash against `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3`. Record event/request ordering without printing tokens. Stop for Hermes review; the authorized live OAuth pilot has been completed by Nack and recorded in `docs/GATE0-LIVE-PILOT-CHECKLIST.md`, but Gate 0 still needs independent acceptance of this event-race boundary.
