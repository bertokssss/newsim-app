-- ============================================================================
-- NEWSIM Security Hardening Migration: RLS, Least-Privilege, Triggers, RPCs
-- Non-destructive, idempotent migration (2026-11-13)
-- ============================================================================

-- 1. Enforce batch capacity <= 24 across check_enrollment_capacity trigger
--    Checks batch-level seats when batch_id IS NOT NULL (supports Batch 2+!)
CREATE OR REPLACE FUNCTION public.check_enrollment_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_capacity INTEGER;
  v_count INTEGER;
  v_effective_cap INTEGER;
BEGIN
  IF (TG_OP = 'INSERT')
     OR (TG_OP = 'UPDATE' AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.course_id IS DISTINCT FROM OLD.course_id
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
     )) THEN
    IF NEW.status IN (
      'PAYMENT_PENDING', 'PENDING', 'PENDING_REVIEW', 'UNDER_REVIEW',
      'QUALIFICATION_CHECK', 'APPROVED', 'ACTIVE', 'ENROLLED', 'ONGOING'
    ) THEN
      IF NEW.batch_id IS NOT NULL THEN
        SELECT COALESCE(capacity, 24) INTO v_capacity
        FROM public.batches
        WHERE id = NEW.batch_id
        FOR UPDATE;

        v_effective_cap := LEAST(GREATEST(COALESCE(v_capacity, 24), 1), 24);

        SELECT COUNT(*) INTO v_count
        FROM public.enrollments
        WHERE batch_id = NEW.batch_id
          AND (TG_OP = 'INSERT' OR id <> NEW.id)
          AND status IN (
            'PAYMENT_PENDING', 'PENDING', 'PENDING_REVIEW', 'UNDER_REVIEW',
            'QUALIFICATION_CHECK', 'APPROVED', 'ACTIVE', 'ENROLLED', 'ONGOING'
          );

        IF (v_count + 1) > v_effective_cap THEN
          RAISE EXCEPTION 'Batch enrollment limit reached: maximum capacity is % trainees.', v_effective_cap;
        END IF;
      ELSE
        SELECT COALESCE(capacity, 24) INTO v_capacity
        FROM public.courses
        WHERE id = NEW.course_id;

        v_effective_cap := LEAST(GREATEST(COALESCE(v_capacity, 24), 1), 24);

        SELECT COUNT(*) INTO v_count
        FROM public.enrollments
        WHERE course_id = NEW.course_id
          AND batch_id IS NULL
          AND (TG_OP = 'INSERT' OR id <> NEW.id)
          AND status IN (
            'PAYMENT_PENDING', 'PENDING', 'PENDING_REVIEW', 'UNDER_REVIEW',
            'QUALIFICATION_CHECK', 'APPROVED', 'ACTIVE', 'ENROLLED', 'ONGOING'
          );

        IF (v_count + 1) > v_effective_cap THEN
          RAISE EXCEPTION 'Course enrollment limit reached: maximum capacity is % trainees.', v_effective_cap;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Harden activate_admin_on_email_confirmation with fixed search_path
