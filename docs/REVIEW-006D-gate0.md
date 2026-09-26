# REVIEW-006D — safe OAuth callback errors

**Reviewed:** 2026-09-25; branch `fix/gate0-auth`.  
**Verdict:** Accept **only the narrow 006D callback-error correction**, despite Antigravity's later network interruption. The result file exists and the actual callback function maps provider/SDK failures to fixed categories without forwarding raw descriptions, codes, or exception messages. **Gate 0 is not signed off.** No IDE rerun, commit, push, deployment, credentials, or school account was used.

## Independent evidence

- The 006C1 protected production diff baseline was `8c716d13a942a6a097ada61e1f12e3aa7a787ea07fd94ce5c0c9b8e77a61af79`; current hash is `809a42465d9fd2a71abf51c14cdd2bc65a8faff150c939dce1f8d2e9e5320951`. Earlier worktree remains dirty; this hash is not a commit or complete attribution of intermediate edits. `git diff --check` exits 0.
- Hermes independently reran the focused Case 3 suite **13 passed** and review002 integration **20 passed**. Then `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` all exited 0 on a fresh build: **78 passed across 5 files**. These results are independent of Antigravity's report; its RED-first sequence was reported, not independently witnessed.
- In `app/utils/auth.ts:394-408,457-474,504-523,547-553`, callback provider errors and returned/thrown exchange, setSession and verification errors use fixed messages; no raw input is concatenated into returned errors. `tests/diagnostic-handoff006a.test.ts:620-923` exercises marked error sources and app-seam failures. `app/pages/auth/callback.vue:9-22,35-61` offers `/protected` only on success; actual rendered DOM/browser flow was **not tested**.

## Limits and follow-up

- This approval does **not** mean all auth errors are sanitized: `app/composables/useAuth.ts:99-111,150-155` still assigns raw SDK `.message` to `authError` for init/event and sign-in flows; the public page displays that state. This is outside the bounded 006D callback handler and makes the result report's broad safety language (`docs/HANDOFF-006D-antigravity-result.md:6`) overbroad.
- Delayed `SIGNED_IN`/verification after a failed callback is not covered by the new app-seam tests. The generation guard at `useAuth.ts:216-246` alone does not prove a later event cannot repopulate an old user (`useAuth.ts:95-108`). Route middleware may reverify an old valid session (`app/middleware/auth.ts:28-33`); callback denial is not session revocation. Establish the desired identity/session policy and test this in the final integration review rather than assuming stale identity is eliminated.
- Rendered callback DOM/navigation, SDK event race, and authorized real Google OAuth with a school account remain unverified. Broad Handoff 006 stays HOLD. Do not treat 78 green tests as Gate 0 acceptance or a student-pilot clearance.
