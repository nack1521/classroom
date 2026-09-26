# Gate 0 — final local integration review (2026-09-25 archive)

**Superseded:** This incremental review predates the completed 2026-09-26 Gate 0 local auth-spike sign-off in `docs/REVIEW-006F1-gate0.md`. Its NOT PASSED verdict below is historical, not current status.

**Date:** 2026-09-25; branch `fix/gate0-auth`. **Verdict:** Gate 0 remains **not passed**. This is an incremental review, not OAuth sign-off. No production source, existing tests, commit, push, or deployment was changed by this review.

## Independently checked

- `git status --porcelain=v1 --untracked-files=all` confirmed the pre-existing dirty/untracked workspace. `npm run test -- --reporter=dot`: 5 files, **78/78 passed**. This rerun does not replace a fresh production build or live OAuth test.
- Started Nuxt locally on port 3187 with a synthetic Supabase URL/key pointing to an unused loopback endpoint. Playwright (headless Chromium) exercised the **rendered callback page**: `?error=access_denied&error_description=SYNTHETIC_MARKER` displayed a fixed denial message, did not display the marker, offered only the public-home link, and clicking it navigated to `/`. Direct navigation to `/protected` without a valid session redirected to `/?auth_required=true`.
- A synthetic invalid `?code=...` rendered a fixed exchange failure and only the public-home link. A direct callback visit with no response rendered a no-code notice and only the public-home link. All three cases reached the error DOM with no page exceptions. These tests used synthetic inputs only; they do not cover successful callback rendering.

## Boundaries and agreed policy (see `docs/GATE0-AUTH-POLICY.md`)

1. **Success DOM/navigation:** verify matching, verified callback identity renders success and redirects to `/protected`; not exercised by the synthetic browser run.
2. **Real-SDK event race:** existing `tests/review002-integration.test.ts:366-447` triggers `SIGNED_IN` through a mock client's callback, waits for deferred verification, then signs out. Existing real-SDK sign-out diagnostic in `tests/diagnostic-handoff006a.test.ts:526+` starts `checkVerifiedUser()` directly rather than a real SDK `SIGNED_IN` event. Thus no test yet proves the exact real-SDK event path through `useAuth()` after callback denial.
3. **Existing session after denial:** `useAuth().handleCallback()` clears the UI user on denial, but does not revoke an older local SDK session. `app/middleware/auth.ts:28-33` re-verifies when the UI user is null, so an independently valid older session may regain access to `/protected`. This is an inference from production code, **not** a browser/real-SDK verified outcome. Nack agreed that cancellation/denial must not silently revoke a separately valid older session; deliberate protected navigation may pass only after re-verification. A mismatched/ambiguous callback is separate and must not silently restore protected access. Test both outcomes and visible status.
4. **Adjacent error surface:** `app/composables/useAuth.ts:99-111,150-155` assigns raw SDK messages to `authError`, which the public page displays. Nack agreed Gate 0 requires fixed safe categories for init/event/sign-in too; the accepted 006D callback-only correction does not cover them.
5. **External gate:** authorized school-account Google OAuth against actual Supabase/Google configuration remains untested. Do not use real account credentials or student data in diagnostics.

**Next slice:** use only the focused test-only draft `docs/HANDOFF-ANTIGRAVITY-006E1-denial-session-diagnostic.md` for the cancellation/older-session policy. The four-case 006E umbrella and broad Handoff 006 are HOLD; mismatch, real-SDK race, success DOM, and adjacent errors need separate slices after review. Nack will submit the selected prompt himself; Hermes has not submitted an IDE task.