CREATE OR REPLACE FUNCTION public.activate_admin_on_email_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET status = 'ACTIVE',
        updated_at = now()
    WHERE id = NEW.id AND status = 'PENDING' AND role IN ('ADMIN', 'INSTRUCTOR');
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Harden enroll_in_batch: advisory per-trainee lock, <=24 cap enforcement, fixed search_path
CREATE OR REPLACE FUNCTION public.enroll_in_batch(
  p_batch_id uuid,
  p_trainee_id uuid,
  p_course_id uuid,
  p_package_id uuid DEFAULT NULL::uuid,
  p_training_center_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_enrollment_id UUID;
  v_batch RECORD;
  v_effective_cap INTEGER;
BEGIN
  -- Serialize concurrent enrollment attempts by the same trainee
  PERFORM pg_advisory_xact_lock(hashtext('enroll_trainee_' || p_trainee_id::text));

  -- Lock the batch row to prevent concurrent overbooking
  SELECT * INTO v_batch
  FROM public.batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  v_effective_cap := LEAST(GREATEST(COALESCE(v_batch.capacity, 24), 1), 24);

  IF v_batch.status NOT IN ('OPEN') THEN
    RAISE EXCEPTION 'Batch is not open for enrollment (current status: %)', v_batch.status;
  END IF;

  IF v_batch.enrolled_count >= v_effective_cap THEN
    RAISE EXCEPTION 'Batch is full (% / %)', v_batch.enrolled_count, v_effective_cap;
  END IF;

  -- Check for duplicate enrollment in this batch
  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE trainee_id = p_trainee_id
      AND batch_id = p_batch_id
      AND status NOT IN ('CANCELLED', 'REJECTED')
  ) THEN
    RAISE EXCEPTION 'Trainee already enrolled in this batch';
  END IF;

  -- Check for ongoing enrollment in ANY course (Strict ONE ONGOING COURSE AT A TIME rule)
  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE trainee_id = p_trainee_id
      AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'PASSED', 'FAILED')
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE trainee_id = p_trainee_id
        AND course_id = p_course_id
        AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'PASSED', 'FAILED')
    ) THEN
      RAISE EXCEPTION 'Trainee already has an active enrollment for this course';
    ELSE
      RAISE EXCEPTION 'Trainee already has an ongoing enrollment for another course. Please complete it before enrolling in a new one.';
    END IF;
  END IF;

  INSERT INTO public.enrollments (
    trainee_id, course_id, batch_id, package_id,
    training_center_id, status, enrolled_at
  ) VALUES (
    p_trainee_id, p_course_id, p_batch_id, p_package_id,
    COALESCE(p_training_center_id, v_batch.training_center_id),
    'PAYMENT_PENDING', now()
  )
  RETURNING id INTO v_enrollment_id;

  UPDATE public.batches
  SET enrolled_count = enrolled_count + 1,
      status = CASE
        WHEN enrolled_count + 1 >= v_effective_cap THEN 'FULL'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_batch_id;

  RETURN v_enrollment_id;
END;
$function$;

