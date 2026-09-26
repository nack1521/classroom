# Antigravity Handoff 006E5B Result — Local-Session Containment After Ambiguous Callback

**Workspace:** `/Users/nack/Classroom`  
**Branch:** `fix/gate0-auth`  
**Date:** 2026-09-25  
**Execution Scope:** Row A implementation from `docs/GATE0-REMAINING-PLAN.md`, `docs/REVIEW-006E5A-gate0.md`, and `docs/HANDOFF-ANTIGRAVITY-006E5B-local-quarantine.md`. Strictly bounded RED→GREEN task. First repaired test assertions and browser harness against unchanged production code to prove the mismatch policy RED with passing controls; then implemented the smallest single-seam production correction in `app/utils/auth.ts` only using local-session containment (`signOut({ scope: 'local' })`). Preserved all dirty worktree changes; zero commits, pushes, deployments, cloud modifications, or real student data.

---

## 1. Executive Summary

### Core Behavior & Policy Requirement:
When a new OAuth callback response has **already established an SDK session** (via PKCE code exchange or token setup) but its established and verified identity is contradictory, missing, or unverifiable:
1. The callback must fail closed with a safe error notice.
2. The ambiguous locally persisted SDK session must be quarantined locally (`client.auth.signOut({ scope: 'local' })`), ensuring it cannot be admitted on a later deliberate protected SPA navigation **or** SSR hard reload.
3. Pre-establishment errors (such as `access_denied` before any code exchange or token setup) must **not** revoke an independently valid older session.
4. Containment must **never** use default or global sign-out (`scope: 'global'`).
5. Storage quarantine is local to the current browser/device context and does not make unsubstantiated claims that clearing browser storage revokes an already-issued JWT or revokes sessions on other devices.

### Outcome: **GREEN (Policy Contract and All Controls 100% Passed)**
- **Test-First RED Proven:** On unchanged production code, Vitest contracts 1A, 1B, 1D and the Playwright browser contract failed RED (admitting User B to `/protected`), while positive, older-session (`access_denied`), absent-session, and revoked-session controls passed.
- **Single-Seam Production Fix:** Added `quarantineLocalSession(client)` to `app/utils/auth.ts` invoking `client.auth.signOut({ scope: 'local' })` upon post-establishment identity mismatch or verification failure. Zero changes made to middleware, composable, callback page, Supabase client factory, packages, or configurations.
- **Verification Complete:** All focused Vitest tests (9/9), all browser tests (3 controls + 1 contract in `browser-diagnostic-006e5a.mjs` and 3 controls + 2 contracts in `browser-diagnostic-006e2.mjs`), and the full test suite (107/107 across 9 test suites) passed 100% GREEN. ESLint, TypeScript, git diff checks passed with 0 errors, and zero child processes leaked.

---

## 2. Verification Metrics & Status

| Check | Command | Exit Code | Result Summary |
|---|---|---|---|
| **5-Auth-File Diff Hash (Pre-Task Baseline)** | `git diff -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `8147e48bb124968934790c132011d40f3ac3a8e6bab1d544dee49c4b7f2df748` |
| **5-Auth-File Diff Hash (Post-Task Final)** | `git diff -- app/composables/useAuth.ts app/middleware/auth.ts app/pages/auth/callback.vue app/utils/auth.ts app/utils/supabaseClient.ts \| shasum -a 256` | 0 | `8cb5a158ccc539187cc44b7bd55526eeb4e4e05bf1c5326a4978b24054d5caa3` |
| **Production Seam Isolation** | `git diff --name-only app/` | 0 | **`app/utils/auth.ts` ONLY** (0 changes in composables, middleware, callback page, or client factory) |
| **Production Build** | `npm run build` | 0 | Clean Nuxt + Nitro server build (3.18 MB) |
| **Focused Vitest Suite** | `npx vitest run tests/diagnostic-006e5a.test.ts` | 0 | **9/9 passed (100% GREEN)** |
| **Browser Diagnostic (Controls Mode)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs controls` | 0 | **All 3 controls PASSED** |
| **Browser Diagnostic (Contract Mode)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs contract` | 0 | **Contract 1 PASSED (GREEN)** |
| **Browser Diagnostic (All Scenarios)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e5a.mjs all` | 0 | **3 controls PASSED, Contract 1 PASSED (GREEN)** |
| **Existing Browser Controls (006E2A)** | `PLAYWRIGHT_MODULE_PATH=... node tests/browser-diagnostic-006e2.mjs` | 0 | **3 controls PASSED, 2 contracts PASSED (100% GREEN)** |
| **Full Vitest Test Suite** | `npm run test` | 0 | **107/107 passed across 9 suites (100% GREEN)** |
| **ESLint Check** | `npm run lint` | 0 | 0 errors, 0 warnings |
| **Typecheck** | `npm run typecheck` | 0 | 0 errors |
| **Git Diff Whitespace Check** | `git diff --check` | 0 | Clean (exit code 0) |
| **Child Process Leak Check** | `ps aux \| grep -E "node /Users/nack/Classroom\|playwright" \| grep -v grep` | 1 | **0 matching processes (No owned process leaks)** |

