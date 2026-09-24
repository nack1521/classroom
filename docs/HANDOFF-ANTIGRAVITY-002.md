# Antigravity handoff 002 — Repair Gate 0 auth spike

**Destination:** Antigravity IDE Agent panel, workspace `/Users/nack/Classroom`  
**Status:** Submitted to the Antigravity IDE Agent panel on 2026-09-24 after Nack confirmed; the IDE displayed the task and began working. Implementation and verification are pending.  
**Owner of planning/review:** Hermes. **Implementer:** Antigravity IDE.

## Prompt to send after confirmation

Work only in `/Users/nack/Classroom`. First read `docs/HANDOFF-ANTIGRAVITY-001.md`, `docs/HANDOFF-001-antigravity-result.md`, `docs/REVIEW-001-gate0.md`, relevant code/tests, and the current Git status. Keep every planning document and unrelated user change. Do not commit, push, deploy, or alter a cloud account. This is a **corrective Gate 0 task only**, not an invitation to implement courses, rosters, editor, or production hosting.

Correct the following as a single bounded auth slice:

1. Keep Nuxt SSR. Make browser and server share a cookie-backed Supabase auth session using the official `@supabase/ssr` approach (one allowable new production dependency). Make the server client **request-scoped**, never a module-global singleton across users. Guard `/protected` on the server with a **verified** user, not untrusted local-storage `getSession().user`, so a signed-in direct reload can work and a visitor still redirects. Client UI should not claim authentication from a forged stored session. No sensitive content is in this spike; do not relax future course authorization to a UI guard.
2. Handle Google OAuth callback consistently with the chosen Supabase SSR/browser flow. Recognize provider errors in query string as well as hash; a denied callback with an old session must report denial, not success. Reject malformed callback error text gracefully. Never log tokens or put tokens in the UI.
3. Correct the **two distinct redirect destinations** in the UI and handoff: Google Cloud Web OAuth authorized redirect URI = the exact Supabase Google provider callback URL shown in that project's dashboard (`https://<project-ref>.supabase.co/auth/v1/callback` for hosted Supabase); the local app's `http://localhost:3000/auth/callback` = allowed redirect in Supabase Auth URL Configuration and `signInWithOAuth({ options: { redirectTo } })`. Do not ask Nack to register the local app callback as Google's authorized redirect URI. Avoid making up an actual project ref.
4. Handle `signOut()` failure visibly instead of always silently navigating home. State clearly what is and is not known about persisted session on failure.

Evidence required: add tests that fail under the old behavior and pass after repair: SSR unauthenticated and authenticated request/guard behavior with a controlled server-client mock/cookie; forged stored-session denial; callback query/hash denial with a pre-existing session and malformed description; sign-out failure reporting. Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, and a local server check. Report exact commands/results, remaining untested integration steps, and changed files in `docs/HANDOFF-002-antigravity-result.md`. If no real Supabase/Google project is configured, explicitly mark **real OAuth round-trip and authenticated browser reload unverified**; do not fabricate success with a mocked user. Stop after this correction.

References for implementation choices: Supabase official SSR client guide (`https://supabase.com/docs/guides/auth/server-side/creating-a-client`), JS `getUser` reference (`https://supabase.com/docs/reference/javascript/auth-getuser`), Google provider (`https://supabase.com/docs/guides/auth/social-login/auth-google`) and redirect URLs (`https://supabase.com/docs/guides/auth/redirect-urls`).
