# ADR-001 — Provisional stack and real-student launch gate

**Status:** Hermes-selected stack for an isolated implementation spike; school rollout remains conditional  
**Date:** 2026-09-24  
**Deadline:** usable by 2026-10-28, first teaching 2026-10-29  
**Inputs:** `SPEC-001-course-posts.md`, `TICKETS-001-course-posts.md`, `../PLANNING_PAPER.md`

## Context

Nack will teach approximately 200 learners in five classes: two classes for subject A and three for subject B. Subject details are not final. By October 28, real learners must sign in and read only their enrolled course's articles. Every learner has a school Google account following the reported `student-id@rpr.ac.th` pattern. Nack reports that a mentor teacher approved use of the roster, but school IT approval of a third-party Google OAuth app and the live data processor/hosting arrangement is not yet established. Budget target: free or at most USD 3/month; separate services are acceptable. Nack wants to learn Vue and PostgreSQL; an existing editorial admin is acceptable.

**Important:** The older SPEC-001 and TICKETS-001 assume demo-only learners; they are not launch criteria. Revise them before coding against real accounts.

**OAuth ownership decision (confirmed by Nack):** use a Google Cloud OAuth app under Nack's personal account, informed by his previous experience with a university-domain Google login. This is an **External** app relative to the school's Workspace. Prefer a separate Classroom OAuth client/project rather than sharing credentials or redirects with the earlier university room-booking app. Prior experience does not prove the school account policy permits this new app. The executable test plan is `SPIKE-001-school-google-login.md`; it has not been run yet.[4][11]

## Proposed launch stack

- **Web app:** Nuxt (Vue + TypeScript), deployed to an eligible free tier such as Cloudflare. Nuxt documents Cloudflare deployment; validate current runtime limits in a deployment spike before relying on it.[2]
- **Data and identity:** Supabase PostgreSQL and Supabase Auth with Google sign-in. Supabase documents Google sign-in and RLS policies; the application must still model five course offerings, enrollments, teacher ownership, draft/published/public states, and checks for every read/write.[3][5]
- **Protected media:** Supabase Storage in private buckets with storage access policies and/or server-authorized delivery. A public URL or long-lived signed link is not a substitute for per-course authorization.[6]
- **Teacher writing:** Use a ready-made editor component (candidate: Tiptap) within a small teacher-admin page for the deadline release; code blocks are supported by an extension. This is **not** a complete ready-made CMS, and image upload, toolbar, serialization, and preview must be built and tested.[8]
- **Auth design:** Google OAuth identity + application session; JWT may be part of provider-issued auth but is not the policy. Link a verified login identity to a reviewed enrollment, never grant access from the `@rpr.ac.th` suffix alone. Do not use an unverified email local-part as a student record key. If checking Google Workspace membership, verify appropriate token claims rather than trusting an OAuth UI hint.[9]

## Why not Directus for the deadline baseline?

Directus has a ready-made editorial studio and can use PostgreSQL, but it introduces another hosted service plus integration of student identity, content permissions, protected files, and deployment. Its documentation recommends 2 GB RAM for the Directus container alone, before Nuxt and PostgreSQL; the self-host license/limits also need inspection for this use case. Treat it as a focused spike after a working minimal editor and auth, not as a presumed under-USD-3 production plan.[7][10]

## Cost and reliability check (not a price guarantee)

Supabase's current Free tier lists 50,000 monthly active users, a 500 MB database, 1 GB file storage, 5 GB egress, and possible pause after one week of inactivity. Approx. 200 learners fit the *user-count quota*, not necessarily storage, bandwidth, backup, uptime, or operational requirements. Image sizes and request patterns need a measured estimate. The deployment provider's free-tier limits and terms must also be checked before launch. Zero monthly cost is a hypothesis to test; it is not a production SLA.[1]

## Critical external prerequisite

Google Workspace for Education can restrict unconfigured third-party apps for users designated under 18. Mentor approval to use a roster does not prove that the school administrator has approved the OAuth application or the chosen hosting/data processor. Run a small test with a **school-authorized test student account** and obtain the necessary administrative confirmation before depending on Google sign-in for 200 learners.[4]

### School Google sign-in: configuration and pilot

The presence of a school email address and a frontend `@rpr.ac.th` check do **not** implement Google sign-in. For the proposed Nuxt + Supabase architecture:

