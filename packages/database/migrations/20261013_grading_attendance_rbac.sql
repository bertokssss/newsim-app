-- ============================================================================
-- NEWSIM MARITIME TRAINING MANAGEMENT SYSTEM
-- ENHANCEMENT MIGRATION: Grading, Rubrics, Attendance, RBAC & Financial Privacy
-- ============================================================================

BEGIN;

-- 1. Profiles & Admin Permissions
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS permissions text[] DEFAULT '{}'::text[];

-- Update existing active admin with default permissions (including financial verification if admin)
UPDATE public.admins
SET permissions = ARRAY['ENROLLMENT_MANAGE', 'COURSE_MANAGE', 'SCHEDULE_MANAGE', 'ATTENDANCE_MONITOR', 'CERTIFICATE_MANAGE', 'PAYMENT_VIEW', 'PAYMENT_VERIFY']
WHERE permissions IS NULL OR cardinality(permissions) = 0;

-- 2. Enhanced Attendance Columns & Unique Constraints
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_date date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill attendance session_date and course_id from schedules if available
UPDATE public.attendance a
SET 
  course_id = COALESCE(a.course_id, s.course_id),
  session_date = COALESCE(a.session_date, s.start_at::date, a.check_in_at::date, a.created_at::date)
FROM public.schedules s
WHERE a.schedule_id = s.id AND (a.course_id IS NULL OR a.session_date IS NULL);

-- Backfill batch_id from enrollments if available
UPDATE public.attendance a
SET batch_id = e.batch_id
FROM public.enrollments e
WHERE a.trainee_id = e.trainee_id AND a.course_id = e.course_id AND a.batch_id IS NULL AND e.batch_id IS NOT NULL;

-- Create Attendance Sessions Table (Tracking finalized / open session states)
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.schedules(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FINALIZED')),
  finalized_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at timestamptz,
  unmarked_acknowledged boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_attendance_session UNIQUE (batch_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch ON public.attendance_sessions(batch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course ON public.attendance_sessions(course_id);

-- 3. Course Grading Policies Table
CREATE TABLE IF NOT EXISTS public.grading_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE, -- NULL means default global policy
  name text NOT NULL,
  attendance_weight numeric NOT NULL DEFAULT 10 CHECK (attendance_weight >= 0 AND attendance_weight <= 100),
  practical_weight numeric NOT NULL DEFAULT 50 CHECK (practical_weight >= 0 AND practical_weight <= 100),
  module_quiz_weight numeric NOT NULL DEFAULT 40 CHECK (module_quiz_weight >= 0 AND module_quiz_weight <= 100),
  passing_grade numeric NOT NULL DEFAULT 75 CHECK (passing_grade >= 0 AND passing_grade <= 100),
  min_attendance_pct numeric NOT NULL DEFAULT 80 CHECK (min_attendance_pct >= 0 AND min_attendance_pct <= 100),
  late_credit_pct numeric NOT NULL DEFAULT 75 CHECK (late_credit_pct >= 0 AND late_credit_pct <= 100),
  excused_mode text NOT NULL DEFAULT 'EXCLUDE' CHECK (excused_mode IN ('EXCLUDE', 'FULL_CREDIT', 'NO_CREDIT')),
  practical_competency_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT chk_weights_sum CHECK (attendance_weight + practical_weight + module_quiz_weight = 100)
);

CREATE INDEX IF NOT EXISTS idx_grading_policies_course ON public.grading_policies(course_id);

-- Insert Default Institutional Grading Policy (10% Attendance, 50% Practical, 40% Module Quizzes)
INSERT INTO public.grading_policies (course_id, name, attendance_weight, practical_weight, module_quiz_weight, passing_grade, min_attendance_pct, late_credit_pct, excused_mode, practical_competency_required, status)
SELECT NULL, 'NEWSIM Standard Maritime Grading Policy (STCW Aligned)', 10, 50, 40, 75, 80, 75, 'EXCLUDE', true, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM public.grading_policies WHERE course_id IS NULL AND status = 'ACTIVE');

-- 4. Practical Assessment Rubrics & Criteria
CREATE TABLE IF NOT EXISTS public.practical_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  title text NOT NULL,
  stcw_reference text,
  description text,
  instructions text,
  passing_score numeric NOT NULL DEFAULT 75,
  max_score numeric NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practical_rubrics_course ON public.practical_rubrics(course_id);

CREATE TABLE IF NOT EXISTS public.practical_rubric_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES public.practical_rubrics(id) ON DELETE CASCADE,
  criterion_name text NOT NULL,
  description text,
  competency text,
  performance_indicators text,
  max_points numeric NOT NULL DEFAULT 25,
  weight_pct numeric NOT NULL DEFAULT 25,
  sort_order integer NOT NULL DEFAULT 1,
  is_critical boolean NOT NULL DEFAULT false,
  rating_levels jsonb DEFAULT '[
    {"level": "EXEMPLARY", "points": 25, "description": "Demonstrates masterful proficiency without prompting"},
    {"level": "COMPETENT", "points": 20, "description": "Meets all STCW performance standards safely and effectively"},
    {"level": "DEVELOPING", "points": 15, "description": "Meets basic requirements with minor procedural hesitations"},
    {"level": "UNSATISFACTORY", "points": 0, "description": "Fails to meet minimum safety or watchkeeping standards"}
  ]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON public.practical_rubric_criteria(rubric_id);

