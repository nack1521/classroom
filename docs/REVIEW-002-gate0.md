# REVIEW-002 — Gate 0 corrective implementation

**Date:** 2026-09-24  
**Verdict:** Not accepted yet. Local checks pass, but an auth-state callback can hang the client; SSR authenticated reload still needs an integration test and an authorized live pilot. No real Google/Supabase account was accessed.

## Independently verified

- `npm run test`: 26 tests across 3 files passed; `npm run lint`, `npm run typecheck`, `npm run build`: exit 0.
- Fresh local production server: `GET /` 200, unauthenticated `/protected` 302 to `/?auth_required=true`, `/auth/callback` 200. Server stopped afterward.
- `.env` absent; `.gitignore` excludes local `.env`, `node_modules`, `.output`; no commits or deployment.
- Code now uses `@supabase/ssr` browser/client cookie storage and a request-scoped server client in `app/utils/supabaseClient.ts:29-60`; identity check calls `getUser()` in `app/utils/auth.ts:199-223`; callback checks query/hash errors before an old session in `app/utils/auth.ts:231-258`; setup guidance distinguishes Google provider callback from local app redirect. These are improvements over REVIEW-001, but the tests do not prove a real authenticated reload.

## Blocking finding — Supabase auth-state callback awaits another auth call

`app/composables/useAuth.ts:75-79` registers `onAuthStateChange(async ... => await checkVerifiedUser())`; that function calls `client.auth.getUser()` (`:43`, `app/utils/auth.ts:203`). Supabase's auth notification awaits its subscribers, and in the browser's locked auth path `getUser()` waits to reacquire the same lock. This can leave authentication/event processing hanging after sign-in or token refresh. Official Supabase troubleshooting: https://supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0

Synthetic local repro with the installed auth-js lock path: an auth callback awaiting `getUser()` during a `SIGNED_IN` notification timed out after 700 ms; this is a library-path test, **not** a real Google sign-in. Remove awaited Supabase calls from the auth-state callback; schedule verification after the callback returns, with error/race handling, or use another documented safe strategy. Add a test for a sign-in event that cannot hang subsequent Supabase calls.

## Evidence gap — SSR request/cookie integration is not tested

`tests/regression-review001.test.ts:124-145` is labeled an SSR guard integration test but only calls `authGuard(to, from, true/false, mockNavigateTo)`. It never constructs the request-scoped client, supplies cookies, verifies `getUser()`, or sends an authenticated HTTP request. The sole runtime probe confirms the unauthenticated 302. Add a synthetic configured SSR request test with request-scoped cookie adapter + stubbed Auth verification (and a forged/invalid cookie), then still mark **real authenticated browser reload unverified** until Nack configures the external project and tests an authorized account. Do not claim real auth from mocked tests.

## Not blocking this local repair, but keep explicit

- `processAuthCallback()` considers a previously verified user sufficient for success if the callback URL has no provider error, even without evidence of a fresh OAuth response (`app/utils/auth.ts:231-258`). A direct visit to `/auth/callback` with an old session can falsely say the new callback succeeded. If fixing this within the same correction, require a code/flow result rather than merely an old user; do not break valid PKCE processing.
- There is no real Google OAuth project, Supabase project config, or school policy result here. Release to students remains blocked independently of local code quality.

**Next action:** One bounded Antigravity correction to remove the auth event deadlock and replace misleading SSR tests with a real request/cookie-boundary test. Hermes reviews and reruns checks; Nack performs external OAuth setup/pilot only after local review passes.
