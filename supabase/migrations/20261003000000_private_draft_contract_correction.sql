-- Migration: 20261003000000_private_draft_contract_correction.sql
-- Bounded database-contract correction for Slice 1A private drafts:
-- 1. Align title normalization and body nonblank check with ECMAScript trim semantics.
-- 2. Bind is_active_offering_teacher helper to caller identity and revoke anon/PUBLIC/service_role execution.
-- 3. Atomic execution preserving updated_at on existing drafts.

BEGIN;

-- 1. ECMAScript whitespace trim function (ECMA-262 12th+ Edition String.prototype.trim)
-- Trims 25 whitespace/line-terminator code points:
-- 0x0009-0x000D, 0x0020, 0x00A0, 0x1680, 0x2000-0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF
CREATE OR REPLACE FUNCTION public.trim_js_whitespace(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT regexp_replace(
    regexp_replace(
      input_text,
      U&'^[\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
      ''
    ),
    U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+$',
    ''
  );
$$;

-- 2. Title normalization trigger on public.articles
-- Normalizes title on INSERT and UPDATE before constraint checks run.
CREATE OR REPLACE FUNCTION public.normalize_article_title()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.title IS NOT NULL THEN
    NEW.title := public.trim_js_whitespace(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_article_title ON public.articles;
CREATE TRIGGER trg_normalize_article_title
BEFORE INSERT OR UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_article_title();

-- 3. Upgrade backfill: normalize existing article titles requiring trimming
-- Temporarily disable trg_check_article_immutability to preserve updated_at during the backfill
ALTER TABLE public.articles DISABLE TRIGGER trg_check_article_immutability;

UPDATE public.articles
SET title = public.trim_js_whitespace(title)
WHERE title IS NOT NULL AND title <> public.trim_js_whitespace(title);

ALTER TABLE public.articles ENABLE TRIGGER trg_check_article_immutability;

-- 4. Constraint adjustments on public.articles
-- Title: must be non-empty after normalization and at most 200 code points
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_title_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_title_check
  CHECK (char_length(title) > 0 AND char_length(title) <= 200);

-- Body: raw body preserved; must not be ECMAScript-whitespace-only, raw length at most 50,000 code points
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_body_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_body_check
  CHECK (char_length(public.trim_js_whitespace(body)) > 0 AND char_length(body) <= 50000);

-- 5. Helper function authorization hardening and probe prevention
CREATE OR REPLACE FUNCTION public.is_active_offering_teacher(p_offering_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  -- Bind callers strictly to non-null auth.uid() matching p_user_id
  -- Return non-disclosing FALSE if caller identity does not match p_user_id
  IF v_caller IS NULL OR v_caller <> p_user_id THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.teacher_offering_assignments toa
    JOIN public.course_offerings co ON co.id = toa.offering_id
    JOIN public.classes c ON c.id = co.class_id
    JOIN public.subjects s ON s.id = co.subject_id
    JOIN public.user_roles ur ON ur.user_id = toa.teacher_id
    WHERE toa.offering_id = p_offering_id
      AND toa.teacher_id = p_user_id
      AND ur.role = 'teacher'
      AND co.is_active = true
      AND c.is_active = true
      AND s.is_active = true
  );
END;
$$;

-- Revoke default PUBLIC, anon, and service_role execution to eliminate unrestricted probe exposure
REVOKE ALL ON FUNCTION public.is_active_offering_teacher(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_offering_teacher(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.is_active_offering_teacher(UUID, UUID) FROM service_role;
GRANT EXECUTE ON FUNCTION public.is_active_offering_teacher(UUID, UUID) TO authenticated;

COMMIT;
