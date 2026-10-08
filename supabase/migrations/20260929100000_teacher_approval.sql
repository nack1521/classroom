-- Migration: 20260929100000_teacher_approval.sql
-- Description: Slice 0C assigned-class teacher review, ID reservation, class membership, and atomic approval
-- Sets up teacher_class_assignments, student_id_reservations, class_memberships, audit logs, and approve_student_application RPC.

-- 1. Create teacher_class_assignments table
CREATE TABLE IF NOT EXISTS public.teacher_class_assignments (
    teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (teacher_id, class_id)
);

CREATE INDEX IF NOT EXISTS teacher_class_assignments_class_id_idx ON public.teacher_class_assignments (class_id);

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_class_assignments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.teacher_class_assignments FROM public;
REVOKE ALL ON TABLE public.teacher_class_assignments FROM anon;
REVOKE ALL ON TABLE public.teacher_class_assignments FROM authenticated;

GRANT SELECT ON TABLE public.teacher_class_assignments TO authenticated;
GRANT ALL ON TABLE public.teacher_class_assignments TO service_role;

DROP POLICY IF EXISTS "Admin can manage teacher class assignments" ON public.teacher_class_assignments;
DROP POLICY IF EXISTS "Admin can view all teacher class assignments" ON public.teacher_class_assignments;
CREATE POLICY "Admin can view all teacher class assignments"
ON public.teacher_class_assignments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Teachers can view own class assignments" ON public.teacher_class_assignments;
CREATE POLICY "Teachers can view own class assignments"
ON public.teacher_class_assignments
FOR SELECT
TO authenticated
USING (
    auth.uid() = teacher_id
);


-- 2. Create student_id_reservations table (lifetime durable reservation)
CREATE TABLE IF NOT EXISTS public.student_id_reservations (
    student_id TEXT PRIMARY KEY CHECK (student_id ~ '^[0-9]{5}$'),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS student_id_reservations_user_id_idx ON public.student_id_reservations (user_id);

ALTER TABLE public.student_id_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_id_reservations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_id_reservations FROM public;
REVOKE ALL ON TABLE public.student_id_reservations FROM anon;
REVOKE ALL ON TABLE public.student_id_reservations FROM authenticated;

GRANT SELECT ON TABLE public.student_id_reservations TO authenticated;
GRANT ALL ON TABLE public.student_id_reservations TO service_role;

DROP POLICY IF EXISTS "Admin can view all student ID reservations" ON public.student_id_reservations;
CREATE POLICY "Admin can view all student ID reservations"
ON public.student_id_reservations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR auth.uid() = user_id
);


-- 3. Create class_memberships table
CREATE TABLE IF NOT EXISTS public.class_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
    student_id TEXT NOT NULL REFERENCES public.student_id_reservations(student_id),
    roll_number INTEGER NOT NULL CHECK (roll_number >= 1 AND roll_number <= 45),
    academic_year TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'inactive')),
    approved_by UUID NOT NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique constraints for active memberships:
-- Unique roll number per class and academic year
CREATE UNIQUE INDEX IF NOT EXISTS class_memberships_active_roll_idx
ON public.class_memberships (class_id, academic_year, roll_number)
WHERE (status = 'active');

-- Unique active membership per student
CREATE UNIQUE INDEX IF NOT EXISTS class_memberships_user_active_idx
ON public.class_memberships (user_id)
WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS class_memberships_class_idx ON public.class_memberships (class_id);
CREATE INDEX IF NOT EXISTS class_memberships_student_id_idx ON public.class_memberships (student_id);

ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.class_memberships FROM public;
REVOKE ALL ON TABLE public.class_memberships FROM anon;
REVOKE ALL ON TABLE public.class_memberships FROM authenticated;

GRANT SELECT ON TABLE public.class_memberships TO authenticated;
GRANT ALL ON TABLE public.class_memberships TO service_role;

DROP POLICY IF EXISTS "Admin can manage class memberships" ON public.class_memberships;
DROP POLICY IF EXISTS "Admins have full access to class_memberships" ON public.class_memberships;
DROP POLICY IF EXISTS "Admins can view all class_memberships" ON public.class_memberships;
CREATE POLICY "Admins can view all class_memberships"
ON public.class_memberships
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

DROP POLICY IF EXISTS "Memberships visible to self, assigned teacher, or admin" ON public.class_memberships;
CREATE POLICY "Memberships visible to self, assigned teacher, or admin"
ON public.class_memberships
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.teacher_class_assignments tca ON tca.teacher_id = ur.user_id
        JOIN public.classes c ON c.id = tca.class_id
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'teacher'
          AND tca.class_id = class_memberships.class_id
          AND c.is_active = true
    )
);


-- 4. Create student_application_audit_logs table
CREATE TABLE IF NOT EXISTS public.student_application_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES public.student_applications(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL CHECK (action IN ('approved', 'corrected', 'transferred', 'rejected')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS audit_logs_application_id_idx ON public.student_application_audit_logs (application_id);

ALTER TABLE public.student_application_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_application_audit_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_application_audit_logs FROM public;
REVOKE ALL ON TABLE public.student_application_audit_logs FROM anon;
REVOKE ALL ON TABLE public.student_application_audit_logs FROM authenticated;

GRANT SELECT ON TABLE public.student_application_audit_logs TO authenticated;
GRANT ALL ON TABLE public.student_application_audit_logs TO service_role;

DROP POLICY IF EXISTS "Audit logs visible to admin only" ON public.student_application_audit_logs;
CREATE POLICY "Audit logs visible to admin only"
ON public.student_application_audit_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);


-- 5. Update RLS policies on student_applications to allow assigned teachers and admin to view pending claims
DROP POLICY IF EXISTS "Applicants can view own application" ON public.student_applications;
DROP POLICY IF EXISTS "Applications visible to applicant, assigned teacher, or admin" ON public.student_applications;

CREATE POLICY "Applications visible to applicant, assigned teacher, or admin"
ON public.student_applications
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.teacher_class_assignments tca ON tca.teacher_id = ur.user_id
        JOIN public.classes c ON c.id = tca.class_id
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'teacher'
          AND tca.class_id = student_applications.class_id
          AND c.is_active = true
    )
);


