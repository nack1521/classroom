# SPEC-001 — Course articles: teacher writes, learner reads

**Status:** Access rule approved; release scope needs revision for the October 28 real-use deadline before coding  
**Date:** 2026-09-24  
**Source of truth:** `../PLANNING_PAPER.md`

## Problem and outcome

A teacher needs an easy way to create readable teaching articles with code and visuals, organize them under a course, and share them with the right learners. The same site should eventually support assignments and grades, without requiring those systems in the first release.

**New release constraint (2026-09-24):** Nack wants a genuinely usable website by October 28, 2026, ahead of teaching on October 29. The original V1 below assumes fictitious users and explicitly defers real-student rollout. Treat that as an unresolved scope conflict, not as permission to quietly ship a demo as a live classroom system. Confirm what real use on day one requires, then revise this spec and its tickets accordingly.

**First end-to-end journey:** A teacher signs in, drafts an article for a course with structured formatting, previews it, publishes it, and an enrolled learner signs in and reads it. The teacher can alternatively choose to publish a non-student-specific article publicly.

**Actors:** teacher/author, enrolled learner, signed-in non-member, visitor.

## Proposed V1 scope

1. One or more preconfigured demo courses and fictitious learner accounts, so the first journey can be exercised without real student data or a roster import. Teacher and learner authenticate; account invitation and self-registration are deferred.
2. Teacher can create, edit, preview, publish, and unpublish their own article. A draft is private to the teacher. Delete/archive is deferred until its retention policy is designed.
3. A toolbar-based structured editor supports paragraphs, heading levels, bold, underline, bullet/numbered lists, links, application-managed image uploads (including externally created diagrams) with alt text, and fenced/code blocks with a language label. Course-restricted image files must be access-controlled by the application; a public external image URL cannot be treated as private media. Keep typography consistent across articles rather than allowing arbitrary font families/sizes per selection.
4. An article has a title, course assignment when restricted, and a publication audience: `course` or `public`. A public article need not be attached to a course; a restricted article must be attached to a course.
5. Learners can list their courses, browse published articles in each, and read them on phone and desktop. Readers get clear heading hierarchy, readable code blocks, images with alt text, and working links.
6. Visitors can browse/read published public articles without signing in; course articles require a signed-in member of that course. A teacher can manage only their own courses/articles in V1.
7. Authorized access is checked on the server for list, article detail, media where applicable, and article-management operations; hiding UI controls alone is not access control.

## Explicit non-goals for V1

- Importing or processing real student rosters; creating student accounts from photos; production rollout to actual students.
- Assignment submission, attendance, scoring, grade visibility, and parent accounts.
- Native diagram creation, arbitrary Word-style formatting, delete/archive, comments, advanced search, analytics, or automatic table of contents.
- Direct Canva editing; an ordinary external link or image export is sufficient for the first slice. Embedding can be evaluated later.
- Choosing a framework, editor library, authentication service, database, or hosting provider in this spec.

## Acceptance criteria (observable)

- **AC1 — Draft:** Given a signed-in teacher, when they create an article with title and body and save it as a draft, it remains after reload; visitors, enrolled learners, and non-members cannot retrieve the draft by guessing its URL.
- **AC2 — Rich content:** The teacher can add headings, bold, underline, bullet and numbered lists, a clickable link, an uploaded image with alt text, and a labeled code block; the preview and published article show the intended structure and preserve code whitespace. Unsafe embedded markup does not execute. Course-only media is inaccessible to non-members through direct media URLs.
- **AC3 — Course publishing:** Given a demo course and an enrolled learner, when the teacher publishes a `course` article for it, that learner sees it in the course list and can open it while signed in.
- **AC4 — Access isolation:** A visitor and a signed-in learner who is not enrolled cannot read that course article through the UI or a direct URL; they cannot retrieve its protected media either. A learner cannot create/edit/publish an article.
- **AC5 — Public publishing:** When the teacher creates an article without attaching a course and publishes it as `public`, a visitor can open it without logging in and find it on the public article list. A public article never exposes roster, submissions, or grades.
- **AC6 — Change visibility:** Edits to a published article become visible after saving; unpublishing it removes it from the learner/public lists and blocks direct reader access, while the teacher retains access to the draft.
- **AC7 — Reading:** Article and course-list pages work at mobile and desktop widths; headings are navigable, images have text alternatives, links are keyboard accessible, and code is readable without breaking layout.
- **AC8 — Empty/error states:** A learner with no courses sees an explanatory empty state. Unauthorized access does not disclose article content. A failed save reports an error and does not claim success.
- **AC9 — Verification:** Automated tests cover publication visibility and role/course authorization (including direct URLs), editor content rendering, and at least one failed-save path. A human reviews a mobile and desktop demo before calling V1 done.

## Risks and assumptions to validate before implementation

- **Assumption:** In V1, demo accounts and sample courses are acceptable; the product is a prototype, not a live student system. Real onboarding requires a separate approved design and data-handling review.
- **Confirmed by Nack:** `course` means enrolled members only, not every signed-in learner; `public` is readable by everyone.
- **Assumption:** Public content is a deliberate publication choice. Default audience should be private/course-restricted rather than public; confirm the exact default in UI design.
- **Open:** Who may author content besides Nack? V1 assumes one teacher.
- **Deferred:** Delete/archive is not part of V1; define retention policy before adding it later.
- **Required before implementation:** Pick image upload/storage that enforces the article's audience. Externally hosted images may be linked to from an article but their bytes cannot be guaranteed private; do not hotlink them as protected course media.
- **Open:** Does the reader need an automatic table of contents in V1? Currently deferred.
- **Open:** What course naming (code, class, term/year) is required for the demo?
- **Demo identity rule:** Seed fictitious roles and memberships in an isolated dev/test environment. Generate credentials for a local run rather than storing passwords in source, fixtures, Git, or chat; test authentication without echoing secrets into dev-server logs.

## Approval gate and next SDLC step

Nack confirmed the access rule and asked to proceed. Split this spec into small vertical-slice tickets; before coding, resolve the remaining implementation decisions (image storage, archive/delete, auth approach) and compare stacks against these requirements. No real roster, secrets, or production student data in tickets or test fixtures.