-- 4. Harden cancel_batch_enrollment with row locks (idempotent seat decrement)
CREATE OR REPLACE FUNCTION public.cancel_batch_enrollment(
  p_enrollment_id uuid,
  p_new_status text DEFAULT 'CANCELLED'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_enrollment RECORD;
BEGIN
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  IF v_enrollment.batch_id IS NOT NULL
     AND v_enrollment.status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED') THEN
    UPDATE public.batches
    SET enrolled_count = GREATEST(0, enrolled_count - 1),
        status = CASE
          WHEN status = 'FULL' AND GREATEST(0, enrolled_count - 1) < LEAST(GREATEST(capacity, 1), 24) THEN 'OPEN'
          ELSE status
        END,
        updated_at = now()
    WHERE id = v_enrollment.batch_id;
  END IF;

  UPDATE public.enrollments
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_enrollment_id;
END;
$function$;

-- 5. Harden progress_batch_status with fixed search_path
CREATE OR REPLACE FUNCTION public.progress_batch_status(
  p_batch_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_course_id UUID;
  v_next_batch_id UUID;
BEGIN
  SELECT course_id INTO v_course_id
  FROM public.batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  UPDATE public.batches
  SET status = p_new_status, updated_at = now()
  WHERE id = p_batch_id;

  IF p_new_status IN ('IN_PROGRESS', 'FULL', 'CLOSED', 'COMPLETED') THEN
    SELECT id INTO v_next_batch_id
    FROM public.batches
    WHERE course_id = v_course_id
      AND status = 'QUEUED'
      AND enrolled_count < LEAST(GREATEST(capacity, 1), 24)
    ORDER BY queue_order ASC, start_date ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_next_batch_id IS NOT NULL THEN
      UPDATE public.batches
      SET status = 'OPEN', updated_at = now()
      WHERE id = v_next_batch_id;
    END IF;
  END IF;
END;
$function$;

-- 6. Atomic brute-force lockout RPC (concurrency-safe via FOR UPDATE)
-- Preserves existing 5 / 10 / 20 thresholds and cumulative lockout escalation.
CREATE OR REPLACE FUNCTION public.record_failed_login_attempt(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_profile RECORD;
  v_now TIMESTAMPTZ := now();
  v_failed INTEGER;
  v_cumulative INTEGER;
  v_offense INTEGER;
  v_lockout_until TIMESTAMPTZ := NULL;
  v_new_status TEXT;
  v_suspended_at TIMESTAMPTZ;
  v_reason TEXT;
  v_is_permanent BOOLEAN := false;
  v_is_locked BOOLEAN := false;
  v_remaining_sec INTEGER := 0;
BEGIN
  SELECT
    id, status, failed_login_attempts, cumulative_failed_attempts,
    offense_level, lockout_until, suspended_at, suspension_reason, updated_at
  INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'is_locked', false,
      'is_permanent', false
    );
  END IF;

  -- Check if already permanently suspended/locked
  IF UPPER(COALESCE(v_profile.status, '')) = 'LOCKED'
     OR COALESCE(v_profile.offense_level, 0) >= 3
     OR (UPPER(COALESCE(v_profile.status, '')) = 'SUSPENDED' AND v_profile.lockout_until IS NULL) THEN
    RETURN jsonb_build_object(
      'found', true,
      'is_locked', true,
      'is_permanent', true,
      'offense_level', GREATEST(COALESCE(v_profile.offense_level, 3), 3),
      'failed_attempts', COALESCE(v_profile.failed_login_attempts, 20),
      'cumulative_attempts', COALESCE(v_profile.cumulative_failed_attempts, 20),
      'remaining_seconds', 0,
      'status', COALESCE(v_profile.status, 'SUSPENDED')
    );
  END IF;

  -- If currently in an active temporary lockout, keep lock active cleanly
  IF v_profile.lockout_until IS NOT NULL AND v_profile.lockout_until > v_now THEN
    v_remaining_sec := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_profile.lockout_until - v_now)))::INTEGER);
    RETURN jsonb_build_object(
      'found', true,
      'is_locked', true,
      'is_permanent', false,
      'offense_level', COALESCE(v_profile.offense_level, 1),
      'failed_attempts', COALESCE(v_profile.failed_login_attempts, 5),
      'cumulative_attempts', COALESCE(v_profile.cumulative_failed_attempts, 5),
      'remaining_seconds', v_remaining_sec,
      'lockout_until', v_profile.lockout_until,
      'status', COALESCE(v_profile.status, 'ACTIVE')
    );
  END IF;

  v_failed := COALESCE(v_profile.failed_login_attempts, 0);
  v_cumulative := COALESCE(v_profile.cumulative_failed_attempts, 0);
  v_offense := COALESCE(v_profile.offense_level, 0);
  v_new_status := COALESCE(v_profile.status, 'ACTIVE');
  v_suspended_at := v_profile.suspended_at;
  v_reason := v_profile.suspension_reason;

  -- Reset stale pre-lockout failed attempts if last update was >24h ago and not suspended
  IF v_cumulative > 0
     AND v_offense = 0
     AND v_profile.updated_at IS NOT NULL
     AND v_profile.updated_at < (v_now - INTERVAL '24 hours') THEN
    v_failed := 0;
    v_cumulative := 0;
  END IF;

  v_failed := v_failed + 1;
  v_cumulative := v_cumulative + 1;

  IF v_cumulative >= 20 THEN
    -- Tier 3: Permanent Suspension / Lock requiring admin reactivation
    v_offense := 3;
    v_is_permanent := true;
    v_is_locked := true;
    v_lockout_until := NULL;
    v_new_status := 'SUSPENDED';
    v_suspended_at := v_now;
    v_reason := 'MULTIPLE_INCORRECT_LOGIN';
    v_remaining_sec := 0;
  ELSIF v_cumulative >= 10 AND v_offense < 2 THEN
    -- Tier 2: 30-minute temporary suspension
    v_offense := 2;
    v_is_locked := true;
    v_lockout_until := v_now + INTERVAL '30 minutes';
    v_new_status := 'ACTIVE';
    v_suspended_at := v_now;
    v_reason := 'Temporary suspension (30 minutes) after 10 incorrect login attempts';
    v_remaining_sec := 1800;
  ELSIF v_cumulative >= 5 AND v_offense < 1 THEN
    -- Tier 1: 5-minute temporary suspension
    v_offense := 1;
    v_is_locked := true;
    v_lockout_until := v_now + INTERVAL '5 minutes';
    v_new_status := 'ACTIVE';
    v_suspended_at := v_now;
    v_reason := 'Temporary suspension (5 minutes) after 5 incorrect login attempts';
    v_remaining_sec := 300;
  ELSE
    -- Clear expired temporary lockout_until while retaining cumulative escalation
    v_lockout_until := NULL;
  END IF;

  UPDATE public.profiles
  SET failed_login_attempts = v_failed,
      cumulative_failed_attempts = v_cumulative,
      offense_level = v_offense,
      lockout_until = v_lockout_until,
      status = v_new_status,
      suspended_at = v_suspended_at,
      suspension_reason = v_reason,
      updated_at = v_now
  WHERE id = p_profile_id;

  RETURN jsonb_build_object(
    'found', true,
    'is_locked', v_is_locked,
    'is_permanent', v_is_permanent,
    'offense_level', v_offense,
    'failed_attempts', v_failed,
    'cumulative_attempts', v_cumulative,
    'remaining_seconds', v_remaining_sec,
    'lockout_until', v_lockout_until,
    'status', v_new_status
  );
