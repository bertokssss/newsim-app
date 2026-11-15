-- ============================================================================
-- NEWSIM MARITIME TRAINING MANAGEMENT SYSTEM
-- CAPSTONE COMPLETE IMPLEMENTATION MIGRATION
-- Grading (60/40), Practical Retakes, Certificate Claims, Schedules, RBAC
-- ============================================================================

BEGIN;

-- 1. Practical Evaluations: Support Historical Retakes & Multi-Attempts
ALTER TABLE public.practical_evaluations
  ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true;

-- Update unique constraint to allow multiple attempts per trainee and rubric
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_rubric_trainee_evaluation'
  ) THEN
    ALTER TABLE public.practical_evaluations DROP CONSTRAINT uq_rubric_trainee_evaluation;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_rubric_trainee_attempt'
  ) THEN
    ALTER TABLE public.practical_evaluations 
      ADD CONSTRAINT uq_rubric_trainee_attempt UNIQUE (rubric_id, trainee_id, attempt_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_practical_eval_latest ON public.practical_evaluations(trainee_id, rubric_id) WHERE is_latest = true;

-- 2. Certificates: Claim Date, Release Tracking, and Security Hash
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS scheduled_claim_date date,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS verification_hash text;

CREATE INDEX IF NOT EXISTS idx_certificates_claim_status ON public.certificates(status, scheduled_claim_date);

-- 3. Schedules: Completion Confirmation & Extended Status Lifecycle
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS completion_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes text;

-- Update schedules status check constraint if it exists
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN (
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'public.schedules'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%status%'
  ) LOOP
    EXECUTE 'ALTER TABLE public.schedules DROP CONSTRAINT ' || quote_ident(v_conname);
  END LOOP;
END $$;

ALTER TABLE public.schedules
  ADD CONSTRAINT chk_schedules_status 
  CHECK (status IN ('UPCOMING', 'SCHEDULED', 'ONGOING', 'AWAITING_COMPLETION_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'));

-- 4. RBAC: Persistent Database Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role, permission)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);

