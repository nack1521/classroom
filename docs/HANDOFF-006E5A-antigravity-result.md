# Antigravity Handoff 006E5A Result — Ambiguous-Callback Session Diagnostic

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Row A test-only diagnosis from `docs/GATE0-REMAINING-PLAN.md` and `docs/HANDOFF-ANTIGRAVITY-006E5A-mismatch-diagnostic.md`. Strictly test-only diagnosis with zero production source edits, configuration changes, or dependency additions. Preserved all existing dirty worktree changes; no commit, push, deployment, or real cloud accounts.

---

## 1. Executive Summary & Answer to Core Question

### Core Question:
> *Can a failed identity-mismatched new OAuth callback leave or create an SDK-persisted session that is subsequently verified and admitted to `/protected`, despite the failed attempt?*

### Diagnostic Finding: **YES (Vulnerability Confirmed; Policy Contract FAILS RED on Current Unchanged Code).**

1. **SDK Persistence on Mismatch:**
   - In `app/utils/auth.ts:459`, PKCE code exchange executes `exchangeRes = await client.auth.exchangeCodeForSession(code)`.
   - The installed `@supabase/supabase-js` `GoTrueClient` immediately writes the newly received token and session for User A into SDK storage (`supabase.auth.token` in local storage, or `sb-127-auth-token` in browser cookies).
   - In lines 547-563, `processAuthCallback` calls `resolveVerifiedUser(client)`, which queries `/user`. When the provider resolves contradictory identity User B (`establishedUserId !== verifiedUserId`), `processAuthCallback` fails closed and returns:
     `{ success: false, error: 'Authentication failed: OAuth session identity could not be verified.', user: null }`.
   - `useAuth().handleCallback()` sets `authError.value` and resets in-memory `user.value = null` (preventing immediate success UI).
   - **Crucially: Neither `processAuthCallback` nor `handleCallback` invokes `client.auth.signOut()` or removes the session from SDK storage.**
   - Consequently, `inspectLocalSessionState(client)` remains `'confirmed_present'`.

2. **Later Deliberate `/protected` Navigation Outcome:**
   - When the user later deliberately visits `/protected` (via Vue-router SPA navigation or server SSR hard reload), production route middleware (`authMiddlewareHandler` in `app/middleware/auth.ts`) executes.
   - Because `auth.user.value?.signedIn` is null, line 35 calls `await auth.checkVerifiedUser()`.
   - `checkVerifiedUser()` calls `fetchVerifiedUser()` → `resolveVerifiedUser(client)` → `client.auth.getUser()`.
   - The client reads the un-cleared persisted session from storage/cookies, dispatches a verification request with the bearer token to `/user`, and verifies User B.
   - `auth.user.value` is restored with User B (`signedIn: true, id: 'user-B', email: 'userB@rpr.ac.th'`).
   - `authMiddlewareHandler` evaluates `isAuthenticated = true` and **admits the user to `/protected` without redirection**.
   - On hard reload of `/protected`, Nuxt server SSR reads the cookie, verifies User B, and renders the protected route.
   - **Contract Result:** The Gate 0 policy contract ("a later deliberate `/protected` navigation must not silently admit either ambiguous identity") **FAILS RED** on unchanged production code.

3. **Policy Distinction Control Preserved:**
   - For standard `access_denied`, an independently valid older session B is preserved and deliberately re-verified to allow entry (reaffirming the 006E1/006E3 policy that denial of a new attempt must not revoke a pre-existing valid session).
   - This diagnostic proves that resolving Row 1 cannot be a blanket sign-out on every callback error, but must specifically target the ambiguous/mismatched session.

---