END;
$function$;

-- 7. Remove payment permissions from SUPER_ADMIN (Least Privilege Principle)
DELETE FROM public.role_permissions
WHERE role = 'SUPER_ADMIN'
  AND permission IN ('PAYMENT_VIEW', 'PAYMENT_VERIFY', 'PAYMENT_REFUND');

-- 8. Enable RLS on all previously unprotected tables
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practical_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainee_daily_module_tracking ENABLE ROW LEVEL SECURITY;

-- 9. Replace overly permissive {public} policies
DROP POLICY IF EXISTS "batches_service_all" ON public.batches;
DROP POLICY IF EXISTS "batches_service_role_all" ON public.batches;
CREATE POLICY "batches_service_role_all" ON public.batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "instructor_leaves_all" ON public.instructor_leaves;
DROP POLICY IF EXISTS "instructor_leaves_service_role_all" ON public.instructor_leaves;
CREATE POLICY "instructor_leaves_service_role_all" ON public.instructor_leaves
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "instructor_leaves_own_select" ON public.instructor_leaves;
CREATE POLICY "instructor_leaves_own_select" ON public.instructor_leaves
  FOR SELECT TO authenticated USING (instructor_id = auth.uid());
DROP POLICY IF EXISTS "instructor_leaves_own_insert" ON public.instructor_leaves;
CREATE POLICY "instructor_leaves_own_insert" ON public.instructor_leaves
  FOR INSERT TO authenticated WITH CHECK (instructor_id = auth.uid());

DROP POLICY IF EXISTS "Service role has full access to instructors" ON public.instructors;
DROP POLICY IF EXISTS "instructors_service_role_all" ON public.instructors;
CREATE POLICY "instructors_service_role_all" ON public.instructors
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view instructors" ON public.instructors;
CREATE POLICY "Admins can view instructors" ON public.instructors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND UPPER(p.role) IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "Service role has full access to notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_service_role_all" ON public.notifications;
CREATE POLICY "notifications_service_role_all" ON public.notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. Explicit service_role + least-privilege policies for all tables
-- Helper loop ensures service_role explicit policy on every public base table
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_full_access" ON public.%I', t.table_name);
    EXECUTE format('CREATE POLICY "service_role_full_access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t.table_name);
  END LOOP;
END $$;

-- Scoped authenticated read policies (trainees only see own private data; super admins excluded from payments)
DROP POLICY IF EXISTS "profiles_own_select" ON public.profiles;
CREATE POLICY "profiles_own_select" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "trainees_own_select" ON public.trainees;
CREATE POLICY "trainees_own_select" ON public.trainees
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "enrollments_own_select" ON public.enrollments;
CREATE POLICY "enrollments_own_select" ON public.enrollments
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());