-- Seed comprehensive least-privilege permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  -- Super Admin: Full system governance & Master controls
  ('SUPER_ADMIN', 'USER_VIEW'),
  ('SUPER_ADMIN', 'USER_CREATE'),
  ('SUPER_ADMIN', 'USER_UPDATE'),
  ('SUPER_ADMIN', 'USER_SUSPEND'),
  ('SUPER_ADMIN', 'USER_ACTIVATE'),
  ('SUPER_ADMIN', 'ROLE_ASSIGN'),
  ('SUPER_ADMIN', 'COURSE_VIEW'),
  ('SUPER_ADMIN', 'COURSE_CREATE'),
  ('SUPER_ADMIN', 'COURSE_UPDATE'),
  ('SUPER_ADMIN', 'COURSE_ARCHIVE'),
  ('SUPER_ADMIN', 'PACKAGE_VIEW'),
  ('SUPER_ADMIN', 'PACKAGE_MANAGE'),
  ('SUPER_ADMIN', 'ENROLLMENT_VIEW'),
  ('SUPER_ADMIN', 'ENROLLMENT_MANAGE'),
  ('SUPER_ADMIN', 'BATCH_VIEW'),
  ('SUPER_ADMIN', 'BATCH_MANAGE'),
  ('SUPER_ADMIN', 'SCHEDULE_VIEW'),
  ('SUPER_ADMIN', 'SCHEDULE_MANAGE'),
  ('SUPER_ADMIN', 'SCHEDULE_COMPLETE'),
  ('SUPER_ADMIN', 'ATTENDANCE_VIEW'),
  ('SUPER_ADMIN', 'ATTENDANCE_RECORD'),
  ('SUPER_ADMIN', 'ATTENDANCE_UPDATE'),
  ('SUPER_ADMIN', 'ASSESSMENT_VIEW'),
  ('SUPER_ADMIN', 'ASSESSMENT_MANAGE'),
  ('SUPER_ADMIN', 'ASSESSMENT_GRADE'),
  ('SUPER_ADMIN', 'GRADE_VIEW'),
  ('SUPER_ADMIN', 'GRADE_FINALIZE'),
  ('SUPER_ADMIN', 'GRADE_OVERRIDE'),
  ('SUPER_ADMIN', 'PAYMENT_VIEW'),
  ('SUPER_ADMIN', 'PAYMENT_VERIFY'),
  ('SUPER_ADMIN', 'PAYMENT_REFUND'),
  ('SUPER_ADMIN', 'CERTIFICATE_VIEW'),
  ('SUPER_ADMIN', 'CERTIFICATE_APPROVE'),
  ('SUPER_ADMIN', 'CERTIFICATE_CLAIM_VERIFY'),
  ('SUPER_ADMIN', 'CERTIFICATE_RELEASE'),
  ('SUPER_ADMIN', 'CERTIFICATE_REVOKE'),
  ('SUPER_ADMIN', 'AUDIT_LOG_VIEW'),
  ('SUPER_ADMIN', 'RBAC_VIEW'),
  ('SUPER_ADMIN', 'RBAC_MANAGE'),
  ('SUPER_ADMIN', 'SYSTEM_SETTINGS_VIEW'),
  ('SUPER_ADMIN', 'SYSTEM_SETTINGS_MANAGE'),

  -- Admin: Academic & Training Operations (Financial restricted unless granted)
  ('ADMIN', 'USER_VIEW'),
  ('ADMIN', 'COURSE_VIEW'),
  ('ADMIN', 'COURSE_CREATE'),
  ('ADMIN', 'COURSE_UPDATE'),
  ('ADMIN', 'PACKAGE_VIEW'),
  ('ADMIN', 'PACKAGE_MANAGE'),
  ('ADMIN', 'ENROLLMENT_VIEW'),
  ('ADMIN', 'ENROLLMENT_MANAGE'),
  ('ADMIN', 'BATCH_VIEW'),
  ('ADMIN', 'BATCH_MANAGE'),
  ('ADMIN', 'SCHEDULE_VIEW'),
  ('ADMIN', 'SCHEDULE_MANAGE'),
  ('ADMIN', 'SCHEDULE_COMPLETE'),
  ('ADMIN', 'ATTENDANCE_VIEW'),
  ('ADMIN', 'ATTENDANCE_RECORD'),
  ('ADMIN', 'ASSESSMENT_VIEW'),
  ('ADMIN', 'GRADE_VIEW'),
  ('ADMIN', 'GRADE_FINALIZE'),
  ('ADMIN', 'CERTIFICATE_VIEW'),
  ('ADMIN', 'CERTIFICATE_APPROVE'),
  ('ADMIN', 'CERTIFICATE_CLAIM_VERIFY'),
  ('ADMIN', 'CERTIFICATE_RELEASE'),
  ('ADMIN', 'AUDIT_LOG_VIEW'),

  -- Instructor: Scoped to assigned classes, grading & attendance
  ('INSTRUCTOR', 'COURSE_VIEW'),
  ('INSTRUCTOR', 'BATCH_VIEW'),
  ('INSTRUCTOR', 'SCHEDULE_VIEW'),
  ('INSTRUCTOR', 'SCHEDULE_COMPLETE'),
  ('INSTRUCTOR', 'ATTENDANCE_VIEW'),
  ('INSTRUCTOR', 'ATTENDANCE_RECORD'),
  ('INSTRUCTOR', 'ASSESSMENT_VIEW'),
  ('INSTRUCTOR', 'ASSESSMENT_GRADE'),
  ('INSTRUCTOR', 'GRADE_VIEW'),
  ('INSTRUCTOR', 'GRADE_FINALIZE'),

  -- Trainee: Scoped to personal training, materials, exams & claims
  ('TRAINEE', 'COURSE_VIEW'),
  ('TRAINEE', 'PACKAGE_VIEW'),
  ('TRAINEE', 'SCHEDULE_VIEW'),
  ('TRAINEE', 'ATTENDANCE_VIEW'),
  ('TRAINEE', 'ASSESSMENT_VIEW'),
  ('TRAINEE', 'GRADE_VIEW'),
  ('TRAINEE', 'PAYMENT_VIEW'),
  ('TRAINEE', 'CERTIFICATE_VIEW')
ON CONFLICT (role, permission) DO NOTHING;

-- 5. Grading Policies: Update STCW Default to Official 60% Practical / 40% Written / 70% Passing
UPDATE public.grading_policies
SET 
  practical_weight = 60,
  module_quiz_weight = 40,
  attendance_weight = 0,
  passing_grade = 70,
  min_attendance_pct = 80,
  practical_competency_required = true,
  name = 'NEWSIM Standard Maritime Grading Policy (60% Practical / 40% Written / 70% Passing)',
  updated_at = now()
WHERE course_id IS NULL AND status = 'ACTIVE';

COMMIT;
