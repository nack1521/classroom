-- Migration 20260929110000_admin_correction_transfer.sql
-- Slice 0D: Admin-Only Correction and Atomic Class Transfer Functions

-- 1. Admin Assign Teacher to Class RPC
CREATE OR REPLACE FUNCTION public.admin_assign_teacher_to_class(
    target_teacher_id UUID,
    target_class_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may assign teachers to classes';
    END IF;

    -- Prevent self-assignment
    IF target_teacher_id = v_caller THEN
        RAISE EXCEPTION 'Self-assignment is not allowed: administrators cannot assign classes to themselves';
    END IF;

    -- Verify target user has teacher role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = target_teacher_id AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Target user does not have teacher role';
    END IF;

    -- Verify target class exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.classes WHERE id = target_class_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Target class does not exist or is inactive';
    END IF;

    INSERT INTO public.teacher_class_assignments (teacher_id, class_id, assigned_by)
    VALUES (target_teacher_id, target_class_id, v_caller)
    ON CONFLICT (teacher_id, class_id) DO NOTHING;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_assign_teacher_to_class(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION public.admin_assign_teacher_to_class(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_teacher_to_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_teacher_to_class(UUID, UUID) TO service_role;


-- 2. Admin Revoke Teacher from Class RPC
CREATE OR REPLACE FUNCTION public.admin_revoke_teacher_from_class(
    target_teacher_id UUID,
    target_class_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may revoke teacher class assignments';
    END IF;

    DELETE FROM public.teacher_class_assignments
    WHERE teacher_id = target_teacher_id AND class_id = target_class_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_revoke_teacher_from_class(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION public.admin_revoke_teacher_from_class(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_teacher_from_class(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_teacher_from_class(UUID, UUID) TO service_role;


-- 3. Admin Correct Student Application RPC
CREATE OR REPLACE FUNCTION public.admin_correct_student_application(
    target_application_id UUID,
    p_title TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_student_id TEXT DEFAULT NULL,
    p_class_id UUID DEFAULT NULL,
    p_roll_number INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_app public.student_applications%ROWTYPE;
    v_old_state JSONB;
    v_new_state JSONB;
    v_academic_year TEXT;
    v_new_title TEXT;
    v_new_first_name TEXT;
    v_new_last_name TEXT;
    v_new_student_id TEXT;
    v_new_class_id UUID;
    v_new_roll_number INT;
    v_res_owner UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may correct applications';
    END IF;

    -- Lock application row FOR UPDATE
    SELECT * INTO v_app FROM public.student_applications WHERE id = target_application_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    -- Record old state
    v_old_state := jsonb_build_object(
        'title', v_app.title,
        'first_name', v_app.first_name,
        'last_name', v_app.last_name,
        'student_id', v_app.student_id,
        'class_id', v_app.class_id,
        'roll_number', v_app.roll_number,
        'status', v_app.status
    );

    -- Compute new values
    v_new_title := COALESCE(NULLIF(TRIM(p_title), ''), v_app.title);
    v_new_first_name := COALESCE(NULLIF(TRIM(p_first_name), ''), v_app.first_name);
    v_new_last_name := COALESCE(NULLIF(TRIM(p_last_name), ''), v_app.last_name);
    v_new_student_id := COALESCE(NULLIF(TRIM(p_student_id), ''), v_app.student_id);
    v_new_class_id := COALESCE(p_class_id, v_app.class_id);
    v_new_roll_number := COALESCE(p_roll_number, v_app.roll_number);

    -- Validation
    IF v_new_title NOT IN ('นาย', 'นาง', 'นางสาว', 'ด.ช.', 'ด.ญ.') THEN
        RAISE EXCEPTION 'Invalid title. Allowed titles: นาย, นาง, นางสาว, ด.ช., ด.ญ.';
    END IF;

    IF v_new_student_id !~ '^[0-9]{5}$' THEN
        RAISE EXCEPTION 'Invalid student ID: must be exact 5 ASCII digits';
    END IF;

    IF v_new_roll_number < 1 OR v_new_roll_number > 45 THEN
        RAISE EXCEPTION 'Invalid roll number: must be between 1 and 45';
    END IF;

    -- Verify target class is active
    SELECT academic_year INTO v_academic_year FROM public.classes WHERE id = v_new_class_id AND is_active = true;
    IF v_academic_year IS NULL THEN
        RAISE EXCEPTION 'Target class does not exist or is inactive';
    END IF;

    -- If application is already approved, enforce active uniqueness & reservations
    IF v_app.status = 'approved' THEN
        -- Reject class change for approved student: must use class transfer instead
        IF v_new_class_id <> v_app.class_id THEN
            RAISE EXCEPTION 'Cannot change class of an approved student via correction. Use class transfer instead.';
        END IF;

        -- Check / handle student_id change
        IF v_new_student_id <> v_app.student_id THEN
            SELECT user_id INTO v_res_owner FROM public.student_id_reservations WHERE student_id = v_new_student_id;
            IF v_res_owner IS NOT NULL AND v_res_owner <> v_app.user_id THEN
                RAISE EXCEPTION 'Conflict: student ID is already reserved by another student';
            END IF;

            -- Reserve new student ID for this student
            BEGIN
                INSERT INTO public.student_id_reservations (student_id, user_id, reserved_at)
                VALUES (v_new_student_id, v_app.user_id, timezone('utc'::text, now()))
                ON CONFLICT (student_id) DO NOTHING;
            EXCEPTION WHEN unique_violation THEN
                RAISE EXCEPTION 'Conflict: student ID is already reserved by another student';
            END;

            -- Update class_memberships student_id
            UPDATE public.class_memberships
            SET student_id = v_new_student_id
            WHERE user_id = v_app.user_id AND status = 'active';
        END IF;

        -- Check / handle roll_number change within the same class
        IF v_new_roll_number <> v_app.roll_number THEN
            IF EXISTS (
                SELECT 1 FROM public.class_memberships
                WHERE class_id = v_app.class_id
                  AND academic_year = v_academic_year
                  AND roll_number = v_new_roll_number
                  AND status = 'active'
                  AND user_id <> v_app.user_id
            ) THEN
                RAISE EXCEPTION 'Conflict: roll number % is already occupied in class for academic year %', v_new_roll_number, v_academic_year;
            END IF;

            BEGIN
                UPDATE public.class_memberships
                SET roll_number = v_new_roll_number
                WHERE user_id = v_app.user_id AND status = 'active';
            EXCEPTION WHEN unique_violation THEN
                RAISE EXCEPTION 'Conflict: roll number % is already occupied in class for academic year %', v_new_roll_number, v_academic_year;
            END;
        END IF;
    END IF;

    -- Update student_applications record
    UPDATE public.student_applications
    SET title = v_new_title,
        first_name = v_new_first_name,
        last_name = v_new_last_name,
        student_id = v_new_student_id,
        class_id = v_new_class_id,
        roll_number = v_new_roll_number,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_app.id;

    -- Record new state and audit log
    v_new_state := jsonb_build_object(
        'title', v_new_title,
        'first_name', v_new_first_name,
        'last_name', v_new_last_name,
        'student_id', v_new_student_id,
        'class_id', v_new_class_id,
        'roll_number', v_new_roll_number,
        'status', v_app.status
    );

    INSERT INTO public.student_application_audit_logs (
        application_id, actor_id, action, details, created_at
    ) VALUES (
        v_app.id, v_caller, 'corrected', jsonb_build_object(
            'before', v_old_state,
            'after', v_new_state
        ), timezone('utc'::text, now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'application_id', v_app.id,
        'before', v_old_state,
        'after', v_new_state
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_correct_student_application(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_correct_student_application(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_correct_student_application(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_correct_student_application(UUID, TEXT, TEXT, TEXT, TEXT, UUID, INT) TO service_role;


-- 4. Admin Transfer Student Membership RPC
CREATE OR REPLACE FUNCTION public.admin_transfer_student_membership(
    target_membership_id UUID,
    destination_class_id UUID,
    new_roll_number INT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_is_admin BOOLEAN := false;
    v_old_membership public.class_memberships%ROWTYPE;
    v_dest_class public.classes%ROWTYPE;
    v_dest_roll INT;
    v_new_membership_id UUID;
    v_app_id UUID;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: authentication required';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: only administrators may transfer student memberships';
    END IF;

    -- Lock current active membership FOR UPDATE
    SELECT * INTO v_old_membership FROM public.class_memberships
    WHERE id = target_membership_id AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active class membership not found';
    END IF;

    -- Lock destination class FOR SHARE
    SELECT * INTO v_dest_class FROM public.classes
    WHERE id = destination_class_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination class is inactive or not found';
    END IF;

    v_dest_roll := COALESCE(new_roll_number, v_old_membership.roll_number);

    IF v_dest_roll < 1 OR v_dest_roll > 45 THEN
        RAISE EXCEPTION 'Invalid roll number: must be between 1 and 45';
    END IF;

    -- Idempotency check: if destination is already active for this student with same class & roll
    IF v_old_membership.class_id = destination_class_id AND v_old_membership.roll_number = v_dest_roll THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'membership_id', v_old_membership.id
        );
    END IF;

    -- Check roll collision in destination class & academic year
    IF EXISTS (
        SELECT 1 FROM public.class_memberships
        WHERE class_id = destination_class_id
          AND academic_year = v_dest_class.academic_year
          AND roll_number = v_dest_roll
          AND status = 'active'
          AND user_id <> v_old_membership.user_id
    ) THEN
        RAISE EXCEPTION 'Conflict: roll number % is already occupied in destination class for academic year %', v_dest_roll, v_dest_class.academic_year;
    END IF;

    -- 1. Deauthorize old membership by marking it 'transferred'
    UPDATE public.class_memberships
    SET status = 'transferred'
    WHERE id = v_old_membership.id;

    -- 2. Create authoritative new active membership
    BEGIN
        INSERT INTO public.class_memberships (
            user_id, class_id, student_id, roll_number, academic_year, status, approved_by, approved_at
        ) VALUES (
            v_old_membership.user_id,
            destination_class_id,
            v_old_membership.student_id,
            v_dest_roll,
            v_dest_class.academic_year,
            'active',
            v_caller,
            timezone('utc'::text, now())
        ) RETURNING id INTO v_new_membership_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Conflict: roll number % is already occupied in destination class for academic year %', v_dest_roll, v_dest_class.academic_year;
    END;

    -- 3. Update student application record to reflect current class and roll
    UPDATE public.student_applications
    SET class_id = destination_class_id,
        roll_number = v_dest_roll,
        updated_at = timezone('utc'::text, now())
    WHERE user_id = v_old_membership.user_id
    RETURNING id INTO v_app_id;

    -- 4. Record audit log
    IF v_app_id IS NOT NULL THEN
        INSERT INTO public.student_application_audit_logs (
            application_id, actor_id, action, details, created_at
        ) VALUES (
            v_app_id, v_caller, 'transferred', jsonb_build_object(
                'from_class_id', v_old_membership.class_id,
                'to_class_id', destination_class_id,
                'old_membership_id', v_old_membership.id,
                'new_membership_id', v_new_membership_id,
                'from_roll_number', v_old_membership.roll_number,
                'to_roll_number', v_dest_roll,
                'academic_year', v_dest_class.academic_year
            ), timezone('utc'::text, now())
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'old_membership_id', v_old_membership.id,
        'new_membership_id', v_new_membership_id,
        'destination_class_id', destination_class_id,
        'roll_number', v_dest_roll
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_transfer_student_membership(UUID, UUID, INT) FROM public;
REVOKE ALL ON FUNCTION public.admin_transfer_student_membership(UUID, UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_transfer_student_membership(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transfer_student_membership(UUID, UUID, INT) TO service_role;
