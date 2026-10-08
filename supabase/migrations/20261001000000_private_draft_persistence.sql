-- Migration: 20261001000000_private_draft_persistence.sql
-- Slice 1A: Private draft persistence schema, triggers, and RLS policies

-- 1. Subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE CHECK (length(trim(code)) > 0 AND length(code) <= 20),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.subjects FROM public;
REVOKE ALL ON TABLE public.subjects FROM anon;
REVOKE ALL ON TABLE public.subjects FROM authenticated;
GRANT SELECT ON TABLE public.subjects TO authenticated;
GRANT ALL ON TABLE public.subjects TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view active subjects" ON public.subjects;
CREATE POLICY "Authenticated users can view active subjects"
ON public.subjects
FOR SELECT
TO authenticated
USING (is_active = true);


-- 2. Course Offerings table
CREATE TABLE IF NOT EXISTS public.course_offerings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    term INTEGER NOT NULL CHECK (term IN (1, 2)),
    academic_year TEXT NOT NULL CHECK (academic_year ~ '^[0-9]{4}$'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT course_offerings_subject_class_term_year_key UNIQUE (subject_id, class_id, term, academic_year)
);

-- Trigger to enforce offering academic_year consistency with class academic_year
CREATE OR REPLACE FUNCTION public.check_offering_year_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_class_year TEXT;
BEGIN
    SELECT academic_year INTO v_class_year FROM public.classes WHERE id = NEW.class_id;
    IF v_class_year IS NULL OR NEW.academic_year <> v_class_year THEN
        RAISE EXCEPTION 'Offering academic_year must match class academic_year';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_offering_year_consistency ON public.course_offerings;
CREATE TRIGGER trg_check_offering_year_consistency
BEFORE INSERT OR UPDATE ON public.course_offerings
FOR EACH ROW
EXECUTE FUNCTION public.check_offering_year_consistency();

ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.course_offerings FROM public;
REVOKE ALL ON TABLE public.course_offerings FROM anon;
REVOKE ALL ON TABLE public.course_offerings FROM authenticated;
GRANT SELECT ON TABLE public.course_offerings TO authenticated;
GRANT ALL ON TABLE public.course_offerings TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view active offerings" ON public.course_offerings;
CREATE POLICY "Authenticated users can view active offerings"
ON public.course_offerings
FOR SELECT
TO authenticated
USING (is_active = true);


-- 3. Teacher Offering Assignments table
CREATE TABLE IF NOT EXISTS public.teacher_offering_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT teacher_offering_assignments_teacher_offering_key UNIQUE (teacher_id, offering_id)
);

-- Trigger to ensure assigned teacher possesses teacher role
CREATE OR REPLACE FUNCTION public.check_teacher_assignment_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = NEW.teacher_id AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Target user does not have teacher role';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_teacher_assignment_role ON public.teacher_offering_assignments;
CREATE TRIGGER trg_check_teacher_assignment_role
BEFORE INSERT OR UPDATE ON public.teacher_offering_assignments
FOR EACH ROW
EXECUTE FUNCTION public.check_teacher_assignment_role();

ALTER TABLE public.teacher_offering_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.teacher_offering_assignments FROM public;
REVOKE ALL ON TABLE public.teacher_offering_assignments FROM anon;
REVOKE ALL ON TABLE public.teacher_offering_assignments FROM authenticated;
GRANT SELECT ON TABLE public.teacher_offering_assignments TO authenticated;
GRANT ALL ON TABLE public.teacher_offering_assignments TO service_role;

DROP POLICY IF EXISTS "Teachers can view own offering assignments" ON public.teacher_offering_assignments;
CREATE POLICY "Teachers can view own offering assignments"
ON public.teacher_offering_assignments
FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());


-- 4. Articles table (Drafts)
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offering_id UUID NOT NULL REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0 AND char_length(title) <= 200),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0 AND char_length(body) <= 50000),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Helper function to check if caller is an active assigned teacher for an offering
CREATE OR REPLACE FUNCTION public.is_active_offering_teacher(p_offering_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
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
$$;

-- Trigger to enforce immutability of author_id and offering_id, and updated_at maintenance
CREATE OR REPLACE FUNCTION public.check_article_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.author_id <> OLD.author_id THEN
        RAISE EXCEPTION 'author_id is immutable';
    END IF;
    IF NEW.offering_id <> OLD.offering_id THEN
        RAISE EXCEPTION 'offering_id is immutable';
    END IF;
    IF NEW.status <> 'draft' THEN
        RAISE EXCEPTION 'status cannot be changed from draft in Slice 1A';
    END IF;
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_article_immutability ON public.articles;
CREATE TRIGGER trg_check_article_immutability
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.check_article_immutability();

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.articles FROM public;
REVOKE ALL ON TABLE public.articles FROM anon;
REVOKE ALL ON TABLE public.articles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.articles TO authenticated;
GRANT ALL ON TABLE public.articles TO service_role;

DROP POLICY IF EXISTS "Authors can read own draft in active offering" ON public.articles;
CREATE POLICY "Authors can read own draft in active offering"
ON public.articles
FOR SELECT
TO authenticated
USING (
    author_id = auth.uid()
    AND status = 'draft'
    AND public.is_active_offering_teacher(offering_id, auth.uid())
);

DROP POLICY IF EXISTS "Authors can insert own draft in active offering" ON public.articles;
CREATE POLICY "Authors can insert own draft in active offering"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (
    author_id = auth.uid()
    AND status = 'draft'
    AND public.is_active_offering_teacher(offering_id, auth.uid())
);

DROP POLICY IF EXISTS "Authors can update own draft in active offering" ON public.articles;
CREATE POLICY "Authors can update own draft in active offering"
ON public.articles
FOR UPDATE
TO authenticated
USING (
    author_id = auth.uid()
    AND status = 'draft'
    AND public.is_active_offering_teacher(offering_id, auth.uid())
)
WITH CHECK (
    author_id = auth.uid()
    AND status = 'draft'
    AND public.is_active_offering_teacher(offering_id, auth.uid())
);