1. Configure a Google Auth Platform project and consent screen with the smallest identity scopes (`openid`, `email`, `profile`). Nack chose a personal project, so this is an **External** OAuth app relative to the school; **Internal** requires an app inside the school's Workspace organization. Review publishing/test-user status before a 200-learner launch; Google's rules differ by audience, publishing status, and scopes.[11][12]
2. Create a **Web application** OAuth client and register the exact Supabase callback URL shown in the Supabase Google provider settings as an authorized redirect URI. Enable Google provider in Supabase with that client ID/secret; keep the secret out of Git and chat. Configure the site's own post-login redirect separately.[3]
3. In a small staging app, attempt the full sign-in flow with an authorized school test account. Do not infer success from the fact that the test address can sign in to Google itself. If Workspace blocks the third-party app, only the relevant school administrator can configure its app access; changing a domain check in Nuxt will not fix that.[4]
4. After sign-in, bind a verified provider identity to teacher-reviewed course enrollment. Domain matching is not enrollment. Google documents `sub` as the stable user identifier and a verified `hd` claim (when available) for Workspace domain membership; a UI hint or email suffix alone is not a security control.[9]
5. Exercise sign-in, callback, reload, sign-out, wrong-course denial, draft denial, and protected-image denial. If the school cannot authorize this flow, redesign onboarding rather than routing around its policy.

## Launch acceptance gate (must become tickets)

1. Confirm organizational permission for live roster/Google OAuth/third-party hosting, and who can configure the school's Workspace app access. Record the decision; do not paste real roster data into public chat or Git.
2. In a staging environment, test one teacher, one enrolled school student, one non-member, and one signed-out visitor with school-authorized accounts. Verify sign-in, sign-out, session recovery, wrong-course denial by direct URL, draft denial, and private-image denial.
3. Import five class memberships via a teacher-reviewed protected process. Resolve missing/duplicate IDs and email mismatches; never assume every roster ID maps correctly to an account. Enrollment is separate from authentication.
4. Provide a day-one teacher path to publish a lesson and a student path to locate and read it on a phone; ensure one public article can remain public without leaking course data.
5. Rehearse database/media backup and restore, document admin recovery, monitor errors, and test actual school-network devices. Provide a school-approved fallback for an OAuth outage or failed launch gate.
6. Measure storage/egress and exercise a realistic concurrent-read test before declaring the free tier sufficient. If limits or reliability fail, re-scope or revise budget; don't silently weaken privacy.

## Unresolved decisions requiring Nack / school input

- Can the school's Google Workspace administrator allow the planned OAuth application for students, especially those designated under 18? Who will arrange it?
- Will the mentor/school approve use of an external Supabase/Cloudflare-hosted service with student identifiers and course membership, or only approve the roster in principle?
- Does the first teaching day require only reading course articles, or must teacher editing, public articles, rich code/image blocks, and account support all be polished by then?
- Is the USD 3 monthly ceiling strict, including domain and backup, if free-tier limits are exceeded?

## Decision status

**No vendor account created, no OAuth application configured, and no production data imported.** Nack delegated planning/stack decisions to Hermes and coding to Antigravity. Hermes selected Nuxt + Supabase for the first isolated OAuth implementation spike; live rollout is still conditional on school-OAuth pilot, approval of external hosting, and access-control/deployment checks. See SPEC-002 and TICKETS-002; do not mark the old demo tickets as release-ready.

## Sources

[1] https://supabase.com/pricing — Supabase pricing
[2] https://nuxt.com/deploy/cloudflare — Nuxt Cloudflare deployment
[3] https://supabase.com/docs/guides/auth/social-login/auth-google — Supabase Google sign-in
[4] https://support.google.com/a/answer/13288950 — Google Workspace Education under-18 third-party apps
[5] https://supabase.com/docs/guides/database/postgres/row-level-security — Supabase RLS
[6] https://supabase.com/docs/guides/storage/security/access-control — Supabase Storage access control
[7] https://directus.io/docs/self-hosting/requirements — Directus self-hosting requirements
[8] https://tiptap.dev/docs/editor/extensions/nodes/code-block — Tiptap code block
[9] https://developers.google.com/identity/gsi/web/guides/verify-google-id-token — Google ID token verification
[10] https://directus.io/docs/licensing/overview — Directus licensing overview
[11] https://developers.google.com/identity/protocols/oauth2/production-readiness/overview — Google OAuth app publishing status
[12] https://developers.google.com/workspace/guides/configure-oauth-consent — Google OAuth consent configuration