DROP POLICY IF EXISTS "payments_authorized_select" ON public.payments;
CREATE POLICY "payments_authorized_select" ON public.payments
  FOR SELECT TO authenticated
  USING (
    trainee_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.admins a ON a.profile_id = p.id
      WHERE p.id = auth.uid()
        AND UPPER(p.role) = 'ADMIN'
        AND UPPER(COALESCE(a.position, '')) NOT LIKE '%IT SUPPORT%'
        AND UPPER(COALESCE(a.position, '')) NOT LIKE '%IT_SUPPORT%'
        AND (
          'PAYMENT_VIEW' = ANY(COALESCE(a.permissions, ARRAY[]::text[]))
          OR 'PAYMENT_VERIFY' = ANY(COALESCE(a.permissions, ARRAY[]::text[]))
        )
    )
  );

DROP POLICY IF EXISTS "certificates_own_select" ON public.certificates;
CREATE POLICY "certificates_own_select" ON public.certificates
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());

DROP POLICY IF EXISTS "attendance_own_or_instructor_select" ON public.attendance;
CREATE POLICY "attendance_own_or_instructor_select" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    trainee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = attendance.schedule_id
        AND (s.instructor_id = auth.uid() OR s.substitute_instructor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "grades_own_select" ON public.grades;
CREATE POLICY "grades_own_select" ON public.grades
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());

DROP POLICY IF EXISTS "assessment_attempts_own_select" ON public.assessment_attempts;
CREATE POLICY "assessment_attempts_own_select" ON public.assessment_attempts
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());

DROP POLICY IF EXISTS "assessment_answers_own_select" ON public.assessment_answers;
CREATE POLICY "assessment_answers_own_select" ON public.assessment_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_attempts aa
      WHERE aa.id = assessment_answers.attempt_id AND aa.trainee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "trainee_daily_module_tracking_own_select" ON public.trainee_daily_module_tracking;
CREATE POLICY "trainee_daily_module_tracking_own_select" ON public.trainee_daily_module_tracking
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());

DROP POLICY IF EXISTS "practical_evaluations_scoped_select" ON public.practical_evaluations;
CREATE POLICY "practical_evaluations_scoped_select" ON public.practical_evaluations
  FOR SELECT TO authenticated
  USING (trainee_id = auth.uid() OR instructor_id = auth.uid());

