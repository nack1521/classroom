# Gate 0 Corrective Result — Auth Repair & SSR Verification

- **Date:** 2026-09-24
- **Implementer:** Antigravity IDE
- **Workspace:** `/Users/nack/Classroom`
- **Scope:** Corrective repair of Gate 0 auth spike per `docs/HANDOFF-ANTIGRAVITY-002.md` and `docs/REVIEW-001-gate0.md`
- **Status:** **Local repair and regression tests complete. Real OAuth round-trip and authenticated browser reload remain unverified pending external project configuration.**

---

## 1. Summary of Repairs

In response to the independent findings in `docs/REVIEW-001-gate0.md`, the following bounded corrections were implemented:

### A. SSR Cookie-Backed Auth & Verified Identity
- Replaced client-only local storage session reliance with official `@supabase/ssr`.
- Created [`app/utils/supabaseClient.ts`](file:///Users/nack/Classroom/app/utils/supabaseClient.ts):
  - On the server during SSR, creates a **request-scoped** client (`createServerClient`) attached to the H3 `event.context._supabaseClient`. Cookies are read via `parseCookies(event)` and set via `setCookie(event)`. Server client is strictly isolated per request and **never a module-global singleton across users**.
  - In the browser, uses `createBrowserClient` which synchronizes with `document.cookie`.
- Guard verification in [`app/middleware/auth.ts`](file:///Users/nack/Classroom/app/middleware/auth.ts) and [`app/composables/useAuth.ts`](file:///Users/nack/Classroom/app/composables/useAuth.ts) resolves identity using [`resolveVerifiedUser`](file:///Users/nack/Classroom/app/utils/auth.ts#L182) (`client.auth.getUser()`). Forged or unverified sessions stored locally fail verification and are rejected.

### B. OAuth Callback Error Priority & Safe Decoding
- Implemented [`parseAuthCallbackUrl`](file:///Users/nack/Classroom/app/utils/auth.ts#L125) which inspects both query parameters (`?error=...`) and hash fragments (`#error=...`).
- Wrapped percent-decoding in a safe fallback so malformed percent sequences in error descriptions do not throw `URIError`.
- Implemented [`processAuthCallback`](file:///Users/nack/Classroom/app/utils/auth.ts#L210): if the OAuth provider returned an error, the callback reports denial immediately and does **not** treat a pre-existing session as success.

### C. Redirect URI Guidance Correction
- Corrected the setup guide in [`app/pages/index.vue`](file:///Users/nack/Classroom/app/pages/index.vue) and this handoff:
  1. **Google Cloud Web OAuth Client:** Authorized Redirect URI is the **Supabase project provider callback** (`https://<project-ref>.supabase.co/auth/v1/callback`). Authorized JavaScript origin is `http://localhost:3000`.
  2. **Supabase Auth URL Configuration:** Add the local app callback (`http://localhost:3000/auth/callback`) to the **Redirect URLs allow-list**.
  3. **Application:** Uses `signInWithOAuth({ provider: 'google', options: { redirectTo: 'http://localhost:3000/auth/callback' } })`.

### D. Visible Sign-Out Failure Reporting
- In [`executeSignOut`](file:///Users/nack/Classroom/app/utils/auth.ts#L79), if `client.auth.signOut()` returns an error, local state is **not** cleared silently.
- Surfaced `signOutError` in [`app/composables/useAuth.ts`](file:///Users/nack/Classroom/app/composables/useAuth.ts), [`app/pages/index.vue`](file:///Users/nack/Classroom/app/pages/index.vue), and [`app/pages/protected.vue`](file:///Users/nack/Classroom/app/pages/protected.vue). On failure, the application remains on the page, displays the error message, and states that persisted session state may remain active on the provider.

---

## 2. Changed and Created Files

| File | Description |
|---|---|
| [`app/utils/supabaseClient.ts`](file:///Users/nack/Classroom/app/utils/supabaseClient.ts) | Request-scoped SSR client factory using `@supabase/ssr` (server H3 cookie adapters, browser client). |
| [`app/utils/auth.ts`](file:///Users/nack/Classroom/app/utils/auth.ts) | Pure utilities: dual query/hash callback error extraction, safe decoding, `resolveVerifiedUser`, `processAuthCallback`, `executeSignOut`. |
| [`app/composables/useAuth.ts`](file:///Users/nack/Classroom/app/composables/useAuth.ts) | SSR-aware auth composable using verified identity checks, robust callback processing, and visible sign-out error state. |
| [`app/middleware/auth.ts`](file:///Users/nack/Classroom/app/middleware/auth.ts) | Route middleware awaiting `checkVerifiedUser()` before evaluating route access. |
| [`app/pages/index.vue`](file:///Users/nack/Classroom/app/pages/index.vue) | Updated setup instructions with two distinct redirect targets; added `signOutError` banner. |
| [`app/pages/protected.vue`](file:///Users/nack/Classroom/app/pages/protected.vue) | Added `signOutError` warning banner and error styling. |
| [`app/pages/auth/callback.vue`](file:///Users/nack/Classroom/app/pages/auth/callback.vue) | Forwards `window.location.href` to handle query and hash errors; updated troubleshooting tips. |
| [`tests/regression-review001.test.ts`](file:///Users/nack/Classroom/tests/regression-review001.test.ts) | 9 new regression tests covering callback query/hash extraction, malformed decoding, pre-existing session denial, forged session rejection, and sign-out failure reporting. |
| [`tests/auth.test.ts`](file:///Users/nack/Classroom/tests/auth.test.ts) | Updated sign-out error test asserting that local state is not silently cleared on error. |
| [`package.json`](file:///Users/nack/Classroom/package.json) | Added single permitted dependency `@supabase/ssr`. |

---

## 3. Fresh Verification Evidence

### A. Test Suite (`npm run test`)
```text
> vitest run

 ✓ tests/auth.test.ts (14 tests) 8ms
 ✓ tests/regression-review001.test.ts (9 tests) 8ms
 ✓ tests/middleware.test.ts (3 tests) 8ms

 Test Files  3 passed (3)
      Tests  26 passed (26)
```

### B. Linting (`npm run lint`)
```text
> eslint .
Exit code: 0 (No lint errors)
```

### C. Typecheck (`npm run typecheck`)
```text
> tsc --noEmit
Exit code: 0 (No type errors)
```

### D. Production Build (`npm run build`)
```text
✔ Client built in 1060ms
✔ Server built in 401ms
✔ Nuxt Nitro server built in .output/server
Exit code: 0
```

### E. Local Server Endpoint Verification
Started production preview on port `39128`:
- `HEAD http://localhost:39128/` -> `HTTP/1.1 200 OK`
- `HEAD http://localhost:39128/protected` -> `HTTP/1.1 302 Found` with `location: /?auth_required=true`
- `HEAD http://localhost:39128/auth/callback` -> `HTTP/1.1 200 OK`
- Verified HTML rendering on `http://localhost:39128/`:
  - Displays blocker status: `BLOCKED PENDING OAUTH / SUPABASE CONFIGURATION`.
  - Displays corrected setup values: Google Cloud authorized redirect URI pointing to `https://<project-ref>.supabase.co/auth/v1/callback` and Supabase Redirect URLs allow-list pointing to `http://localhost:3000/auth/callback`.

---

## 4. Remaining Untested Integration Steps & Known Blockers

1. **Real OAuth Round-Trip & Authenticated Browser Reload:**
   - **Explicitly UNVERIFIED in live browser:** Because no external Google Cloud OAuth client or Supabase project keys are configured in this environment, an actual end-to-end Google login with a school account has not been executed.
   - The reload persistence of an actual Supabase session cookie cannot be proved until Nack runs the flow with real test credentials.
2. **School Google Workspace Policy:**
   - Google Workspace Education third-party app restrictions (under-18 accounts) remain an external gate.
3. **Git & Deployments:**
   - No commits, pushes, or deployments were performed. All changes remain untracked in local working directory.

---

## 5. Next Steps for Nack and Hermes

1. Hermes inspects diff and verification evidence in this handoff.
2. When ready for manual pilot:
   - Configure Google Cloud OAuth Client with redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`.
   - Configure Supabase Auth URL Configuration with redirect URI: `http://localhost:3000/auth/callback`.
   - Copy `.env.example` to `.env` with actual project values.
   - Run `npm run dev` and test with the school test account.