-- 6. RPC: approve_student_application
CREATE OR REPLACE FUNCTION public.approve_student_application(target_application_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_app public.student_applications%ROWTYPE;
    v_academic_year TEXT;
    v_is_admin BOOLEAN := false;
    v_existing_membership_id UUID;
    v_new_membership_id UUID;
    v_res_owner UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    -- Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    -- Lock application record FOR UPDATE to prevent race conditions
    SELECT * INTO v_app FROM public.student_applications WHERE id = target_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    -- Check if caller is assigned teacher for this application's class
    IF NOT v_is_admin THEN
        -- Verify and lock caller teacher role FOR SHARE
        PERFORM 1 FROM public.user_roles
        WHERE user_id = v_caller AND role = 'teacher'
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Unauthorized: caller is not an authorized teacher for this class or admin';
        END IF;

        -- Verify and lock class assignment FOR SHARE against concurrent revocation (admin_revoke_teacher_from_class)
        PERFORM 1 FROM public.teacher_class_assignments
        WHERE teacher_id = v_caller AND class_id = v_app.class_id
        FOR SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Unauthorized: caller is not an authorized teacher for this class or admin';
        END IF;
    END IF;

    -- Verify class is active and fetch academic_year (locking class record FOR SHARE)
    SELECT academic_year INTO v_academic_year FROM public.classes WHERE id = v_app.class_id AND is_active = true FOR SHARE;
    IF v_academic_year IS NULL THEN
        RAISE EXCEPTION 'Cannot approve application for an inactive or non-existent class';
    END IF;

    -- Status validation:
    IF v_app.status = 'approved' THEN
        SELECT id INTO v_existing_membership_id FROM public.class_memberships
        WHERE user_id = v_app.user_id AND class_id = v_app.class_id AND status = 'active';
        IF v_existing_membership_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'idempotent', true, 'membership_id', v_existing_membership_id);
        ELSE
            RAISE EXCEPTION 'Cannot approve application: claim is already approved or stale';
        END IF;
    ELSIF v_app.status = 'rejected' THEN
        RAISE EXCEPTION 'Cannot approve application: application is rejected';
    ELSIF v_app.status <> 'pending' THEN
        RAISE EXCEPTION 'Cannot approve application: status must be pending (current status: %)', v_app.status;
    END IF;

    -- Check / Reserve student ID in student_id_reservations
    SELECT user_id INTO v_res_owner FROM public.student_id_reservations WHERE student_id = v_app.student_id;
    IF v_res_owner IS NOT NULL THEN
        IF v_res_owner <> v_app.user_id THEN
            RAISE EXCEPTION 'Conflict: student ID is already reserved by another student';
        END IF;
    ELSE
        BEGIN
            INSERT INTO public.student_id_reservations (student_id, user_id, reserved_at)
            VALUES (v_app.student_id, v_app.user_id, timezone('utc'::text, now()));
        EXCEPTION WHEN unique_violation THEN
            RAISE EXCEPTION 'Conflict: student ID is already reserved by another student';
        END;
    END IF;

    -- Check roll collision in destination class & academic year
    IF EXISTS (
        SELECT 1 FROM public.class_memberships
        WHERE class_id = v_app.class_id
          AND academic_year = v_academic_year
          AND roll_number = v_app.roll_number
          AND status = 'active'
          AND user_id <> v_app.user_id
    ) THEN
        RAISE EXCEPTION 'Conflict: roll number % is already occupied in class for academic year %', v_app.roll_number, v_academic_year;
    END IF;

    -- Insert active membership
    BEGIN
        INSERT INTO public.class_memberships (
            user_id, class_id, student_id, roll_number, academic_year, status, approved_by, approved_at
        ) VALUES (
            v_app.user_id, v_app.class_id, v_app.student_id, v_app.roll_number, v_academic_year, 'active', v_caller, timezone('utc'::text, now())
        ) RETURNING id INTO v_new_membership_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Conflict: roll number % is already occupied in class for academic year %', v_app.roll_number, v_academic_year;
    END;

    -- Update student application status
    UPDATE public.student_applications
    SET status = 'approved', updated_at = timezone('utc'::text, now())
    WHERE id = v_app.id;

    -- Write immutable audit log
    INSERT INTO public.student_application_audit_logs (
        application_id, actor_id, action, details, created_at
    ) VALUES (
        v_app.id, v_caller, 'approved', jsonb_build_object(
            'class_id', v_app.class_id,
            'student_id', v_app.student_id,
            'roll_number', v_app.roll_number,
            'academic_year', v_academic_year,
            'membership_id', v_new_membership_id
        ), timezone('utc'::text, now())
    );

    RETURN jsonb_build_object('success', true, 'membership_id', v_new_membership_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.approve_student_application(UUID) FROM public;
REVOKE ALL ON FUNCTION public.approve_student_application(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_student_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_student_application(UUID) TO service_role;
