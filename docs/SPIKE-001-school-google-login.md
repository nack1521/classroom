# SPIKE-001 — Test personal Google OAuth with school account

**Status:** Ready for setup once Nack authorizes account configuration; not run  
**Date:** 2026-09-24  
**Timebox:** short proof before building the classroom app  
**Owner of Google Cloud project:** Nack's personal account (confirmed by Nack)  
**Goal:** Determine whether a school Google account can complete sign-in to this third-party app, and whether a student-designated account is blocked by school policy.

## Questions to answer

1. Can an authorized `@rpr.ac.th` test account complete Google sign-in to an app owned outside the school's Workspace organization?
2. Does that result also hold for a student account designated under 18 (if different from the first test account)?
3. Can the app verify the identity server-side and associate it with a fictitious course enrollment without granting access to arbitrary school-domain users?
4. Is the Google OAuth app ready for the intended audience of about 200 learners, rather than being left in a testing/publishing state inappropriate for launch?

## Minimal implementation/procedure

- Create a **new OAuth client for Classroom** in a personal Google Cloud project (or a dedicated new personal project), rather than reusing the university room-booking app's client ID/redirects. Choose Web application; set up consent screen for External audience with only basic identity scopes.
- In an isolated Supabase test project, enable Google Auth with that client ID and secret and register Supabase's exact callback URL in Google Cloud. Configure the app's post-login return URL separately.
- Use a tiny local/staging page to start login and display only non-sensitive success/failure state. Do not log tokens, student identifiers, or credentials. Avoid adding any real roster to this spike.
- Have Nack sign in with the school test account. If the test account is adult/teacher-designated, test separately with a school-authorized student-designated account before assuming students can use the app.
- Test sign-out/reload. For the later classroom app, use a reviewed membership record to gate course reads; an email-domain check alone is not authorization.
- If Google displays an app-access block, record the error category without sharing credentials; school Workspace admin must decide whether to configure access. Do not try to bypass the policy.

## Pass/fail evidence

- **Pass for this spike:** successful authorized school-account login, callback/session persistence and sign-out in staging; note the account's age-policy category. No roster, grades, or secrets exposed.
- **Not enough to clear launch:** success from only an adult test account; a `@rpr.ac.th` suffix check; a Google sign-in page appearing without completing callback; a personal Gmail account working; success while the app is still only suitable for a limited testing audience.
- **Go/no-go for school release:** authorized student-designated account sign-in, publishing/audience readiness, school data-hosting permission, tested enrollment/RLS/access to protected media, and backup/recovery are separate gates.

## Prerequisites and safety

- Nack must authorize any setup in his own Google Cloud/Supabase accounts before an agent changes them. Never send client secrets or student passwords in chat or commit them to Git.
- Start with the school test account Nack already has; no student roster import and no teacher/student real data for the first test.
- Document the exact test date and result here after execution. This file is a plan, **not evidence that OAuth works**.
