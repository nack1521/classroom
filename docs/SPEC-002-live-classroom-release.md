# SPEC-002 — Live classroom reading release

**Status:** Hermes-selected release scope; external school/OAuth gates remain open  
**Date:** 2026-09-24  
**Target:** October 28, 2026 (teaching begins October 29)  
**Owner:** Nack  
**Supersedes for launch:** SPEC-001's demo-only release assumptions; SPEC-001 remains the product-direction reference.

## Goal

One teacher can publish an article to one of five course offerings; a real learner can sign in with a school Google account and read only the offerings to which they are enrolled. Expected scale is approximately 200 learners in five classes: two classes for subject A, three for subject B. Subject names are configurable; they are not known yet.

## Hermes's bounded release decision

- **Stack for the first implementation spike:** Nuxt + Vue + TypeScript; Supabase PostgreSQL/Auth/Storage; a small teacher editor using a prebuilt rich-text editor component rather than self-hosting Directus before launch. Cloudflare deployment is a candidate, not a verified host. Google OAuth app lives in Nack's personal Google Cloud project, separate from the previous university project.
- **Day-one must work:** teacher login and publishing, student school-Google login, five configurable course offerings, verified enrolment, course list, restricted article reading on a phone, logout/session recovery, and denial of wrong-course/draft/media access.
- **Day-one authoring minimum:** title, paragraphs/headings, links, code block, and image insertion with alt text. Keep the data representation extensible for bold/underline/lists; finish those if core access/reliability is already green. No native diagram editor.
- **Later (not a launch blocker):** public articles, full Word-like styling, search, comments, attendance, submissions, grades, mentor co-authoring, Canva embed, native diagram editing, and OCR from roster photos. Retain these in the longer-term product backlog.
- **Operations are part of release:** school-authorized access to real records and third-party services, protected import with preview/correction, backup and restore rehearsal, error monitoring, and a documented fallback if OAuth or hosting fails.

## Actors and data

- **Teacher:** an explicitly assigned owner account; a school-email suffix does not grant teacher privileges.
- **Learner:** a Google-authenticated account linked to a teacher-reviewed enrollment. Login identity alone does not confer membership.
- **Visitor:** no access to any course article in the launch release.
- **Subject:** reusable name/code. **Course offering:** subject + class/group + term; five offerings expected. **Enrollment:** learner identity ↔ offering. **Article:** owner, offering, draft/published state, content, protected images.
- A roster-to-email match is a proposed import aid, not proof of enrollment. Duplicates and unknown identities are held for teacher review. No real roster, account secrets, or student photos in Git, public chat, or test fixtures.

## Acceptance criteria

1. **OAuth pilot:** A school-authorized student-designated account completes Google sign-in to a personal-project External OAuth app, returns to the app, remains signed in after reload, and can sign out. A success with only an adult/test account is insufficient. If school policy blocks the app, stop and request the school's decision; do not bypass it.
2. **Enrollment:** Teacher-reviewed input assigns the five offerings; any unmatched/duplicate email or ID is shown for correction and does not auto-enroll. Student access is based on an explicit membership record linked to the authenticated identity, not merely `@rpr.ac.th`.
3. **Authoring:** Teacher saves a draft, reloads it, previews it, publishes to one offering, and sees a save failure as an error. Students and visitors cannot read a draft by direct URL.
4. **Reading/access matrix:** An enrolled learner can list and open published articles only for their offering; a nonmember and visitor cannot retrieve the article or its private images by list, guessed URL, or direct API/storage request. A student cannot publish or edit through direct requests.
5. **Content:** A teacher can add headings, links, a readable code block, and an image with alt text; the student sees equivalent content on a phone. Unsafe embedded markup does not execute.
6. **Operational readiness:** Test with authorized school identities on actual student devices and school network; verify backup *and restore* of article/enrollment data and media; check quota/egress under a realistic read pattern and log no tokens, passwords, or roster data. Record an emergency teaching fallback approved by the school.
7. **Release gate:** Complete 1–6 with evidence and human review before inviting all students. If school OAuth, external hosting authority, or access isolation fails, do not silently loosen permissions to hit the date.

## Dependencies and open external approvals

- Nack authorized Hermes to decide the plan and delegates coding to Antigravity. **Submitting an IDE task still requires explicit confirmation of destination and scope at action time.**
- Nack reports mentor approval for using rosters, but the school Workspace administrator's app policy and the school's position on third-party hosting have not been verified.
- No OAuth app, Supabase project, repository, deployment, or login test has been created or run by this project yet. Those are implementation steps, not planning evidence.
