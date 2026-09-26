# Antigravity Handoff 006B Result — Sign-Out State Contract Correction

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Strictly bounded sign-out state/error contract slice only (Handoff 006B). No work on callback identity (Case 1) or provider error reflection (Case 3); no commits, pushes, deployment, dependency additions, or access to real accounts/secrets.

---

## 1. Executive Summary & Verification Metrics

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **Baseline Protected Diff SHA-256** | `git diff app/ nuxt.config.ts package.json package-lock.json vitest.config.ts \| shasum -a 256` | 0 | `bdaf30ab67067effe0eb7679fe59fef4c5264581692d457c4e8cbedef7b7cc03` |
| **Post-Slice Protected Diff SHA-256** | `git diff app/ nuxt.config.ts package.json package-lock.json vitest.config.ts \| shasum -a 256` | 0 | `8f25f40b5122d648368caab59c824414eb991b5aeab122f78f11895940aa3564` |
| **Focused Diagnostic Suite (RED first)** | `npx vitest run tests/diagnostic-handoff006a.test.ts` | 1 | 7 failed, 4 passed (Sign-out contract failed RED as expected) |
| **Focused Diagnostic Suite (GREEN)** | `npx vitest run tests/diagnostic-handoff006a.test.ts` | 1 | 6 failed, 5 passed (Sign-out contract Case 2: 3/3 passed; 6 Case 1 & Case 3 tests remained strictly RED) |
| **Review 002 Integration Suite** | `npx vitest run tests/review002-integration.test.ts` | 0 | 14/14 passed |
| **SSR & Regression Suite** | `npx vitest run tests/regression-review001.test.ts` | 0 | 15/15 passed |
| **ESLint** | `npm run lint` | 0 | 0 lint errors |
| **Typecheck** | `npm run typecheck` | 0 | 0 TypeScript errors |
| **Production Build** | `npm run build` | 0 | Nuxt + Nitro built cleanly (node-server) |
| **Full Test Suite (against fresh build)** | `npm run test` | 1 | 51 passed, exactly 6 failed (the 6 authorized RED contract tests) |
| **Git Diff Whitespace / Conflict Check** | `git diff --check` | 0 | Clean |

---

## 2. Affected Files & Baseline Comparison

### Files Modified in This Slice
- `app/utils/auth.ts`:
  - Extended `SignOutResult` interface with `localSessionCleared?: boolean`.
  - Updated `executeSignOut()` to check `client.auth.getSession()` after `client.auth.signOut()`.
  - When local storage was purged by the SDK (standard GoTrueClient behavior on remote 500 error), calls `clearLocalSession()` and returns sanitized warning: `"Sign out completed locally, but remote revocation was not confirmed by the authentication provider."`.
  - When `getSession` is missing or session remains active, preserves safety assumption that local session state may remain active without claiming clean sign-out.
  - Returns exact `{ success: true, error: null }` on clean sign-out.
- `app/composables/useAuth.ts`:
  - Updated `signOut()` to handle `!res.success`:
    - Shows safe, generic warning (`signOutError.value = res.warning || '...'`) without leaking raw provider/SDK error messages.
    - If `res.localSessionCleared !== false`, clears `user.value = null` and invokes `await navigateTo('/')` so the notice is visible on the public route.
    - If local session genuinely remains, preserves `user.value` without navigating.
- `tests/diagnostic-handoff006a.test.ts`:
  - Extended Case 2 with real-SDK production `useAuth().signOut()` test against loopback HTTP 500 `/logout` endpoint.
  - Added test verifying in-flight verification started before remote-500 sign-out cannot restore user state.
- `tests/review002-integration.test.ts`:
  - Adjusted lines 446-493 to reflect both actual session persistence outcomes (session purged vs. session genuinely remaining) and verify sanitized warning without echoing raw error strings.

