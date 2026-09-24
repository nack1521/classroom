# REVIEW-001 — Gate 0 OAuth spike

**Date:** 2026-09-24  
**State:** Local checks independently rerun; independent reviewer corroborated blockers and found additional auth/callback issues. **Do not configure school OAuth or treat Gate 0 as accepted yet.**  
**Scope:** `/Users/nack/Classroom`; no code edits, commit, push, account changes, or real-school login in this review.

## Verified independently

- `npm run test`: 17/17 passed (2 files).
- `npm run lint`, `npm run typecheck`, `npm run build`: exit 0.
- Local production server on port 39127: `HEAD /` 200; `HEAD /protected` 302 to `/?auth_required=true`; `HEAD /auth/callback` 200. Server stopped afterward.
- Git repo initialized on `main`, **no commits**. No `.env` exists. `.gitignore` excludes `.env`, `.env.*`, `node_modules`, `.output`; source/config/test scan found no private-key block, service-role string, JWT-shaped literal, or credential assignment. This targeted scan is not a security audit.
- No live Google or Supabase OAuth round-trip was run.

## Blockers to acceptance

1. **Session persistence on direct reload fails under SSR.** `app/middleware/auth.ts:19-24` checks `useAuth().user` during the server request. `app/composables/useAuth.ts:21,39-77` initializes the state to `null` and retrieves Supabase session from browser-side storage only in `app/app.vue:4-6` on mount. The server does not receive that browser storage. Thus a signed-in learner directly reloading `/protected` gets the 302 before client initialization, contrary to Gate 0's reload acceptance criterion. Existing middleware tests call a pure boolean helper and do not test the integration. **Decision:** keep SSR and use a request-scoped cookie-backed Supabase client (the official `@supabase/ssr` path), not a global server client or a client-only guard; verify reload with an authorized account later. Official Supabase SSR guide: https://supabase.com/docs/guides/auth/server-side/creating-a-client
2. **Google Cloud redirect instructions are wrong.** `docs/HANDOFF-001-antigravity-result.md:101-105` and `app/pages/index.vue:119-128` tell the user to register `http://localhost:3000/auth/callback` as a Google authorized redirect URI. In the Supabase-mediated Google OAuth flow, Google's authorized redirect URI is the **Supabase provider callback** shown by the Supabase Dashboard (typically `https://<project-ref>.supabase.co/auth/v1/callback`); the local app's `/auth/callback` belongs in **Supabase Auth URL Configuration's redirect allow list** and in `signInWithOAuth({ options: { redirectTo } })`. Google's authorized JavaScript origin can be `http://localhost:3000` if applicable. Correct UI and handoff before any manual configuration. Official references: https://supabase.com/docs/guides/auth/social-login/auth-google and https://supabase.com/docs/guides/auth/redirect-urls
3. **Browser-stored session can forge the UI's authenticated state.** `app/composables/useAuth.ts:54-60` treats the `user` in `getSession()` as verified, and `app/middleware/auth.ts:21-23` trusts that state. Independently reproduced with the installed Supabase client and a synthetic stored session with `access_token: "not-a-real-jwt"`: `getSession()` returned `error: null` and `user.id: "forged-user"`. The client guard may therefore display the protected *spike screen* to an unauthenticated user. This does **not** show a bypass of Supabase RLS or access to course content (neither exists yet). Validate identity with `getUser()` or another verified method before indicating authentication; never use client-only UI guards as data authorization. Official reference: https://supabase.com/docs/reference/javascript/auth-getuser
4. **Callback can misreport a denied new login as success.** `app/pages/auth/callback.vue:8-18` forwards only `window.location.hash`, while `app/composables/useAuth.ts:132-168` ignores query-string provider errors and considers any pre-existing session proof of this callback's success. With `?error=access_denied` and an old session, the UI can say success and redirect to `/protected`. Parse both query/hash error locations, reject on a provider error before checking session, and test a denied callback when an old session exists.

## Additional concern

- **Sign-out error is hidden:** `app/utils/auth.ts:81-96` clears local display state even when Supabase `signOut()` reports an error; `app/composables/useAuth.ts:122-125` ignores the returned failure and navigates home. Surface the failure and verify the session state. Whether a network error leaves a persisted session in the installed Supabase client was not established; do not claim that reload reauthenticates without a reproducer.
- `app/utils/auth.ts:116` applies `decodeURIComponent` to a string already decoded by `URLSearchParams`. A malformed `%` in the provider error description can throw *before* `handleCallback`'s `try` (`app/composables/useAuth.ts:133-140`), leaving the callback without a handled error. Remove the second decoding or handle malformed input and cover it with a test.

## Next gate

Have Antigravity repair these **within Gate 0 only** using `docs/HANDOFF-ANTIGRAVITY-002.md` after Nack confirms submission, with focused regression tests and correct documentation; Hermes reruns checks and route/callback behavior. After code review passes, Nack can configure external OAuth in their own dashboards and try an authorized school test account. A local green build never proves that school accounts can authenticate. No enrollment/course access is in scope yet.
