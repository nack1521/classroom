# Antigravity handoff 006C.1 — require all callback identity IDs

**Workspace:** `/Users/nack/Classroom`, branch `fix/gate0-auth`  
**Status:** Submitted to Antigravity IDE on 2026-09-25; sent message and **Working** confirmed in panel. Broad Handoff 006 stays HOLD.  
**Protected production diff baseline SHA-256:** `28baec434dd4e085278173cc5907b8152ce77927054045e185a2e6499faf49c9` for `git diff --binary -- app/ nuxt.config.ts package.json package-lock.json vitest.config.ts | shasum -a 256`. Preserve all dirty/untracked work; list changed paths and compare the hash afterward. No commit, push, deploy, account/config changes.

## Read and scope

Read repository instructions, `docs/HANDOFF-ANTIGRAVITY-006C-callback-identity.md`, `docs/REVIEW-006C-gate0.md`, `app/utils/auth.ts:439-541`, and `tests/diagnostic-handoff006a.test.ts:8-213`. Fix **only** the one-sided missing-ID false success in production `processAuthCallback()` PKCE and hash branches, with focused tests. Do not change the earlier sign-out work, callback error reflection (Case 3), SSR, event handling, UI page, dependencies, schema, real accounts, or any unrelated behavior. If the installed SDK's return shape challenges the three-ID policy, stop and report evidence instead of silently weakening the agreed contract.

## Exact acceptance matrix (one fixture and assertion per row)

For each row below, `auth.getUser()` returns the same synthetic ID as the only populated established field, so a fallback using `sessionUserId || responseUserId` **currently gives false success**. All rows MUST return `{success:false,user:null}` with a generic error containing no ID/code/token/URL/provider message:

1. PKCE `exchangeCodeForSession()`: `data.session.user.id` **missing**, `data.user.id` populated, `getUser().data.user.id` matching populated ID.
2. PKCE: `data.session.user.id` populated, `data.user.id` **missing**, verified ID matching populated ID.
3. Hash `setSession()`: `data.session.user.id` **missing**, `data.user.id` populated, verified ID matching populated ID.
4. Hash: `data.session.user.id` populated, `data.user.id` **missing**, verified ID matching populated ID.

Missing includes absent, null, empty or whitespace-only strings; at minimum implement a separate assertion for each of the four side/branch combinations, with one whitespace-only variant if feasible. On valid callback, each of the **three** IDs must be a non-empty stable string and all equal. Preserve matching-identity positive controls for **both** branches and rejection of contradictory IDs. The existing test whose title says “contradictory session identity or missing ID” only constructs contradictory IDs; do not cite it as missing-ID proof. Through existing `useAuth().handleCallback()`, the failed helper result must remain failure and not surface an old UI user; do not claim the full Vue callback page is rendered unless actually mounted.

## TDD and checks

1. Add the four named/parameterized cases to `tests/diagnostic-handoff006a.test.ts` **before changing production**. Run a focused command filtered by the new test names and record that **all four** fail for `expected false, received true`, not syntax/setup errors. Verify both existing positive controls pass at baseline. Do not use `test.skip`, soften assertions or substitute a reimplementation of the callback.
2. Make the smallest change in `app/utils/auth.ts`: fail closed whenever either established ID is missing/blank or differs from the other, and compare that ID to verified ID. Do not use `a || b` as proof when the other is absent. Return generic safe text; leave existing raw-error reflection paths for later Case 3 work. Re-run the four RED tests GREEN, Case 1 controls, and app-level handleCallback test.
3. Run `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run test` after the fresh build; full suite should fail **only the four pre-existing Case 3 reflection RED tests**. Also run focused sign-out tests including real SDK 500, built-server SSR suite, and `git diff --check`. No real Google/Supabase login. Avoid printing synthetic marker-bearing error payloads in the report.

## Stop/report

Write `docs/HANDOFF-006C1-antigravity-result.md` with the **four-row** RED→GREEN evidence matrix, exact commands/exits/counts, two passing controls, file list and pre/post protected hashes, full-suite classification, and unverified page/event/real OAuth boundaries. Stop for Hermes independent review; do not begin error-reflection fixes or the broad Handoff 006.