-- 5. Practical Evaluations & Evaluation Scores
CREATE TABLE IF NOT EXISTS public.practical_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES public.practical_rubrics(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instructor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_score numeric NOT NULL DEFAULT 0,
  max_possible_score numeric NOT NULL DEFAULT 100,
  percentage numeric NOT NULL DEFAULT 0,
  competency_status text NOT NULL DEFAULT 'NOT_YET_COMPETENT' CHECK (competency_status IN ('COMPETENT', 'NOT_YET_COMPETENT', 'REMEDIATION_REQUIRED')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'FINALIZED')),
  general_feedback text,
  strengths text,
  improvements_required text,
  remediation_plan text,
  evaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  finalized_at timestamptz,
  amendment_count integer NOT NULL DEFAULT 0,
  amendment_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_rubric_trainee_evaluation UNIQUE (rubric_id, trainee_id)
);

CREATE INDEX IF NOT EXISTS idx_practical_eval_trainee ON public.practical_evaluations(trainee_id);
CREATE INDEX IF NOT EXISTS idx_practical_eval_course ON public.practical_evaluations(course_id);
CREATE INDEX IF NOT EXISTS idx_practical_eval_instructor ON public.practical_evaluations(instructor_id);

CREATE TABLE IF NOT EXISTS public.practical_evaluation_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.practical_evaluations(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.practical_rubric_criteria(id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  rating_label text,
  comments text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_evaluation_criterion_score UNIQUE (evaluation_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_scores_eval ON public.practical_evaluation_scores(evaluation_id);

-- 6. Extend Grades Table with Breakdown & Policy References
ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS attendance_score numeric,
  ADD COLUMN IF NOT EXISTS practical_score numeric,
  ADD COLUMN IF NOT EXISTS module_score numeric,
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.grading_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_final boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

-- Ensure Unique constraint on grades for (trainee_id, course_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uq_grades_trainee_course'
  ) THEN
    -- Delete duplicate older grades if any exist before creating unique constraint
    DELETE FROM public.grades g1
    WHERE g1.id NOT IN (
      SELECT DISTINCT ON (trainee_id, course_id) id
      FROM public.grades
      ORDER BY trainee_id, course_id, updated_at DESC
    );
    ALTER TABLE public.grades ADD CONSTRAINT uq_grades_trainee_course UNIQUE (trainee_id, course_id);
  END IF;
END $$;

-- 7. Audit Logs Table Verification
-- Ensure columns exist on audit_logs: actor_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS old_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- 8. Seed Course-Specific Rubrics for Key STCW Courses
-- BT (Basic Training)
DO $$
DECLARE
  v_bt_course_id uuid;
  v_bt_rubric_id uuid;
  v_ersc_course_id uuid;
  v_ersc_rubric_id uuid;
BEGIN
  -- Basic Training (BT)
  SELECT id INTO v_bt_course_id FROM public.courses WHERE code = 'BT' LIMIT 1;
  IF v_bt_course_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.practical_rubrics WHERE course_id = v_bt_course_id) THEN
      INSERT INTO public.practical_rubrics (course_id, title, stcw_reference, description, instructions, passing_score, max_score, status)
      VALUES (
        v_bt_course_id,
        'Basic Training (BT) - Practical Survival & Fire Fighting Evaluation',
        'STCW Section A-VI/1 (Personal Survival Techniques & Fire Prevention)',
        'Comprehensive assessment of practical survival craft boarding, life jacket donning, fire fighting equipment handling, and emergency response.',
        'Evaluate the candidate across all 4 key maritime safety competencies. All critical safety criteria must be satisfied.',
        75,
        100,
        'ACTIVE'
      ) RETURNING id INTO v_bt_rubric_id;

      INSERT INTO public.practical_rubric_criteria (rubric_id, criterion_name, description, competency, performance_indicators, max_points, weight_pct, sort_order, is_critical)
      VALUES 
      (v_bt_rubric_id, 'Personal Survival Techniques (Donning & Immersion)', 'Proper inspection and donning of lifejacket & immersion suit within prescribed 2-minute standard.', 'Survival Craft & Personal Safety', 'Donned within 120s; jumped from height safely; deployed secondary flotation without panic.', 25, 25, 1, true),
      (v_bt_rubric_id, 'Fire Fighting Equipment & SCBA Operation', 'Proper donning of breathing apparatus and handling of fire hose / nozzle in smoke compartment.', 'Basic Fire Fighting', 'Checked cylinder pressure (>200 bar); verified whistle test; low-pressure seal achieved; hose held in team formation.', 25, 25, 2, true),
      (v_bt_rubric_id, 'Elementary First Aid & CPR Application', 'Performance of single-rescuer adult CPR and management of severe external bleeding.', 'Emergency Medical First Response', '30:2 ratio maintained; compression depth 5-6 cm; AED deployed with correct pad placement within 60s.', 25, 25, 3, false),
      (v_bt_rubric_id, 'Personal Safety & Social Responsibilities', 'Understanding shipboard safety signs, muster list duties, and pollution prevention rules.', 'Shipboard Safety & Teamwork', 'Correctly identified muster station; described pollution containment; adhered to closed-loop maritime communications.', 25, 25, 4, false);
    END IF;
  END IF;

  -- ERSC (Engine Room Simulator Course)
  SELECT id INTO v_ersc_course_id FROM public.courses WHERE code = 'ERSC' LIMIT 1;
  IF v_ersc_course_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.practical_rubrics WHERE course_id = v_ersc_course_id) THEN
      INSERT INTO public.practical_rubrics (course_id, title, stcw_reference, description, instructions, passing_score, max_score, status)
      VALUES (
        v_ersc_course_id,
        'Engine Room Simulator (ERSC) - Propulsion & Auxiliary Plant Operations',
        'STCW Section A-III/1 & A-III/2 (Marine Engineering Watchkeeping)',
        'Practical simulation assessment of plant preparation, diesel generator synchronizing, main engine startup sequence, and emergency blackout recovery.',
        'Assess the trainee on engine control console and mimic panels. Trainee must adhere strictly to standard checklist procedures.',
        75,
        100,
        'ACTIVE'
      ) RETURNING id INTO v_ersc_rubric_id;

      INSERT INTO public.practical_rubric_criteria (rubric_id, criterion_name, description, competency, performance_indicators, max_points, weight_pct, sort_order, is_critical)
      VALUES 
      (v_ersc_rubric_id, 'Main Engine Pre-Start & Warming-Up Protocol', 'Systematic verification of lube oil, jacket water preheating, and slow-turning on indicator cocks.', 'Marine Engineering Propulsion', 'Lube oil crosshead pump started; jacket temperature reached 75°C; turning gear disengaged.', 25, 25, 1, true),
      (v_ersc_rubric_id, 'Electrical Power Plant & Synchronizing', 'Paralleling diesel generator with main switchboard via manual synchroscope.', 'Electrical & Control Installations', 'Frequency matched to 60Hz; voltage balanced; circuit breaker closed at 11 o clock position.', 25, 25, 2, true),
      (v_ersc_rubric_id, 'Auxiliary Steam & Fuel Oil Treatment Operation', 'Purifier startup, fuel oil viscosity control, and composite boiler burner automation.', 'Auxiliary Machinery Watchkeeping', 'Purifier operating temperature steady; viscosity maintained at 12-14 cSt; fuel leakage alarms responded to.', 25, 25, 3, false),
      (v_ersc_rubric_id, 'Blackout Response & Emergency Power Restoration', 'Immediate action on main switchboard failure and starting of emergency diesel generator.', 'Emergency Engine Room Response', 'Emergency generator online within 45s; steering gear power restored; sequential restart executed.', 25, 25, 4, true);
    END IF;
  END IF;
END $$;

COMMIT;
