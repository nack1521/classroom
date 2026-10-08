-- Migration 20261005000000_owner_course_setup.sql
-- Slice 014: Bounded Owner Course Setup (Classes, Subjects, and Offering Self-Assignment)

BEGIN;

-- 1. Admin Create Class RPC
CREATE OR REPLACE FUNCTION public.admin_create_class(
    p_name TEXT,
    p_academic_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_trimmed_name TEXT;
    v_trimmed_year TEXT;
    v_class_id UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may create classes';
    END IF;

    v_trimmed_name := trim(COALESCE(p_name, ''));
    v_trimmed_year := trim(COALESCE(p_academic_year, ''));

    IF length(v_trimmed_name) = 0 THEN
        RAISE EXCEPTION 'Class name cannot be blank';
    END IF;

    IF length(v_trimmed_name) > 100 THEN
        RAISE EXCEPTION 'Class name cannot exceed 100 characters';
    END IF;

    IF v_trimmed_year !~ '^[0-9]{4}$' THEN
        RAISE EXCEPTION 'Academic year must be exactly 4 digits';
    END IF;

    INSERT INTO public.classes (name, academic_year, is_active)
    VALUES (v_trimmed_name, v_trimmed_year, true)
    RETURNING id INTO v_class_id;

    RETURN jsonb_build_object(
        'success', true,
        'class', jsonb_build_object(
            'id', v_class_id,
            'name', v_trimmed_name,
            'academic_year', v_trimmed_year,
            'is_active', true
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_class(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.admin_create_class(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_class(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_class(TEXT, TEXT) TO service_role;


-- 2. Admin Create Subject RPC
CREATE OR REPLACE FUNCTION public.admin_create_subject(
    p_code TEXT,
    p_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_trimmed_code TEXT;
    v_trimmed_name TEXT;
    v_subject_id UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may create subjects';
    END IF;

    v_trimmed_code := trim(COALESCE(p_code, ''));
    v_trimmed_name := trim(COALESCE(p_name, ''));

    IF length(v_trimmed_code) = 0 THEN
        RAISE EXCEPTION 'Subject code cannot be blank';
    END IF;

    IF length(v_trimmed_code) > 20 THEN
        RAISE EXCEPTION 'Subject code cannot exceed 20 characters';
    END IF;

    IF length(v_trimmed_name) = 0 THEN
        RAISE EXCEPTION 'Subject name cannot be blank';
    END IF;

    IF length(v_trimmed_name) > 100 THEN
        RAISE EXCEPTION 'Subject name cannot exceed 100 characters';
    END IF;

    BEGIN
        INSERT INTO public.subjects (code, name, is_active)
        VALUES (v_trimmed_code, v_trimmed_name, true)
        RETURNING id INTO v_subject_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Subject code already exists: %', v_trimmed_code;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'subject', jsonb_build_object(
            'id', v_subject_id,
            'code', v_trimmed_code,
            'name', v_trimmed_name,
            'is_active', true
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_subject(TEXT, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.admin_create_subject(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_subject(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_subject(TEXT, TEXT) TO service_role;


-- 3. Owner Create Course Offering with Atomic Self-Assignment RPC
CREATE OR REPLACE FUNCTION public.owner_create_course_offering(
    p_subject_id UUID,
    p_class_id UUID,
    p_term INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_is_teacher BOOLEAN := false;
    v_subject_active BOOLEAN;
    v_class_active BOOLEAN;
    v_academic_year TEXT;
    v_offering_id UUID;
    v_assignment_id UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Dual-role check: caller must possess BOTH 'admin' AND 'teacher' roles
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'teacher'
    ) INTO v_is_teacher;

    IF NOT (v_is_admin AND v_is_teacher) THEN
        RAISE EXCEPTION 'Unauthorized: caller must possess both admin and teacher roles to create an offering with teacher self-assignment';
    END IF;

    -- Validate term (must be 1 or 2 per check constraint)
    IF p_term NOT IN (1, 2) THEN
        RAISE EXCEPTION 'Term must be exactly 1 or 2';
    END IF;

    -- Validate subject exists and is active
    SELECT is_active INTO v_subject_active
    FROM public.subjects
    WHERE id = p_subject_id;

    IF v_subject_active IS NULL OR NOT v_subject_active THEN
        RAISE EXCEPTION 'Subject does not exist or is inactive';
    END IF;

    -- Validate class exists and is active, and fetch academic_year
    SELECT is_active, academic_year INTO v_class_active, v_academic_year
    FROM public.classes
    WHERE id = p_class_id;

    IF v_class_active IS NULL OR NOT v_class_active THEN
        RAISE EXCEPTION 'Class does not exist or is inactive';
    END IF;

    -- Atomic creation of offering and teacher offering assignment in single transaction
    BEGIN
        INSERT INTO public.course_offerings (subject_id, class_id, term, academic_year, is_active)
        VALUES (p_subject_id, p_class_id, p_term, v_academic_year, true)
        RETURNING id INTO v_offering_id;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION 'Course offering already exists for this subject, class, term, and academic year';
    END;

    -- Assign caller (strictly v_caller, no arbitrary or posted actor IDs)
    INSERT INTO public.teacher_offering_assignments (teacher_id, offering_id, assigned_by)
    VALUES (v_caller, v_offering_id, v_caller)
    RETURNING id INTO v_assignment_id;

    RETURN jsonb_build_object(
        'success', true,
        'offering_id', v_offering_id,
        'assignment_id', v_assignment_id,
        'academic_year', v_academic_year,
        'term', p_term
    );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_create_course_offering(UUID, UUID, INT) FROM public;
REVOKE ALL ON FUNCTION public.owner_create_course_offering(UUID, UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_create_course_offering(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_create_course_offering(UUID, UUID, INT) TO service_role;

COMMIT;