---

## 3. Evidence Matrix

All diagnostic cases exercise real `@supabase/supabase-js` `GoTrueClient` instances and real `@supabase/ssr` browser clients connecting to an ephemeral Node.js loopback HTTP Auth stub (`127.0.0.1`).

| Evidence Row | Test Case | Mechanism & Storage State | Later Deliberate `/protected` Navigation | Result & Classification |
|---|---|---|---|---|
| **Row 1: Mismatch Target** | **Contract 1A: PKCE Code Exchange Storage Quarantine Contract** | Code exchange establishes User A; `/user` resolves User B. Callback fails with safe error, `auth.user.value === null`. SDK storage quarantined via `signOut({ scope: 'local' })`. `inspectLocalSessionState` reports `'absent'`. | Deliberate `/protected` navigation checks verified user, finds no session, and redirects to `/?auth_required=true`. | **PASS (GREEN)** |
| **Row 1: Mismatch Target** | **Contract 1B: PKCE Route Protection Contract** | PKCE callback fails closed on mismatch. Storage quarantined. User initiates deliberate navigation to `/protected` via `authMiddlewareHandler`. | `authMiddlewareHandler` executes `checkVerifiedUser()`. Because local storage was cleared by local sign-out, no session is found, no user is verified, and the route redirects to `/?auth_required=true`. | **PASS (GREEN)** |
| **Row 1: Mismatch Target** | **Contract 1C: Local Scope Non-Global Sign-Out Contract** | Monitored loopback Auth stub for `/logout` requests during quarantine. | Stub received `POST /logout?scope=local`. Verified that `scope=global` was **never** sent. | **PASS (GREEN)** |
| **Row 1: Mismatch Target** | **Contract 1D: Token/Hash Setup Mismatch Contract** | Synthetic token setup URL `#access_token=...` establishes User A; `/user` resolves User B. Callback fails with safe error. SDK storage quarantined (`'absent'`). | Deliberate `/protected` navigation checks verified user, finds no session, and redirects to `/?auth_required=true`. | **PASS (GREEN)** |
| **Row 2: Positive Control** | **Matching Identity A Control** | Code exchange returns User A; `/user` resolves User A. Callback succeeds (`success: true`, `user.id === 'user-A'`). Storage remains `'confirmed_present'`. | `authMiddlewareHandler` verifies User A and allows access (`guardResult === undefined`, `user.id === 'user-A'`). | **PASS (GREEN)** |
| **Row 3: Policy Distinction** | **Older Valid Session B + `access_denied`** | Pre-existing older session B in storage (`user-older-101`). New callback has `?error=access_denied`. Pre-establishment branch does not call `signOut()`; older session preserved (`confirmed_present`). | Deliberate `/protected` navigation re-verifies older session B with stub and allows access (`guardResult === undefined`, `user.id === 'user-older-101'`). | **PASS (GREEN)** |
| **Negative Control 1** | **Absent Session Control** | Empty storage / no cookie session. | `authMiddlewareHandler` fails verification and redirects to `/?auth_required=true`. | **PASS (GREEN)** |
| **Negative Control 2** | **Revoked Session Control** | Session token in storage rejected with HTTP 401 by Auth stub. | `authMiddlewareHandler` fails verification, sets `user.value = null`, and redirects to `/?auth_required=true`. | **PASS (GREEN)** |
| **SDK Characterization** | **Installed SDK Local Sign-Out Remote 500 Characterization** | Pre-populated storage. Monitored `/remote-500/logout?scope=local` returning HTTP 500. `client.auth.signOut({ scope: 'local' })` invoked. | SDK storage inspection confirms token is removed from storage (`'absent'`) despite remote 500, and subsequent `/protected` navigation redirects to `/?auth_required=true`. | **PASS (GREEN)** |

---

## 4. Installed SDK Characterization (`@supabase/auth-js`)

Direct source inspection of `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` (lines 3427–3458) and `GoTrueAdminApi.js` (lines 67–85) revealed the exact semantics of `signOut({ scope: 'local' })`:

1. **Request Dispatch:**
   - Calling `signOut({ scope: 'local' })` sends `POST /logout?scope=local` to the Auth endpoint.
   - It sends the current session's access token in the `Authorization: Bearer <token>` header.
2. **Local Session Removal Guarantees:**
   - Lines 3448–3454: The SDK executes `await this._removeSession()` within a `finally` block or unconditional cleanup sequence:
     ```javascript
     await this._removeSession()
     ```
   - Even if the remote `/logout?scope=local` endpoint responds with HTTP 500, a network timeout, or an unparseable response, `GoTrueClient` catches/handles the remote error and executes `removeCurrentSession()`, wiping the session from storage/cookies.
