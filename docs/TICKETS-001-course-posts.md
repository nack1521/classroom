# TICKETS-001 — Course articles, first vertical slices

**Status:** Proposed implementation backlog; no code started  
**Date:** 2026-09-24  
**Spec:** `SPEC-001-course-posts.md`  
**Order:** Complete and demonstrate one ticket before starting the next. Use fictitious accounts and courses only.

## Working agreement for every ticket

- Start by reading the relevant spec and inspecting the actual repository. Write a behavior test, run it to see an expected failure, implement the smallest change, and rerun targeted and full tests.
- Record test/lint/typecheck/build output and an actual UI or API demo. A separate reviewer checks the diff against the ticket and spec before the ticket is marked done.
- No deployment with real student records. No assumption that a hidden button provides authorization. Scope changes return to the product owner.
- Each ticket is an observable user outcome, not a standalone layer such as “make all database tables.”

## Ticket 1 — Teacher can create and reopen a private text draft

**User outcome:** As the teacher, I sign in, write a titled article in a demo course, save it, and find it again after reload.

**Scope:** One fictitious teacher identity, one demo course owned by that teacher, durable draft storage, basic title/body form, teacher draft list and edit page. It is acceptable to use plain paragraphs in this first slice. No learner account required yet. Provision only in an isolated local/test environment with generated credentials, never committed or logged.

**Acceptance:**
- Given the teacher account, when a titled draft is saved, it appears in the teacher's draft list and reload preserves title/body.
- Missing title/body is rejected with an actionable error; a failed save does not show success.
- A visitor cannot access the authoring route or retrieve a draft by direct URL.
- The teacher can preview the draft without publishing it.

**Evidence:** Tests for save/reload, validation, direct-URL draft isolation; local demo with a fictitious example lesson.

**Depends on:** stack/auth/storage decision before implementation.  
**Spec coverage:** AC1, part of AC8–AC9.  
**Out of scope:** real student data, public publishing, rich text.

## Ticket 2 — Enrolled learner can read a course article; non-member cannot

**User outcome:** As a fictitious enrolled learner, I sign in, open my demo course, and read a text article that the teacher published there.

**Scope:** Fictitious enrolled and non-enrolled learner identities, course membership, teacher publish action for a draft, learner course/article list and reading page, server-side authorization. Do not create an account-registration workflow yet.

**Acceptance:**
- Teacher publishes the draft to their demo course; enrolled learner sees it in the course and can read it.
- Signed-out visitor and signed-in non-member cannot retrieve the article by list or direct URL.
- Signed-in enrolled and non-enrolled learners cannot retrieve an unpublished draft by direct URL, even if the article belongs to their course.
- A learner cannot call authoring or publish operations by constructing a request.
- A learner with no enrolled courses sees a helpful empty state; denied access reveals no article content.

**Evidence:** Repeatable local/test-only seed of fictitious teacher, enrolled learner, and non-member (plus generated non-committed credentials); integration tests for the role matrix, draft isolation, and a teacher-to-learner demo. Do not print credentials into dev-server traces or test logs.  
**Depends on:** Ticket 1.  
**Spec coverage:** AC3–AC4, part of AC8–AC9.  
**Out of scope:** real roster imports or manual student provisioning.

## Ticket 3 — Teacher can create rich, readable teaching content

**User outcome:** As the teacher, I add headings, bold/underline, bulleted and numbered lists, a link, an uploaded image of a diagram made externally, and a code block to a course article; the learner reads them clearly on mobile and desktop.

**Scope:** Structured toolbar editor, safe content storage/rendering, image upload with alt text, code language label and whitespace preservation, consistent article typography. Confirm image storage choice and media authorization before coding. Course-only images must be application-managed and gated; a direct URL to an external image cannot be promised private.

**Acceptance:**
- Save, reload, preview, and publish preserve headings, bold, underline, both list types, code language/whitespace, links, and image alt text.
- Uploaded course-restricted images cannot be fetched through a guessed media URL by a visitor or non-member.
- Untrusted markup or script does not execute when rendered; malformed links are handled safely.
- Reading page works at a narrow mobile viewport and desktop; long code does not overflow the page.

**Evidence:** Content round-trip/rendering and sanitization tests, media-access test, mobile/desktop visual review.  
**Depends on:** Ticket 2.  
**Spec coverage:** AC2, AC4, AC7, AC9.  
**Out of scope:** native diagram editing, unrestricted per-span fonts, Canva embedding.

## Ticket 4 — Teacher can publish an article for everyone

**User outcome:** As the teacher, I deliberately publish a general article as public; a visitor can find and read it without signing in.

**Scope:** Teacher can create an article without a course, choose public audience deliberately, and publish it; public list/detail, default-safe publication UI, separation from course-restricted content.

**Acceptance:**
- A visitor can list and open a published public article that is not assigned to any course, without login.
- Drafts and course articles never appear in public results or become readable via direct URL.
- The publishing screen clearly displays the chosen audience and asks for confirmation before changing a restricted article to public.
- Public view exposes no student roster, assignment, or grade data.

**Evidence:** Automated audience-matrix tests and signed-out browser demo.  
**Depends on:** Ticket 2 (can be scheduled after Ticket 3 as above).  
**Spec coverage:** AC5, AC9.  
**Out of scope:** comments, public user accounts.

## Ticket 5 — Teacher can revise or withdraw content safely

**User outcome:** As the teacher, I correct a published article or unpublish it and can confirm the reader sees the correct state.

**Scope:** Published article editing, unpublish-to-draft transition, accessible empty/error states, final end-to-end verification. Delete/archive is deferred beyond V1; no hidden deletion requirement in this ticket.

**Acceptance:**
- Saved edits are visible to the proper audience and preserve the chosen access rule.
- Unpublished article disappears from reader lists and is unavailable at the old direct URL; teacher can still edit it.
- Failed save reports failure and keeps a recoverable editing state.
- Full tests, lint, typecheck, build, independent review, and mobile/desktop demo are recorded; no real student data appears in fixtures or screenshots.

**Evidence:** Regression tests for edit/unpublish/read authorization and a short demo checklist with actual results.  
**Depends on:** Tickets 1–4.  
**Spec coverage:** AC6–AC9 and final V1 Definition of Done.

## Gates before Ticket 1 implementation

1. Compare a minimal stack against the spec; choose framework, storage, rich-text editor path, auth approach, test commands, and hosting target. Record reasons and rejected options in the decision log.
2. Create a Git repository and project working agreement (`AGENTS.md` for cross-agent use); document local run, test, lint, typecheck, and build commands.
3. Confirm isolated demo-account seeds with generated credentials (never committed/logged), public-default safeguards, and protected image storage/permissions. Do not place example passwords or live credentials in docs, fixtures, Git, or chat.
4. Keep roster intake/production accounts as a later project decision, not a hidden dependency of these demo slices.

## Learning check after each ticket

- What did the acceptance criteria miss?
- Which tests failed first, and what did that reveal?
- What did the independent reviewer find that the builder missed?
- What is the observed time/rework/tool cost relative to the last ticket?
- Which procedure is worth saving as a project rule or skill, and which was unnecessary overhead?