## 2. Verification Metrics & Status

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **5-Auth-File Baseline Diff SHA-256 (Pre-Task)** | `git diff -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `8147e48bb124968934790c132011d40f3ac3a8e6bab1d544dee49c4b7f2df748` |
| **5-Auth-File Diff SHA-256 (Post-Task)** | `git diff -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `8147e48bb124968934790c132011d40f3ac3a8e6bab1d544dee49c4b7f2df748` (**Exact match, 0 production code changes**) |
| **Focused 006E5A Diagnostic (Vitest)** | `npx vitest run tests/diagnostic-006e5a.test.ts` | 1 | **7 passed, 1 expected RED** (Policy contract fails on unchanged code: `expected undefined to be '/?auth_required=true'`) |
| **Focused 006E5A Browser Diagnostic (Playwright)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs` | 0 | **All 3 controls PASSED; Policy Contract RED confirmed in browser** |
| **Existing Browser Navigation Controls (006E2A)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e2.mjs` | 0 | **3/3 controls PASSED, 2/2 contracts PASSED (100% GREEN)** |
| **ESLint Check** | `npm run lint` | 0 | 0 errors |
| **Typecheck** | `npm run typecheck` | 0 | 0 errors |
| **Production Build** | `npm run build` | 0 | Clean Nuxt + Nitro node-server build |
| **Full Vitest Test Suite** | `npm run test` | 1 | **105 passed across 8 suites, 1 expected RED in `diagnostic-006e5a.test.ts`** |
| **Git Diff Whitespace / Conflict Check** | `git diff --check` | 0 | Clean (exit code 0) |

---

## 3. Evidence Matrix

All cases were evaluated using real `@supabase/supabase-js` `GoTrueClient` instances and real `@supabase/ssr` browser clients connecting to an ephemeral Node.js loopback HTTP Auth stub (`127.0.0.1`).

| Evidence Row | Test Case | Mechanism & Storage State | Later Deliberate `/protected` Navigation | Classification |
|---|---|---|---|---|
| **Row 1: Mismatch Target** | **Evidence 1A: PKCE Code Exchange Storage Characterization** | Code exchange returns session for User A; `/user` resolves User B. Callback fails with safe error, `auth.user.value === null`. `inspectLocalSessionState` reports `'confirmed_present'`. Storage contains User A token. | N/A (Storage boundary characterization). | **POLICY PASS (Storage Proof Verified)** |
| **Row 1: Mismatch Target** | **Evidence 1B: Current Production Navigation Behavior** | PKCE callback fails closed on mismatch. Storage retains User A token. User initiates deliberate navigation to `/protected`. | `authMiddlewareHandler` executes `checkVerifiedUser()`, queries loopback `/user`, resolves User B, and **admits User B** (`guardResult === undefined`, `user.id === 'user-B'`). | **POLICY PASS (Vulnerability Characterization Verified)** |
| **Row 1: Mismatch Target** | **Evidence 1C: Policy Contract** | Asserts that after an identity-mismatched callback, a later deliberate `/protected` navigation must NOT admit either ambiguous identity. | Assertion `expect(guardResult).toBe('/?auth_required=true')` FAILS RED: received `undefined` (admission granted to User B). | **RED (Policy Contract Fails on Current Code)** |
| **Row 1: Mismatch Target** | **Evidence 1D: Token/Hash Setup Mismatch Path** | Synthetic token setup URL `#access_token=...` establishes User A; `/user` resolves User B. Callback fails with safe error. SDK storage retains session (`confirmed_present`). | Later `/protected` navigation admits User B on unchanged code. | **POLICY PASS (Token Path Mismatch Characterization Verified)** |
| **Row 2: Positive Control** | **Matching Identity A Control** | Code exchange returns User A; `/user` resolves User A. Callback succeeds (`success: true`, `user.id === 'user-A'`). Storage is `'confirmed_present'`. | `authMiddlewareHandler` verifies User A and allows access (`guardResult === undefined`, `user.id === 'user-A'`). | **POLICY PASS** |
| **Row 3: Policy Distinction** | **Older Valid Session B + `access_denied`** | Pre-existing older session B in storage (`user-older-101`). New callback has `?error=access_denied`. Callback fails closed without wiping older session (`confirmed_present`). | Deliberate `/protected` navigation re-verifies older session B with stub and allows access (`guardResult === undefined`, `user.id === 'user-older-101'`). | **POLICY PASS** |
| **Negative Control 1** | **Absent Session** | Empty storage / no cookie session. | `authMiddlewareHandler` fails verification and redirects to `/?auth_required=true`. | **POLICY PASS** |
| **Negative Control 2** | **Revoked Session** | Session token in storage rejected with HTTP 401 by Auth stub. | `authMiddlewareHandler` fails verification, sets `user.value = null`, and redirects to `/?auth_required=true`. | **POLICY PASS** |

