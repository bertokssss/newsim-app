-- ============================================================================
-- NEWSIM MARITIME TRAINING MANAGEMENT SYSTEM
-- Trainee Daily Module Pacing, Auto-Failure & Practical Qualification Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.trainee_daily_module_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  day_number integer NOT NULL DEFAULT 1,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'AVAILABLE', 'COMPLETED', 'FAILED')),
  email_notified_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_trainee_course_module UNIQUE (trainee_id, course_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_trainee_daily_module_trainee ON public.trainee_daily_module_tracking(trainee_id, course_id);
CREATE INDEX IF NOT EXISTS idx_trainee_daily_module_date ON public.trainee_daily_module_tracking(scheduled_date, status);