### Pre-existing Dirty / Untracked Files Preserved
All pre-existing working tree state was preserved untouched, including:
- `PLANNING_PAPER.md`
- `app/middleware/auth.ts`, `app/pages/auth/callback.vue`, `app/utils/supabaseClient.ts`, `nuxt.config.ts`, `vitest.config.ts`
- `docs/HANDOFF-ANTIGRAVITY-005.md`, `docs/HANDOFF-004-antigravity-result.md`, `docs/HANDOFF-005-antigravity-result.md`
- `docs/HANDOFF-ANTIGRAVITY-006.md`, `docs/HANDOFF-ANTIGRAVITY-006A-diagnostic.md`, `docs/HANDOFF-006A-antigravity-result.md`
- `docs/REVIEW-004-gate0.md`, `docs/REVIEW-005-gate0.md`, `docs/REVIEW-006A-gate0.md`, `docs/WORKFLOW-AUDIT-gate0.md`

---

## 3. Strict RED-First Evidence (Pre-Fix Failure)

Before modifying `app/`, the production `useAuth().signOut()` test was executed against the real installed `@supabase/auth-js` SDK (`GoTrueClient`) with a synthetic local storage session and a loopback HTTP 500 `/logout` endpoint.

### Command & Output
```bash
$ npx vitest run tests/diagnostic-handoff006a.test.ts
```
```text
 FAIL  tests/diagnostic-handoff006a.test.ts > Handoff 006A Diagnostic Case 2: Remote Sign-Out 500 (SDK Characterization) > RED CONTRACT (useAuth): production useAuth().signOut() against real SDK remote 500 clears local user, navigates to public route, and shows sanitized warning without echoing provider error or claiming local session active
AssertionError: expected 'Internal Server Error on logout. Remo…' to contain 'remote revocation was not confirmed'

Expected: "remote revocation was not confirmed"
Received: "Internal Server Error on logout. Remote sign-out failed. Local persisted session state may remain active on the provider."

 ❯ tests/diagnostic-handoff006a.test.ts:299:37
    297|     // 4. auth.signOutError.value must be a sanitized generic warning
    298|     expect(auth.signOutError.value).toBeDefined()
    299|     expect(auth.signOutError.value).toContain('remote revocation was not confirmed')
       |                                     ^
```

### Pre-Fix Behavioral Defects Confirmed:
1. **Raw Error Reflection:** The composable echoed `res.error.message` verbatim (`"Internal Server Error on logout"`).
2. **False Assertion of Active Session:** The composable falsely declared `"Local persisted session state may remain active on the provider"` even though `mockStorage.getItem('supabase.auth.token')` was `null` and the real SDK had already emitted `SIGNED_OUT`.
3. **Missing Public Route Navigation:** `auth.signOut()` executed an early `return` on `!res.success` without calling `await navigateTo('/')`, leaving the user stranded without moving to the public route where `signOutError` is rendered.

---

## 4. Minimal GREEN Implementation & Post-Fix Evidence

### Applied Fix
1. In `app/utils/auth.ts`:
   - `executeSignOut` inspects `client.auth.getSession()`.
   - When the session is absent (`sessionRes?.data?.session === null`), it identifies that local session state was purged by the SDK, calls `clearLocalSession()`, and returns `warning: 'Sign out completed locally, but remote revocation was not confirmed by the authentication provider.'` with `localSessionCleared: true`.
2. In `app/composables/useAuth.ts`:
   - `signOut()` suppresses echoing raw provider error messages on failure, setting `signOutError.value = res.warning`.
   - When `res.localSessionCleared !== false`, it commits `user.value = null` and awaits `navigateTo('/')`.

