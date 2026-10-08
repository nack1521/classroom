-- Migration: 20261004010000_enrolled_reader_contract.sql
-- B2: Enrolled reader source contract for published articles
-- 1. Helper function is_enrolled_offering_student to verify active class membership matching offering class_id and academic_year
-- 2. Scoped SELECT policy on public.articles for published articles readable by enrolled students and assigned teachers
-- 3. Strictly zero INSERT/UPDATE/DELETE permissions for reader/student role

BEGIN;

-- 1. Helper function to check if caller is an actively enrolled student for a course offering
-- Authoritative caller binding: binds strictly to auth.uid() inside the helper; no arbitrary user parameter
CREATE OR REPLACE FUNCTION public.is_enrolled_offering_student(p_offering_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_memberships cm
    JOIN public.course_offerings co ON co.class_id = cm.class_id AND co.academic_year = cm.academic_year
    JOIN public.classes c ON c.id = co.class_id
    JOIN public.subjects s ON s.id = co.subject_id
    WHERE co.id = p_offering_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND co.is_active = true
      AND c.is_active = true
      AND s.is_active = true
      AND c.academic_year = co.academic_year
  );
$$;

REVOKE ALL ON FUNCTION public.is_enrolled_offering_student(UUID) FROM public;
REVOKE ALL ON FUNCTION public.is_enrolled_offering_student(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled_offering_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_offering_student(UUID) TO service_role;

-- 2. Published articles SELECT policy for enrolled students and active assigned teachers
DROP POLICY IF EXISTS "Enrolled readers and assigned teachers can read published articles" ON public.articles;
CREATE POLICY "Enrolled readers and assigned teachers can read published articles"
ON public.articles
FOR SELECT
TO authenticated
USING (
    status = 'published'
    AND (
        public.is_enrolled_offering_student(offering_id)
        OR public.is_active_offering_teacher(offering_id, auth.uid())
    )
);

COMMIT;
