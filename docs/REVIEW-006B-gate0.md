# REVIEW-006B — sign-out correction independent check

**Reviewed:** 2026-09-25  
**Branch:** `fix/gate0-auth`  
**Verdict:** Observed remote-500 path improved, but **006B is not fully accepted** because the new local-session check treats an unreadable session as a confirmed absent session. Gate 0 remains blocked independently by the six callback/error RED tests. No real account was used; no commit/push/deploy authorized.

## Independently verified

- Protected production diff SHA-256 changed from pre-006B `bdaf30ab67067effe0eb7679fe59fef4c5264581692d457c4e8cbedef7b7cc03` to `8f25f40b5122d648368caab59c824414eb991b5aeab122f78f11895940aa3564`. Recent mtimes and source inspection match sign-out edits in `app/utils/auth.ts`, `app/composables/useAuth.ts` and test edits; other production source paths retain earlier mtimes. Existing dirty work was not reset.
- Fresh `npm run lint`, `npm run typecheck`, `npm run build`: exit 0. `npm run test`: exit 1 with **51 passed / 6 expected RED** (two callback identity, four error-reflection); no additional test failures. Focused Case 2 real-SDK tests: 3 passed; Review 002 suite: 14 passed; fresh-built SSR regression: 15 passed. `git diff --check`: exit 0.
- `tests/diagnostic-handoff006a.test.ts:224-311` invokes production `useAuth().initAuth()`/`signOut()` with a real installed `GoTrueClient` against a loopback `/logout` 500. It verifies `SIGNED_OUT`, removed local storage, null UI user, a generic warning and navigation to `/`. This is meaningful progress over a mock returning `{error}` alone. The public page has a `signOutError` display (`app/pages/index.vue:30-33`), but the new test does not mount/render the page; visibility is still inferred from source and shared state.

## Proven blocker — unreadable local session classified as deleted

`app/utils/auth.ts:108-120,143-154` initializes `hasLocalSession=false` and **sets it to false when `getSession()` throws or returns `{error, data:{session:null}}`**. Both situations mean the local state is *unknown*, not that its deletion was verified. Under remote sign-out error, `:122-138,156-171` calls `clearLocalSession()` and returns `localSessionCleared:true` with a message saying sign-out completed locally. `app/composables/useAuth.ts:185-195` then clears UI and navigates to `/`. A direct read-only probe calling the actual `executeSignOut()` with a failed remote sign-out and a throwing `getSession()` produced `{cleared:true,localSessionCleared:true,warningSaysCompletedLocally:true}`; an error-bearing `getSession()` result did the same. This violates the brief's requirement to distinguish confirmed local removal from unconfirmed persistence. The current tests cover only readable-null and readable-present sessions, not unreadable/error results.

Fix as a **narrow follow-up**, not another broad auth patch: model local session as present / absent / unknown, write a focused failing test for thrown and error-returning `getSession()`, and make the warning/navigation/state claims truthful for unknown. Do not use `getSession().user` as verified identity. A real SDK `SIGNED_OUT` event may independently clear UI; do not override that based on a guessed session read. Re-run the existing remote-500, retained-session, successful sign-out and race tests.

## Evidence limits

The in-flight test at `tests/diagnostic-handoff006a.test.ts:313-404` pauses a **direct `checkVerifiedUser()` call** by replacing `client.getUser`; it does not trigger a pending `SIGNED_IN` event from the SDK before failed sign-out. It proves generation invalidation for that direct check, not the exact event-subscriber race claimed in the handoff. The report does identify the direct call, so treat the event-race as unverified rather than silently equating them. There is also no rendered UI assertion for the public warning. The other six RED tests remain deliberately failing; no real Google OAuth, school-account policy or RLS is proven.

**Next gate:** Do not submit callback/error fixes or broad Handoff 006 yet. Repair only the tri-state local-session classification and add a real pending-event race test if feasible; independent review again before accepting this slice.