---

## 4. Browser Context & Full-Lifecycle Verification

Using host-installed Playwright (`tests/browser-diagnostic-006e5a.mjs`) against the freshly built production application (`npm run build`), the complete browser lifecycle was executed:

1. **Callback → Storage → Navigation Sequence:**
   - Browser visited home page and initiated OAuth via the Google sign-in button (establishing PKCE verifier cookies `sb-127-auth-token-*-code-verifier`).
   - Browser navigated to `/auth/callback?code=mismatch-code-1`.
   - `app/pages/auth/callback.vue` executed `handleCallback()`.
   - Stub received `/token` request and returned session for User A.
   - Browser SDK persisted `sb-127-auth-token` cookie.
   - Stub received `/user` request and returned User B.
   - Callback page rendered safe error: `"Authentication failed: OAuth session identity could not be verified."`.
   - No success banner rendered; "Return to Public Home" button rendered.
   - In that same browser context, browser returned to `/` and deliberately clicked/navigated to `/protected`.
   - Client-side route middleware executed `checkVerifiedUser()`, verified `userB@rpr.ac.th`, and rendered the protected page with `"Authentication Verified: userB@rpr.ac.th"`.
   - On hard page reload of `/protected`, Nuxt server SSR verified the cookie and rendered `/protected` with `userB@rpr.ac.th`.
2. **Process and Resource Hygiene:**
   - Browser runner implements strict cleanup of Chromium browser, child Nuxt Nitro process, and loopback HTTP server on normal completion and signal interruption (`SIGINT`/`SIGTERM`).
   - Zero orphaned child processes or open ports.

---

## 5. Architectural Findings for Row A Fix Design

1. **Why the vulnerability occurs:**
   - In `app/utils/auth.ts`:
     - Lines 459 & 506: SDK calls `exchangeCodeForSession` or `setSession`. Both methods write the session to storage synchronously upon receiving the token response.
     - Lines 547-563: `resolveVerifiedUser(client)` detects the identity mismatch.
     - However, the function merely returns `{ success: false, error: ..., user: null }`. It **never clears the SDK storage** or signs out the mismatched session!
   - In `app/composables/useAuth.ts:240-246`:
     - `handleCallback()` records `authError.value = result.error` and sets in-memory `user.value = null`, but also does not clear SDK storage.
   - Later, when `authMiddlewareHandler` visits `/protected`, it only sees that `auth.user.value?.signedIn` is null, so it calls `checkVerifiedUser()`, which transparently resurrects the persisted session from SDK storage.

2. **Crucial constraint for subsequent production fix:**
   - The fix must **specifically clear/sign out the session when an identity mismatch occurs in `processAuthCallback`**.
   - The fix must **NOT** introduce a global sign-out for all callback errors (such as `access_denied`), because Row 3 proves that `access_denied` must preserve an independently valid older session.

---

## 6. Changed Paths & Diff Status

```
Untracked test files added (test-only scope):
?? tests/diagnostic-006e5a.test.ts
?? tests/browser-diagnostic-006e5a.mjs
?? docs/HANDOFF-006E5A-antigravity-result.md

Five protected auth files:
app/composables/useAuth.ts
app/middleware/auth.ts
app/pages/auth/callback.vue
app/utils/auth.ts
app/utils/supabaseClient.ts

Diff hash: 8147e48bb124968934790c132011d40f3ac3a8e6bab1d544dee49c4b7f2df748 (UNMODIFIED)
```

---

## 7. Stop Point

In accordance with instructions:
- Only Row A's test-only diagnosis was executed.
- Zero production code was edited.
- Discovered RED is recorded and preserved.
- Dirty worktree is preserved; no commit, push, deployment, or real cloud accounts.
- **STOPPED for Hermes review.**
