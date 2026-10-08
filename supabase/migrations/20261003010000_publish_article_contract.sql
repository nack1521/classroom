-- Migration: 20261003010000_publish_article_contract.sql
-- B1: Publish and edit-after-publication source contract for teacher articles
-- 1. Extend status to allow 'draft' and 'published'
-- 2. Add published_at timestamp
-- 3. Enforce insert draft-only via trigger and RLS WITH CHECK
-- 4. Enforce immutability of author_id, offering_id, created_at, and prohibit reverting published to draft
-- 5. Scope SELECT and UPDATE RLS to author + active offering assignment for draft and published articles

BEGIN;

-- 1. Add published_at and version columns to articles table if not exists
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- 2. Update status constraint on public.articles
ALTER TABLE public.articles
DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE public.articles
ADD CONSTRAINT articles_status_check
CHECK (status IN ('draft', 'published'));

-- 3. Trigger to enforce insert draft-only and null published_at on new records
CREATE OR REPLACE FUNCTION public.check_article_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.status <> 'draft' THEN
        RAISE EXCEPTION 'new articles must be created as draft';
    END IF;
    IF NEW.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'new articles cannot have published_at set';
    END IF;
    NEW.version := 1;
    NEW.created_at := timezone('utc'::text, now());
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_article_insert ON public.articles;
CREATE TRIGGER trg_check_article_insert
BEFORE INSERT ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.check_article_insert();

-- 4. Trigger to enforce immutability of author_id, offering_id, created_at,
--    manage published_at lifecycle, and strictly forbid published -> draft transitions
CREATE OR REPLACE FUNCTION public.check_article_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.author_id <> OLD.author_id THEN
        RAISE EXCEPTION 'author_id is immutable';
    END IF;
    IF NEW.offering_id <> OLD.offering_id THEN
        RAISE EXCEPTION 'offering_id is immutable';
    END IF;
    IF NEW.created_at <> OLD.created_at THEN
        RAISE EXCEPTION 'created_at is immutable';
    END IF;

    -- Lifecycle and status transition rules
    IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
        -- Draft edit: published_at must remain NULL
        IF NEW.published_at IS NOT NULL AND OLD.published_at IS NULL THEN
            RAISE EXCEPTION 'cannot set published_at while status is draft';
        END IF;
    ELSIF OLD.status = 'draft' AND NEW.status = 'published' THEN
        -- Publishing transition: server strictly sets published_at timestamp
        -- Direct callers cannot supply or spoof published_at
        IF NEW.published_at IS NOT NULL AND OLD.published_at IS NULL THEN
            RAISE EXCEPTION 'client cannot supply published_at on publication';
        END IF;
        NEW.published_at := timezone('utc'::text, now());
    ELSIF OLD.status = 'published' AND NEW.status = 'published' THEN
        -- Edit after publication: status stays published, published_at is immutable
        IF NEW.published_at IS NOT NULL AND NEW.published_at <> OLD.published_at THEN
            RAISE EXCEPTION 'published_at is immutable';
        END IF;
        NEW.published_at := OLD.published_at;
    ELSIF OLD.status = 'published' AND NEW.status = 'draft' THEN
        -- Reverting published to draft is forbidden (no unpublish in B1)
        RAISE EXCEPTION 'published articles cannot be reverted to draft';
    ELSE
        RAISE EXCEPTION 'invalid status transition from % to %', OLD.status, NEW.status;
    END IF;

    -- Monotonic version increment and transaction timestamp
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_article_immutability ON public.articles;
CREATE TRIGGER trg_check_article_immutability
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.check_article_immutability();

-- 5. Row Level Security policies
-- Ensure RLS is active
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Authors can read own drafts and published articles in active assigned offerings
DROP POLICY IF EXISTS "Authors can read own draft in active offering" ON public.articles;
DROP POLICY IF EXISTS "Authors can read own articles in active offering" ON public.articles;
CREATE POLICY "Authors can read own articles in active offering"
ON public.articles
FOR SELECT
TO authenticated
USING (
    author_id = auth.uid()
    AND status IN ('draft', 'published')
    AND public.is_active_offering_teacher(offering_id, auth.uid())
);

-- INSERT policy: Authors can insert own drafts only in active assigned offerings
DROP POLICY IF EXISTS "Authors can insert own draft in active offering" ON public.articles;
CREATE POLICY "Authors can insert own draft in active offering"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (
    author_id = auth.uid()
    AND status = 'draft'
    AND published_at IS NULL
    AND public.is_active_offering_teacher(offering_id, auth.uid())
);

-- UPDATE policy: Authors can update own draft and published articles in active assigned offerings
DROP POLICY IF EXISTS "Authors can update own draft in active offering" ON public.articles;
DROP POLICY IF EXISTS "Authors can update own articles in active offering" ON public.articles;
CREATE POLICY "Authors can update own articles in active offering"
ON public.articles
FOR UPDATE
TO authenticated
USING (
    author_id = auth.uid()
    AND status IN ('draft', 'published')
    AND public.is_active_offering_teacher(offering_id, auth.uid())
)
WITH CHECK (
    author_id = auth.uid()
    AND status IN ('draft', 'published')
    AND public.is_active_offering_teacher(offering_id, auth.uid())
);

COMMIT;
