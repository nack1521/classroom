# Gate 0 independent review 004 — not accepted

**Reviewed:** 2026-09-25  
**Branch:** `fix/gate0-auth`  
**Scope:** `docs/HANDOFF-ANTIGRAVITY-004.md` and the six auth/source/test files changed by Antigravity. `PLANNING_PAPER.md` was edited separately by Hermes and excluded from the implementation verdict.  
**Decision:** Fail-closed. Do not merge/push the correction or claim live OAuth works. No real account, roster, secret, deployment, or cloud project was used in this review.

## Verification reproduced

- `npm run test`: **38/38** passed across four files. `npm run lint`, `npm run typecheck`, `npm run build`: passed. The intentional invalid-token stub emits an HTTP 401 during tests.
- Fresh built-app HTTP probes: `/` 200; unauthenticated `/protected` 302; forged-cookie `/protected` 302; `/auth/callback` 200. Test server stopped. These do not verify an authenticated reload or Google OAuth.
- `git diff --check` reports one new blank line at EOF in `tests/review002-integration.test.ts:356` (non-blocking cleanup).
- An independent read-only reviewer reproduced callback false success and corroborated the SSR/race gaps. The result document's claim of completion is not verification.

## Proven blockers

1. **A reused code can authenticate the wrong prior session.** `app/utils/auth.ts:271-272,342-356` uses a process-global `processedCodes` set. After client A processes a code, client B with an old user and the same code skips exchange; `getUser()` returns B's old user and `processAuthCallback()` reports success. A direct local synthetic probe reproduced `second_success_with_old_session:true`, `second_user_id:'old-user'`, `second_exchange_called:false`. Code success must be bound to the *current* exchange and its session/user, not only to a code string seen elsewhere.
2. **The callback accepts a missing new session as success.** `app/utils/auth.ts:359-369,392-405` checks only `error` from `exchangeCodeForSession()`. With `{data:{session:null,user:null}, error:null}` and a pre-existing verified user, a direct probe returned `{success:true, user_id:'old-user'}`. Likewise, the hash-token branch at `:376-390` skips session setup when `setSession` is absent but still calls `getUser()`; a probe returned success for the old user without setup. Avoid logging or persisting token/code values in diagnostics.
3. **A sign-out cannot invalidate every already-running auth event verification.** `app/composables/useAuth.ts:95-104` commits the subscriber's deferred result unconditionally and increments `stateGeneration` only *after* the commit decision. `signOut()` at `:167-169` increments the generation and clears the user, but does not invalidate the helper's local event sequence if no `SIGNED_OUT` notification arrives. A pending `SIGNED_IN` verification can later restore the old user. The independent reviewer reproduced this with a controlled pending verification. The current production-composable test (`tests/review002-integration.test.ts:330-351`) signs out immediately after scheduling the zero-delay handler, without proving the verification actually began, so it misses this ordering. Sign-out failure also leaves the UI cleared while the persisted session may remain (`useAuth.ts:167-185`); the state and error handling need an explicit, honest policy.

## Integration/real-world evidence gaps

4. **SSR integration stops before the actual composable/default middleware.** `tests/regression-review001.test.ts:212-234,246-268,282-304` passes a manually constructed `authContext.checkVerifiedUser` to the exported handler. It does exercise cookie parsing, request-scoped Supabase client, `getUser()` and a local Auth HTTP stub, which is progress, but does **not** invoke production `useAuth()` or the default middleware at `app/middleware/auth.ts:36-40`. The identity-isolation test at `tests/regression-review001.test.ts:326-336` verifies clients sequentially, not concurrent built-app HTTP requests. Therefore the claimed cookie → production composable → middleware chain and authenticated SSR reload are unproven.
5. **Browser PKCE may exchange the same code twice.** `app/utils/supabaseClient.ts:71-73` constructs a default `createBrowserClient`; the installed `@supabase/ssr/src/createBrowserClient.ts:143-152` enables `detectSessionInUrl` in a browser. The installed `@supabase/auth-js/src/GoTrueClient.ts:671-692,3894-3900` auto-exchanges a PKCE callback during initialization, while the app calls `exchangeCodeForSession()` again at `app/utils/auth.ts:359-360`; the public method waits for initialization at `GoTrueClient.ts:1572-1577`. This is a concrete source-level conflict but an actual OAuth round-trip was **not** run. Choose one owner of code exchange and exercise its full callback path with a controlled Auth endpoint/browser harness before accepting it.

**Remaining external gates:** authorized school Google account sign-in (including student-designated policy), real authenticated browser reload, school approval for external data handling, enrollment/RLS, media permissions, backup/restore, and launch rehearsal. None is proven by 38 local tests.
