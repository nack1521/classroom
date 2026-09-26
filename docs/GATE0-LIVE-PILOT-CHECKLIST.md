# Gate 0 authorized live Google OAuth pilot — operator checklist

**Status 2026-09-26:** OWNER-REPORTED PASS for the Gate 0 live Google round trip with personal and authorized school-managed accounts, including signed-in page reload and post-logout checks; live cancel/denial not reported (synthetic negative browser evidence is separate). Nack reported permission from the teacher managing school Google accounts for this account-level test. This is not permission to upload/host real student data. No secrets or real account identifiers belong in this file, chat, or Git.

## Preflight (Nack privately)

- Nack filled `.env` privately; Hermes checked **presence/type only** (configured URL, publishable key, local site URL, Git-ignored) without exposing values. Use the publishable/anon client key, **never** a service-role/secret key. Do not show `.env`, tokens, cookies, or browser URL query/hash in chat/screenshots/logs.
- In the Google OAuth client, verify the authorized redirect URI points to the project's **Supabase Auth callback**. In Supabase Auth URL configuration, allow the application's exact local `/auth/callback` redirect; verify the Google provider is enabled and the test accounts are in the permitted audience as needed. Do not change school-wide access policy unless the account administrator approves.
- Start the app locally (`npm run dev` for a private manual pilot); avoid sharing console output, which may contain session metadata. Use a fresh browser profile or sign out between accounts. Do not use student names/rosters or grant course access.

## Record outcomes (no identifiers or screenshots with codes)

1. Personal Google account: click sign-in → Google consent → app callback; record whether the *matching* account is shown, success UI appears, automatic `/protected` navigation happens, a fresh `/protected` reload stays verified, and sign-out returns public home.
2. Authorized school Google account: repeat the same sequence. If Google/Workspace blocks consent, record **BLOCKED** with a sanitized category only and ask the school account administrator; do not call Gate 0 passed.
3. Cancel a login from Google: safe public notice, no automatic protected continuation. A separately valid older session may still be re-verified on a deliberate later navigation; record whether this distinction holds.
4. If the school account is an adult/teacher account, mark a **student-designated account** pilot as a separate future rollout prerequisite; one adult login is not proof for a class of students.

For each scenario record only `PASS / FAIL / BLOCKED`, the route/state observation, and a short sanitized error category—never email addresses, access/refresh tokens, auth codes, screenshots of the address bar, or real student data. This pilot plus local reviewed evidence can close Gate 0; it does not certify enrollment authorization, RLS, or real-student-data handling.

## Owner-reported observations (2026-09-26)

- Personal Google account: sign-in **PASS**, `/protected` while signed in **PASS**, sign-out **PASS**, refresh after sign-out shows no session **PASS**.
- Authorized school-managed Google account: same four observations **PASS**. Account's student/teacher designation was not established here; this is not a student-designated-account rollout test.
- Signed-out visitor: direct `/protected` denied **PASS**, refresh shows no session **PASS**.
- The first attempt received `Unsupported provider: provider is not enabled`; after provider setup Nack reported the above successful runs. This does not imply any token or credential was shared.
- Nack subsequently confirmed refresh of both public home and `/protected` **while signed in** remained authenticated; the prior post-logout refresh remained unauthenticated. This is owner-reported, not independently observed by Hermes.
- **Still unreported, not required for this time-boxed Gate 0:** live Google consent cancellation. Rendered failure controls have separate synthetic browser evidence in `docs/REVIEW-006F-gate0.md`. Student-designated account policy remains a later rollout prerequisite if the tested school account was not student-designated.
