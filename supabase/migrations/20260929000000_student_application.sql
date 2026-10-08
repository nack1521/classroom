-- Migration: 20260929000000_student_application.sql
-- Description: Slice 0B student application and class schema (local/synthetic only)
-- Sets up classes and student_applications tables, active class enforcement, explicit grants, and RLS policies.

-- 1. Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on is_active for efficient filtering
CREATE INDEX IF NOT EXISTS classes_is_active_idx ON public.classes (is_active);

-- Enable and enforce RLS on classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes FORCE ROW LEVEL SECURITY;

-- Grants for classes: authenticated users can SELECT active classes only
REVOKE ALL ON TABLE public.classes FROM public;
REVOKE ALL ON TABLE public.classes FROM anon;
REVOKE ALL ON TABLE public.classes FROM authenticated;

GRANT SELECT ON TABLE public.classes TO authenticated;
GRANT ALL ON TABLE public.classes TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view active classes" ON public.classes;
CREATE POLICY "Authenticated users can view active classes"
ON public.classes
FOR SELECT
TO authenticated
USING (is_active = true);


-- 2. Create student_applications table
CREATE TABLE IF NOT EXISTS public.student_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (title IN ('นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.')),
    first_name TEXT NOT NULL CHECK (length(trim(first_name)) > 0 AND length(first_name) <= 100),
    last_name TEXT NOT NULL CHECK (length(trim(last_name)) > 0 AND length(last_name) <= 100),
    student_id TEXT NOT NULL CHECK (student_id ~ '^[0-9]{5}$'),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    roll_number INTEGER NOT NULL CHECK (roll_number >= 1 AND roll_number <= 45),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT student_applications_user_id_key UNIQUE (user_id)
);

-- Note: student_id and (class_id, roll_number) are deliberately NOT constrained to be unique
-- for pending applications. Two applicants may claim the same school ID or same roll number while pending.

-- Indices for performance
CREATE INDEX IF NOT EXISTS student_applications_user_id_idx ON public.student_applications (user_id);
CREATE INDEX IF NOT EXISTS student_applications_class_id_idx ON public.student_applications (class_id);
CREATE INDEX IF NOT EXISTS student_applications_student_id_idx ON public.student_applications (student_id);

-- 3. Guard trigger: reject applications to non-existent or inactive classes
CREATE OR REPLACE FUNCTION public.check_student_application_class_active()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.classes
        WHERE id = NEW.class_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Cannot apply to an inactive or non-existent class';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_student_application_class_active ON public.student_applications;
CREATE TRIGGER trg_check_student_application_class_active
BEFORE INSERT ON public.student_applications
FOR EACH ROW EXECUTE FUNCTION public.check_student_application_class_active();

-- 4. Enable and enforce RLS on student_applications
ALTER TABLE public.student_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_applications FORCE ROW LEVEL SECURITY;

-- Explicit table grants (least privilege)
REVOKE ALL ON TABLE public.student_applications FROM public;
REVOKE ALL ON TABLE public.student_applications FROM anon;
REVOKE ALL ON TABLE public.student_applications FROM authenticated;

-- Authenticated users can SELECT and INSERT only
GRANT SELECT, INSERT ON TABLE public.student_applications TO authenticated;
GRANT ALL ON TABLE public.student_applications TO service_role;

-- 5. RLS Policies
-- Applicant may ONLY view their own application
DROP POLICY IF EXISTS "Applicants can view own application" ON public.student_applications;
CREATE POLICY "Applicants can view own application"
ON public.student_applications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Applicant may ONLY insert with their own user_id and pending status
DROP POLICY IF EXISTS "Applicants can insert own pending application" ON public.student_applications;
CREATE POLICY "Applicants can insert own pending application"
ON public.student_applications
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
);

-- Note: NO update or delete policies are granted to authenticated or anon.
-- Any direct mutation attempt will fail at the DB grant / RLS boundary.
