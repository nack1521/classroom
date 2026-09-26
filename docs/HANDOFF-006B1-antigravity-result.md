# Antigravity Handoff 006B.1 Result — Sign-Out Unknown-State Correction

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Strictly bounded sign-out unknown-state classification slice only (Handoff 006B.1). No work on callback identity (Case 1) or provider error reflection (Case 3); no commits, pushes, deployment, dependency additions, or access to real accounts/secrets.

---

## 1. Executive Summary & Verification Metrics

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **Baseline Protected Diff SHA-256** | `git diff --binary -- app/ nuxt.config.ts package.json package-lock.json vitest.config.ts \| shasum -a 256` | 0 | `8f25f40b5122d648368caab59c824414eb991b5aeab122f78f11895940aa3564` |
| **Post-Slice Protected Diff SHA-256** | `git diff --binary -- app/ nuxt.config.ts package.json package-lock.json vitest.config.ts \| shasum -a 256` | 0 | `c80e736d8c3563eef92296edb1c7db46369f598b82c50761f35862a4a7f2b805` |
| **Review 002 Integration (RED first)** | `npx vitest run tests/review002-integration.test.ts` | 1 | 6 failed, 14 passed (Unknown state failed RED as expected) |
| **Review 002 Integration (GREEN)** | `npx vitest run tests/review002-integration.test.ts` | 0 | 20/20 passed |
| **Case 2 Real-SDK & Diagnostic Suite** | `npx vitest run tests/diagnostic-handoff006a.test.ts` | 1 | 5 passed, 6 failed (Case 2: 3/3 passed; 6 Case 1 & 3 tests strictly preserved RED) |
| **SSR & Regression Suite** | `npx vitest run tests/regression-review001.test.ts` | 0 | 15/15 passed |
| **Auth Base Unit Tests** | `npx vitest run tests/auth.test.ts` | 0 | 14/14 passed |
| **ESLint** | `npm run lint` | 0 | 0 lint errors |
| **Typecheck** | `npm run typecheck` | 0 | 0 TypeScript errors |
| **Production Build** | `npm run build` | 0 | Nuxt + Nitro built cleanly (node-server) |
| **Full Test Suite (Fresh Build)** | `npm run test` | 1 | 57 passed, exactly 6 failed (the 6 authorized RED contract tests) |
| **Git Diff Whitespace / Conflict Check** | `git diff --check` | 0 | Clean (exit code 0) |

---

## 2. Tri-State Local Session Classification Model

Under failed remote sign-out (or when `client.auth.signOut()` errors/throws), `executeSignOut()` inspects the local storage session via `inspectLocalSessionState(client.auth)` and classifies it into one of three distinct states:

| Local Session State | Condition / Reading | `localSessionCleared` | `clearLocalSession()` Called? | `user.value` Policy in `useAuth()` | Warning Message | Navigation Policy |
|---|---|---|---|---|---|---|
| **`confirmed_absent`** | `sessionRes.error == null` and `sessionRes.data.session === null` (e.g. real GoTrueClient remote 500) | `true` | **Yes** (session removal confirmed) | Set to `null` | `"Sign out completed locally, but remote revocation was not confirmed by the authentication provider."` | `await navigateTo('/')` |
| **`confirmed_present`** | `sessionRes.error == null` and `sessionRes.data.session` is present/valid | `false` | **No** (session genuinely remains) | Retained (not cleared) | `"Remote sign-out failed. Local persisted session state may remain active on the provider."` | Stay in place (no navigation) |
| **`unknown`** | `getSession()` throws, returns `{ error }`, returns invalid data, or `getSession` is missing | `false` | **No** (unconfirmed; must not assume deleted) | Retained if no SDK event occurred; not asserted as signed-out | `"Sign-out status is unconfirmed: remote revocation failed and local persisted session state could not be verified."` | `await navigateTo('/')` (moves to public route where warning alert is visible) |

---

## 3. Strict RED-First Evidence (Pre-Fix Failure)

Before modifying `app/utils/auth.ts` or `app/composables/useAuth.ts`, the new tri-state test suite was added to `tests/review002-integration.test.ts` and executed against the existing codebase.

### Command & Output
```bash
$ npx vitest run tests/review002-integration.test.ts
```
```text
 FAIL  tests/review002-integration.test.ts > REVIEW-006B.1: Tri-State Local Session Classification on Sign-Out Error > RED CONTRACT (executeSignOut): when getSession() throws, treats local state as unknown, does NOT clear local session, and returns unconfirmed warning
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times

Received:
  1st vi.fn() call:
    Array []
Number of calls: 1

 ❯ tests/review002-integration.test.ts:566:32
    564|     const result = await executeSignOut(mockClient, mockClearLocal)
    565|
    566|     expect(mockClearLocal).not.toHaveBeenCalled()
       |                                ^

 FAIL  tests/review002-integration.test.ts > REVIEW-006B.1: Tri-State Local Session Classification on Sign-Out Error > RED CONTRACT (executeSignOut): when getSession() returns an error, treats local state as unknown, does NOT clear local session, and returns unconfirmed warning
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times

 ❯ tests/review002-integration.test.ts:587:32
    585|     const result = await executeSignOut(mockClient, mockClearLocal)
    586|
    587|     expect(mockClearLocal).not.toHaveBeenCalled()
       |                                ^

 FAIL  tests/review002-integration.test.ts > REVIEW-006B.1: Tri-State Local Session Classification on Sign-Out Error > RED CONTRACT (useAuth): when local session reading is unknown, does not masquerade as confirmed local deletion, does not echo SDK error text, does not assert signed-out identity, and navigates home with unconfirmed warning
AssertionError: expected 'Sign out completed locally, but remot…' not to contain 'completed locally'

Expected: "completed locally"
Received: "Sign out completed locally, but remote revocation was not confirmed by the authentication provider."

 ❯ tests/review002-integration.test.ts:695:41
    693|     // Contract assertions:
    694|     // 1. Must NOT claim sign-out completed locally
    695|     expect(auth.signOutError.value).not.toContain('completed locally')
       |                                         ^
```