3. **No Global Revocation:**
   - `scope: 'local'` tells the backend not to revoke refresh tokens across other devices, confining the effect to the current client instance.
4. **Preservation of Pre-Establishment Session:**
   - By guarding `quarantineLocalSession` to run **only** after session establishment has taken place (`exchangeCodeForSession` or `setSession`), pre-establishment errors (`access_denied`, missing code/hash) bypass quarantine entirely, preserving pre-existing valid sessions.

---

## 5. Browser Context & Deliberate SPA Click Evidence

Using host-installed Playwright via `tests/browser-diagnostic-006e5a.mjs` against the freshly built production application (`.output/server/index.mjs`) and ephemeral loopback Auth stub:

### Test Execution Details:
1. **Deliberate SPA Click Seam:**
   - Browser loaded public home page `/` containing `<NuxtLink id="test-protected-btn" to="/protected">`.
   - Browser initiated OAuth to establish PKCE cookies, then navigated to callback with code exchange resolving mismatched User B.
   - Callback page displayed safe error: `"Authentication failed: OAuth session identity could not be verified."`.
   - Browser clicked public home link returning to `/`.
   - Browser executed a real user SPA click via `await page.click('#test-protected-btn')`.
   - Route middleware intercepted the client-side navigation.
2. **Fresh Verification & URL Assertions:**
   - The test captured Auth stub request counts before and after the click.
   - Delta was 0 (no lingering token to verify) and the URL was redirected to `/?auth_required=true`.
   - Page content asserted:
     - Shows "Authentication Verified": `false`
     - Shows `userB@rpr.ac.th`: `false`
     - Shows "Access Denied:" alert: `true`
3. **Asserted Hard Reload:**
   - Browser executed `await page.reload()`.
   - Nuxt server SSR checked incoming cookies (which were quarantined on callback).
   - SSR redirected to `/?auth_required=true`.
   - Hard reload content asserted:
     - Shows "Authentication Verified": `false`
     - Shows `userB@rpr.ac.th`: `false`
     - Shows "Access Denied:": `true`
4. **Process Cleanup & Signal Hygiene:**
   - The browser runner wraps all tests in `try ... finally { await cleanup() }`.
   - `cleanup()` explicitly terminates Chromium (`browser.close()`), sends `SIGTERM` followed by `SIGKILL` to the Nuxt child process (`nuxtProc.kill()`), and closes the HTTP stub server.
   - `process.exitCode` is set to ensure asynchronous cleanup in `finally` completes before the Node runner exits.
   - Verified via `ps aux` that zero orphaned processes remain.

---

## 6. Production Code Changes (`app/utils/auth.ts`)

The fix was constrained to a single production file: `app/utils/auth.ts`.

### Summary of Seam Changes:
1. **Interface Update:**
   Updated `AuthCallbackClient` to include optional `signOut` method with scope options:
   ```typescript
   export interface AuthCallbackClient {
     auth: {
       exchangeCodeForSession?: (code: string) => Promise<{ data: any; error: any }>
       setSession?: (tokens: { access_token: string; refresh_token: string }) => Promise<{ data: any; error: any }>
       getUser: () => Promise<any>
       getSession?: () => Promise<any>
       signOut?: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{ error: any }>
     }
   }
   ```
2. **Local Quarantine Helper:**
   Added helper to contain ambiguous session with explicit local scope:
   ```typescript
   async function quarantineLocalSession(client: AuthCallbackClient | null | undefined): Promise<void> {
     if (typeof client?.auth?.signOut === 'function') {
       try {
         await client.auth.signOut({ scope: 'local' })
       } catch {
         // Local removal is attempted by the SDK even if remote logout fails
       }
     }
   }
   ```
3. **Invoked at Post-Establishment Failure Points Only:**
   - In `code` exchange identity mismatch: `sessionUserId !== exchangeUserId` → `await quarantineLocalSession(client)`
   - In `accessToken` setup identity mismatch: `sessionUserId !== responseUserId` → `await quarantineLocalSession(client)`
   - In `resolveVerifiedUser` failure after exchange/setup: `!verifiedResult.verified` → `await quarantineLocalSession(client)`
   - In verified identity mismatch: `establishedUserId !== verifiedUserId` → `await quarantineLocalSession(client)`
4. **Untouched Pre-Establishment Paths:**
   - `parsed.hasError` (`access_denied`, etc.) does not call `quarantineLocalSession`, preserving pre-existing sessions.
   - Missing `code` or `accessToken` does not call `quarantineLocalSession`.

---

## 7. Next Steps & Gate 0 Scope Reminder

- Work on Handoff 006E5B is complete.
- All code changes are preserved in the dirty worktree.
- No commit, push, or cloud operations performed.
- STOPPED for Hermes independent review.
- Reminder: Gate 0 umbrella plan still requires completion of:
  - Row B: In-flight event race handling
  - Row C: Rendered callback success / actual auto-navigation
  - Live pilot: Authorized Google OAuth with test student account
