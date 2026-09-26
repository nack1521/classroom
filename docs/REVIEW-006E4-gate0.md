# REVIEW-006E4 — safe public auth notices outside callback

**Reviewed:** 2026-09-25; branch `fix/gate0-auth`. **Verdict:** ACCEPT the narrow replacement of four raw provider/SDK error assignments with fixed notices. **Gate 0 remains NOT PASSED**; no real OAuth, commit, push or deployment.

## Independent evidence

- Inspected `app/composables/useAuth.ts` and `tests/safe-auth-notices-006e4.test.ts`. The changed production lines are the four pre-identified assignments (init, deferred auth-state error, OAuth returned error, OAuth thrown error). Their new strings do not interpolate provider/SDK messages; missing-configuration, callback and sign-out paths are unchanged in this task. Five-auth-file diff hash changed from `54c0f2766ac6a685c1c14e31fcbcbcf4901ce69f91d99f777e82d899925501b6` to `8147e48bb124968934790c132011d40f3ac3a8e6bab1d544dee49c4b7f2df748`; `git diff --check` passes.
- Fresh `npm run build` passes; `npm run lint` and `npm run typecheck` pass; focused new tests **6/6** and full Vitest **98/98 across 8 files** pass. Fresh built-server browser diagnostic still passes all **3 controls + 2 protected-navigation contracts**. No test-server process remains.
- Additional independent browser check on the fresh built page: assign the fixed message into Nuxt's reactive `auth-error` state and observe actual `.alert-danger` visible with the expected text. This proves page binding/rendering, not a real browser OAuth-result error. The IDE's `renderNotice()` in `tests/safe-auth-notices-006e4.test.ts:167-177` is a hand-written imitation of the template, **not** a rendered component test. Do not cite that unit as proof of a browser error flow.

## Limits and next boundary

The new focused cases use controlled client doubles. The auth-state case invokes a captured `SIGNED_IN` callback, waits for deferred verification and injects a throwing `getSupabaseClient()` call; it tests the error path but is **not** a real-SDK in-flight race. A successful initiation control checks cleared error state, not an OAuth round trip. RED results before the source change come from the IDE report and were not independently replayed against the old tree; current GREEN and source comparison were independently verified.

Next: consolidate the *remaining* acceptance matrix in one umbrella plan, but keep test-only diagnostic and each production correction separated by explicit Hermes review gates. Mismatch/ambiguous SDK session, actual in-flight real-SDK event race, rendered successful callback/navigation, and an authorized Google OAuth pilot remain unverified; no student onboarding implementation is authorized by this review.
