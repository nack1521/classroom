# Antigravity handoff 006D — safe OAuth callback errors

**Workspace:** `/Users/nack/Classroom`, branch `fix/gate0-auth`  
**Status:** Nack approved this slice; the exact full 006D prompt is confirmed present in the Antigravity IDE composer via read-only Accessibility inspection, but it has **not been submitted**. Do not type a duplicate. Broad Handoff 006 remains HOLD.  
**Protected production diff baseline SHA-256:** `8c716d13a942a6a097ada61e1f12e3aa7a787ea07fd94ce5c0c9b8e77a61af79` from `git diff --binary -- app/ nuxt.config.ts package.json package-lock.json vitest.config.ts | shasum -a 256`. Preserve all existing dirty/untracked work. No commit, push, deploy, cloud/account setup, or real school data.

## Read and scope

Read repository instructions, `docs/REVIEW-006C1-gate0.md`, `tests/diagnostic-handoff006a.test.ts:620-704`, `tests/regression-review001.test.ts:16-70`, `tests/review002-integration.test.ts:170-320`, `app/utils/auth.ts:224-312,390-543`, `app/composables/useAuth.ts:212-254`, `app/pages/auth/callback.vue:1-62`, and `vitest.config.ts`. Correct **only OAuth callback error surfaces** that accept provider URL or SDK text; do not change identity-binding, sign-out, SSR, sign-in/initAuth event handling, roles, dependencies, schema, or broad Handoff 006. Keep parser `parseAuthCallbackUrl()` able to detect query/hash provider errors and existing parsing contracts, but never forward untrusted parser values verbatim to a displayed error.

## User-visible contract and case matrix

`processAuthCallback()` and `useAuth().handleCallback()` must return failure and a **safe, non-sensitive, actionable category** rather than reflecting arbitrary provider `error`, `error_description`, SDK `.message`, auth code, access/refresh token, callback URL, or synthetic marker. An allowlisted constant `access_denied` category may be preserved for the existing denied-callback regression; unrecognized error codes are generic. Do not sanitize by searching for particular marker text or by merely HTML-escaping (Vue escaping does not hide secrets). Never log raw callback URLs or error payloads.

Independently assert each meaningful source and at least one positive/negative control; each failed callback has `success:false,user:null`, `authError` safe at app seam, and no success navigation:

1. **Provider query:** `error=access_denied` plus `error_description` containing synthetic marker → a safe denial category, no description/marker returned. Existing Case 3 RED test must go GREEN.
2. **Provider hash:** `error=interaction_required` plus marked `error_description` → safe retry category without description/marker. Existing Case 3 RED goes GREEN.
3. **Provider error code itself:** arbitrary unrecognized `error` containing a distinct synthetic marker with no description → generic safe text, no code/marker; add RED test before source edit. Preserve priority of provider denial over pre-existing session without calling `getUser()`.
4. **PKCE exchange returned error:** `.message` contains distinct marker → safe exchange failure, no marker. Existing Case 3 RED goes GREEN.
5. **Hash `setSession()` returned error:** marked `.message` → safe session setup failure; add RED before source edit.
6. **`getUser()` returned or threw error:** marked message → safe verification failure; existing Case 3 RED for returned error goes GREEN; add thrown variant if useful. No stale user fallback.
7. **Thrown exchange/setSession exception:** callback must return a safe failure instead of leaving the page on a rejected `onMounted` promise/spinner; add RED test for both SDK methods, then minimal catch, no marker. Do not mask implementation exceptions as an authenticated success.

Positive controls: matching PKCE and hash identities still sign in; provider error still denies even with an old stored session; harmless error category still explains why user can retry. For every new case, construct the actual failing fixture and watch the production function fail for the expected reason before changing source. Convert assertion output that echoes synthetic markers (e.g. `not.toContain(marker)` on a failing string) to boolean comparisons `expect(result.error?.includes(marker)).toBe(false)` **before** capturing RED output; the assertion must remain equally strict. Do not echo markers in the handoff report.

## Real app boundary and regression checks

- Add a controlled **production `useAuth().handleCallback()`** test for at least a provider URL failure and an SDK exchange failure with pre-existing UI user. Assert `authError`, return text, and UI user are safe; do not merely test a copied helper. `app/pages/auth/callback.vue` displays `result.error || authError`; try a deterministic rendered-page check with existing Vue/happy-dom tools (or a controlled browser) for at least one failure, asserting the marked input never appears in visible text and `/protected` is not offered or reached. Current Vitest config has no Vue SFC plugin; **if rendering is not feasible without adding dependencies or widening this slice, explicitly mark DOM rendering UNVERIFIED**, not green, and leave it for the final browser review. Do not add a dependency solely to make this test easy.
- Earlier `tests/review002-integration.test.ts` expects *raw* reused-code and invalid-token messages. Replace only those unsafe assertions with fixed category/no-leak assertions, keeping their failure/old-session invariants. The `access_denied` regression may assert only the allowlisted fixed category; it must not require raw `error_description`. Check other tests expecting exact raw strings and update only if they conflict with the approved safe policy; preserve all positive controls.
- Run `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run test` on a fresh build; goal **all tests green** including four existing Case 3 REDs and new security tests. Run focused Case 1 identity tests, sign-out integration + real SDK remote-500 test, SSR built-server tests, missing-artifact negative control, and `git diff --check`. If suite remains RED, do not report success or weaken tests. Distinguish parser-only tests from user-visible callback tests, unit/app/render boundaries, and SDK/cloud behavior. No real OAuth login yet.

## Stop/report

Write `docs/HANDOFF-006D-antigravity-result.md`: pre/post hashes, exact changed paths, RED→GREEN matrix with commands/exit counts (no raw marker/error payloads), retained controls, any unrendered/SDK event/cloud boundary, and what remains for Gate 0. Stop for Hermes independent review; do not start a final integration pass or broad Handoff 006 without approval.