DROP POLICY IF EXISTS "practical_evaluation_scores_scoped_select" ON public.practical_evaluation_scores;
CREATE POLICY "practical_evaluation_scores_scoped_select" ON public.practical_evaluation_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.practical_evaluations pe
      WHERE pe.id = practical_evaluation_scores.evaluation_id
        AND (pe.trainee_id = auth.uid() OR pe.instructor_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "attendance_sessions_scoped_select" ON public.attendance_sessions;
CREATE POLICY "attendance_sessions_scoped_select" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND UPPER(p.role) IN ('ADMIN', 'SUPER_ADMIN')
    )
    OR EXISTS (
      SELECT 1 FROM public.course_instructors ci
      WHERE ci.course_id = attendance_sessions.course_id AND ci.instructor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = attendance_sessions.schedule_id
        AND (s.instructor_id = auth.uid() OR s.substitute_instructor_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = attendance_sessions.batch_id AND b.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "grading_policies_authenticated_select" ON public.grading_policies;
CREATE POLICY "grading_policies_authenticated_select" ON public.grading_policies
  FOR SELECT TO authenticated USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "practical_rubrics_authenticated_select" ON public.practical_rubrics;
CREATE POLICY "practical_rubrics_authenticated_select" ON public.practical_rubrics
  FOR SELECT TO authenticated USING (status = 'ACTIVE');

DROP POLICY IF EXISTS "practical_rubric_criteria_authenticated_select" ON public.practical_rubric_criteria;
CREATE POLICY "practical_rubric_criteria_authenticated_select" ON public.practical_rubric_criteria
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.practical_rubrics pr
      WHERE pr.id = practical_rubric_criteria.rubric_id AND pr.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "role_permissions_staff_select" ON public.role_permissions;
CREATE POLICY "role_permissions_staff_select" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "courses_public_read_published" ON public.courses;
CREATE POLICY "courses_public_read_published" ON public.courses
  FOR SELECT TO anon, authenticated USING (status = 'PUBLISHED');

DROP POLICY IF EXISTS "training_centers_public_read" ON public.training_centers;
CREATE POLICY "training_centers_public_read" ON public.training_centers
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "course_modules_authenticated_read" ON public.course_modules;
CREATE POLICY "course_modules_authenticated_read" ON public.course_modules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "learning_materials_enrolled_or_staff_read" ON public.learning_materials;
CREATE POLICY "learning_materials_enrolled_or_staff_read" ON public.learning_materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND UPPER(p.role) IN ('ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.course_modules cm
      JOIN public.enrollments e ON e.course_id = cm.course_id
      WHERE cm.id = learning_materials.module_id
        AND e.trainee_id = auth.uid()
        AND e.status IN ('ACTIVE', 'ENROLLED', 'ONGOING', 'APPROVED', 'COMPLETED')
    )
  );

DROP POLICY IF EXISTS "assessments_staff_or_enrolled_read" ON public.assessments;
CREATE POLICY "assessments_staff_or_enrolled_read" ON public.assessments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND UPPER(p.role) IN ('ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = assessments.course_id
        AND e.trainee_id = auth.uid()
        AND e.status IN ('ACTIVE', 'ENROLLED', 'ONGOING', 'COMPLETED')
    )
  );

-- Restrict assessment_questions & assessment_choices (answer key protection!) to staff only
DROP POLICY IF EXISTS "assessment_questions_staff_select" ON public.assessment_questions;
CREATE POLICY "assessment_questions_staff_select" ON public.assessment_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND UPPER(p.role) IN ('ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR')
    )
  );

DROP POLICY IF EXISTS "assessment_choices_staff_select" ON public.assessment_choices;
CREATE POLICY "assessment_choices_staff_select" ON public.assessment_choices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND UPPER(p.role) IN ('ADMIN', 'SUPER_ADMIN', 'INSTRUCTOR')
    )
  );

DROP POLICY IF EXISTS "schedules_authenticated_read" ON public.schedules;
CREATE POLICY "schedules_authenticated_read" ON public.schedules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "course_instructors_authenticated_read" ON public.course_instructors;
CREATE POLICY "course_instructors_authenticated_read" ON public.course_instructors
  FOR SELECT TO authenticated USING (true);

-- 11. Tighten table SQL privileges & RPC execute grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT SELECT ON public.courses TO anon;
GRANT SELECT ON public.course_packages TO anon;
GRANT SELECT ON public.course_package_items TO anon;
GRANT SELECT ON public.batches TO anon;
GRANT SELECT ON public.training_centers TO anon;
GRANT SELECT ON public.system_settings TO anon;

-- Grant on landing_stats view if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'landing_stats'
  ) THEN
    EXECUTE 'GRANT SELECT ON public.landing_stats TO anon, authenticated';
  END IF;
END $$;

-- Lock sensitive RPCs to service_role only (verified 0 client-side callers)
REVOKE ALL ON FUNCTION public.enroll_in_batch(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_in_batch(uuid, uuid, uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_batch_enrollment(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_batch_enrollment(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.progress_batch_status(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.progress_batch_status(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.record_failed_login_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_login_attempt(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO anon, authenticated, service_role;