### Pre-Fix Flaws Confirmed:
1. When `getSession()` threw an exception, `hasLocalSession` fell into the `catch` block and defaulted to `false`, causing `clearLocalSession()` to be invoked and claiming `localSessionCleared: true` with `"Sign out completed locally..."`.
2. When `getSession()` returned `{ error: Error, data: { session: null } }`, `Boolean(sessionRes?.data?.session)` evaluated to `false`, treating an unreadable session error as a confirmed session absence.
3. In `useAuth().signOut()`, `res.localSessionCleared !== false` evaluated to `true` on unconfirmed/unknown results, clearing `user.value = null` and displaying a notice falsely asserting local sign-out completed.

---

## 4. Minimal GREEN Implementation

### Changes Applied to `app/utils/auth.ts`
1. Defined `export type LocalSessionState = 'confirmed_present' | 'confirmed_absent' | 'unknown'`.
2. Added `localSessionState?: LocalSessionState` to `SignOutResult`.
3. Created `inspectLocalSessionState(auth)`:
   - Validates that `auth.getSession` is a function.
   - Awaits `auth.getSession()`. If it throws, returns `error`, or returns non-null data without valid structure, returns `'unknown'`.
   - Returns `'confirmed_present'` only when `sessionRes.data?.session` is present and valid with no error.
   - Returns `'confirmed_absent'` only when `sessionRes.error == null && sessionRes.data?.session === null`.
4. Updated `executeSignOut()` to dispatch explicitly based on `sessionState`:
   - Only `confirmed_absent` triggers `clearLocalSession()`, sets `localSessionCleared: true`, and returns the `"completed locally"` notice.
   - `unknown` returns `localSessionCleared: false`, does NOT call `clearLocalSession()`, and returns `"Sign-out status is unconfirmed: remote revocation failed and local persisted session state could not be verified."`.
   - `confirmed_present` returns `localSessionCleared: false`, does NOT call `clearLocalSession()`, and warns that session state may remain active on provider.

### Changes Applied to `app/composables/useAuth.ts`
In `signOut()`:
- When `!res.success`:
  - Assigns `signOutError.value = res.warning`.
  - Only when `res.localSessionCleared === true` (confirmed absent) does it null `user.value`.
  - When `res.localSessionState === 'unknown'`, it navigates to `'/'` so the unconfirmed warning is visible on the public page, but does NOT force `user.value = null` (no masquerading as confirmed local deletion).

### GREEN Run Evidence
```bash
$ npx vitest run tests/review002-integration.test.ts
```
```text
 Test Files  1 passed (1)
      Tests  20 passed (20)
   Start at  09:23:19
   Duration  528ms
```

---

## 5. Status of the Six Remaining RED Contract Tests

Callback identity mismatch (Case 1) and unsafe error reflection (Case 3) were NOT modified. Exactly 6 tests remain RED as diagnostic baselines for subsequent slices:

1. `tests/diagnostic-handoff006a.test.ts:36`: Case 1 PKCE code exchange ID mismatch (RED)
2. `tests/diagnostic-handoff006a.test.ts:91`: Case 1 Hash token setup ID mismatch (RED)
3. `tests/diagnostic-handoff006a.test.ts:427`: Case 3 Query `error_description` reflection (RED)
4. `tests/diagnostic-handoff006a.test.ts:443`: Case 3 Hash `error_description` reflection (RED)
5. `tests/diagnostic-handoff006a.test.ts:463`: Case 3 Exchange error reflection (RED)
6. `tests/diagnostic-handoff006a.test.ts:489`: Case 3 `getUser` error reflection (RED)

---

## 6. Unverified Boundaries & Evidence Limits

1. **In-Flight Direct Check vs. Pending Event Race:**
   - As noted in `REVIEW-006B-gate0.md`, the in-flight test at `tests/diagnostic-handoff006a.test.ts:313-404` tests an in-flight direct `checkVerifiedUser()` call, not a real `SIGNED_IN` event scheduled from inside `client.auth.onAuthStateChange`. That specific event-race boundary remains unverified by a real event test.
2. **DOM Visibility Rendering:**
   - The test asserts navigation to `'/'` and presence of `auth.signOutError.value`. While `app/pages/index.vue` template contains `<div v-if="signOutError" class="alert alert-danger">{{ signOutError }}</div>`, Vitest tests execute in a mocked Nuxt composable environment rather than mounting the full Vue SFC.
3. **No Account / Cloud Mutation:**
   - No real Supabase or Google Cloud credentials or accounts were accessed or changed.

---

## 7. Stop Condition Met

- Tri-state local session classification is implemented and verified GREEN.
- The 6 diagnostic contract tests from Handoff 006A remain RED.
- No Git commits, pushes, or deployments were performed.
- All untracked and dirty files remain preserved.
- Ready for Hermes independent review.