### GREEN Test Run Output
```bash
$ npx vitest run tests/diagnostic-handoff006a.test.ts
```
```text
 Test Files  1 failed (1)
      Tests  6 failed | 5 passed (11)
   Start at  09:05:35
   Duration  437ms

 ❯ tests/diagnostic-handoff006a.test.ts (11 tests | 6 failed) 61ms
   ❯ Handoff 006A Diagnostic Case 1: Callback Identity Mismatch (RED contract test) (4)
     × RED CONTRACT: rejects callback when PKCE code exchange returns user A but getUser() returns different user B 5ms
     ✓ POSITIVE CONTROL: accepts callback when PKCE code exchange and getUser() identities match 0ms
     × RED CONTRACT: rejects hash callback when setSession() returns user A but getUser() returns different user B 0ms
     ✓ POSITIVE CONTROL: accepts hash callback when setSession() and getUser() identities match 0ms
   ✓ Handoff 006A Diagnostic Case 2: Remote Sign-Out 500 (SDK Characterization) (3)
     ✓ SDK CHARACTERIZATION: installed GoTrueClient purges local session and emits SIGNED_OUT despite remote 500 error 16ms
     ✓ RED CONTRACT (useAuth): production useAuth().signOut() against real SDK remote 500 clears local user, navigates to public route, and shows sanitized warning without echoing provider error or claiming local session active 6ms
     ✓ RED CONTRACT (useAuth): in-flight verification already started cannot restore user state after real-SDK remote-500 sign-out 25ms
   ❯ Handoff 006A Diagnostic Case 3: Unsafe Error Reflection (RED contract test) (4)
     × RED CONTRACT: processAuthCallback() does not reflect raw provider error_description from query string 1ms
     × RED CONTRACT: processAuthCallback() does not reflect raw provider error_description from hash fragment 0ms
     × RED CONTRACT: processAuthCallback() does not reflect raw SDK exchange error message 0ms
     × RED CONTRACT: processAuthCallback() does not reflect raw SDK getUser error message 0ms
```

---

## 5. Status of the Six Remaining RED Contract Tests

As instructed, callback identity mismatch and provider-error reflection were NOT modified. The 6 expected RED tests remain strictly RED as diagnostic evidence for upcoming authorized slices:

1. `tests/diagnostic-handoff006a.test.ts:36` — `rejects callback when PKCE code exchange returns user A but getUser() returns different user B` (Case 1)
2. `tests/diagnostic-handoff006a.test.ts:91` — `rejects hash callback when setSession() returns user A but getUser() returns different user B` (Case 1)
3. `tests/diagnostic-handoff006a.test.ts:427` — `processAuthCallback() does not reflect raw provider error_description from query string` (Case 3)
4. `tests/diagnostic-handoff006a.test.ts:443` — `processAuthCallback() does not reflect raw provider error_description from hash fragment` (Case 3)
5. `tests/diagnostic-handoff006a.test.ts:463` — `processAuthCallback() does not reflect raw SDK exchange error message` (Case 3)
6. `tests/diagnostic-handoff006a.test.ts:489` — `processAuthCallback() does not reflect raw SDK getUser error message` (Case 3)

---

## 6. In-Flight Verification & Retained Session Analysis

1. **In-Flight Verification Race Condition:**
   - In `tests/diagnostic-handoff006a.test.ts:313-401`, a pending verification (`checkVerifiedUser`) was initiated immediately before `signOut()` against a remote HTTP 500 `/logout` endpoint.
   - When the delayed verification promise subsequently resolved with a resurrected user object (`resurrected@rpr.ac.th`), `stateGeneration` guarding ensured `auth.user.value` remained `null`.
2. **SDK Native Retained-Session Boundary:**
   - Source inspection of installed `@supabase/auth-js` (`GoTrueClient.ts:4082-4115`) confirmed that `_signOut()` unconditionally executes `await removeCurrentSession()` whenever `scope !== 'others'`, even if the remote admin endpoint returns HTTP 500 or network failure.
   - Consequently, the installed SDK cannot natively produce an outcome where `signOut()` fails while leaving the local session intact in storage.
   - However, `executeSignOut()` safely guards this boundary: if a custom lock, storage failure, or synthetic fixture leaves a local session present (`client.auth.getSession()` returns a session), it does not clear local display state or navigate, visibly warning that the persisted session remains active. Both paths are covered by tests in `tests/review002-integration.test.ts`.

---

## 7. Stop Condition Met

- The narrow sign-out contract correction is fully verified GREEN.
- The 6 diagnostic contract tests from Handoff 006A remain RED.
- No git commits, pushes, or deployments were performed.
- All untracked and dirty files remain preserved.
- Ready for Hermes independent review.
