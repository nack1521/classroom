# REVIEW-003 — Handoff 003 independent verification

**Date:** 2026-09-24  
**Verdict:** **Gate 0 not accepted.** The auth-subscriber deadlock mechanism was addressed, but a stale verification can still restore signed-in UI after sign-out, and the claimed SSR cookie tests do not cross the cookie→client→verified identity→production middleware boundary. An independent read-only reviewer reproduced the stale-state issue and corroborated the missing SSR boundary and callback false-success case. No real OAuth or school account was used.

## Checks Hermes ran

- `npm run test`: 33 tests, 4 files, exit 0. `npm run lint`, `npm run typecheck`, `npm run build`: exit 0.
- Fresh production server on 39132: `GET /` 200; unauthenticated `/protected` 302 to `/?auth_required=true`; `/auth/callback` 200; `/protected` with synthetic `sb-access-token=not-a-jwt` 302. The server was stopped. This does **not** test authenticated reload or real Supabase cookies.
- `.env` absent; all project files are untracked and Git has no commits. No commit/push/deploy was performed by Hermes.

## Blocker 1 — stale verification mutates user before generation check

`app/utils/auth.ts:241-268` guards only the handler's `onUserVerified(verified)` write with its `sequence`. But production passes `() => checkVerifiedUser()` from `app/composables/useAuth.ts:76-84`; `checkVerifiedUser()` writes `user.value` itself at `:44-51` before resolving. A `SIGNED_IN` verification started before `SIGNED_OUT` can therefore overwrite `user.value = null` even though the wrapper later discards its return value.

Reproduced with the actual `createSafeAuthStateHandler()` source and a verification function that writes state as `checkVerifiedUser()` does: after `SIGNED_OUT`, state is `null`; when the prior verification resolves, state becomes `{signedIn:true,id:'student',...}`. The existing race test (`tests/review002-integration.test.ts:52-92`) gives the helper a side-effect-free mock verifyFn, so it misses the production path. This is a forged *UI/auth-state* restoration risk; it does not prove access through Supabase RLS. Refactor verification so it returns a result without writing shared state, and commit to `user.value` only after checking the current generation; add a regression that exercises the real composable-side effect/guard.

## Blocker 2 — claimed SSR cookie/guard integration still does not exist

`tests/regression-review001.test.ts:127-222` constructs request events/cookies but never passes those events to `evaluateSsrRouteGuard`; it passes hand-made auth clients with predetermined `getUser()` results. The event headers are thus unused for the allow/deny tests. The distinct-client test at `:224-241` and `tests/review002-integration.test.ts:133-175` only show different H3 events get different client objects. They never call `getUser()` on those real clients and never exercise the actual middleware in `app/middleware/auth.ts:19-29`. `evaluateSsrRouteGuard` itself (`app/utils/auth.ts:337-361`) is only referenced by tests, not by production middleware.

Consequently the handoff's claim of an authenticated synthetic SSR request/cookie-boundary test is not supported. Test the production middleware/request-scoped `getSupabaseClient` chain with an actual synthetic cookie and stubbed Auth endpoint, absent/invalid cookies, and separate requests; a mock client supplied directly to an unused helper is not that boundary. Do not call the live reload verified until an authorized browser pilot.

## Additional callback issue — code presence is not exchange success

`app/utils/auth.ts:293-329` treats `?code=...` merely as a presence check, then calls `getUser()`. With a pre-existing verified session, `processAuthCallback(client, '/auth/callback?code=bogus-invalid-code')` returns `{success:true,user:'old-user'}` in a synthetic probe. The independent reviewer also reproduced false success with an empty code and hash `token_type` alone. No explicit code exchange is performed by this function, and it has no way to attribute a verified old session to the latest OAuth response. This can falsely report a new login success in the spike UI; it is not a demonstrated data-access bypass. Resolve by tying success to a successful PKCE code exchange/flow completion and verified identity, or document and test a library-managed automatic exchange with both success and failure cases.

## Progress and remaining gate

The event callback now returns synchronously and schedules verification with `setTimeout(..., 0)`, avoiding the previously observed in-callback wait. A direct `/auth/callback` visit without OAuth parameters is rejected. Those improvements do not outweigh the blockers above. The school OAuth/Workspace policy, authenticated browser reload, and authorization/enrollment remain independent release gates.

**Independent review:** `deleg_6f1acd57` (read-only) corroborated all three findings with source locations and a separate synthetic race reproduction. These are two proven logic problems (stale state, callback false-success) and an unresolved test-evidence gap (SSR chain), not evidence of an RLS bypass or a failed real school-account login.
