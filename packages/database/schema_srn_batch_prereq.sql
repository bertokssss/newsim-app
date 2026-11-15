-- ============================================================================
-- NEWSIM SRN, Batch Scheduling, and Prerequisites Migration
-- ============================================================================

-- 1. Ensure srn in trainees is nullable and has a unique index for non-null values
ALTER TABLE public.trainees
  ADD COLUMN IF NOT EXISTS srn TEXT;

-- Remove any NOT NULL constraint on srn
ALTER TABLE public.trainees
  ALTER COLUMN srn DROP NOT NULL;

-- Unique partial index for srn on trainees (only enforces uniqueness when non-null)
DROP INDEX IF EXISTS idx_trainees_srn_unique;
CREATE UNIQUE INDEX idx_trainees_srn_unique ON public.trainees(srn) WHERE srn IS NOT NULL AND srn != '';

-- Add srn to profiles if helpful for direct queries
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS srn TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN srn DROP NOT NULL;

DROP INDEX IF EXISTS idx_profiles_srn_unique;
CREATE UNIQUE INDEX idx_profiles_srn_unique ON public.profiles(srn) WHERE srn IS NOT NULL AND srn != '';

-- 2. Add instructor, times, and scheduling columns to batches table
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES public.instructors(profile_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time TEXT;

-- Ensure batch capacity cannot exceed 24 per NEWSIM business rules
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_capacity_check;
ALTER TABLE public.batches ADD CONSTRAINT batches_capacity_check
  CHECK (capacity >= 1 AND capacity <= 24);

-- 3. Add prerequisites column to courses table
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS prerequisites TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prerequisite_course_ids UUID[] DEFAULT '{}';

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
