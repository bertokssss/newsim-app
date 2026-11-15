-- 1. Create instructor_leaves table
CREATE TABLE IF NOT EXISTS public.instructor_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'VACATION', -- SICK, VACATION, EMERGENCY, OFFICIAL_BUSINESS, OTHER
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_leave_dates CHECK (end_date >= start_date)
);

-- Index for queries by instructor
CREATE INDEX IF NOT EXISTS idx_instructor_leaves_instructor_id ON public.instructor_leaves (instructor_id);

-- Index for status filtering (e.g. pending requests for admin)
CREATE INDEX IF NOT EXISTS idx_instructor_leaves_status ON public.instructor_leaves (status);

-- Composite index for date range lookups on approved leaves
CREATE INDEX IF NOT EXISTS idx_instructor_leaves_dates_approved ON public.instructor_leaves (instructor_id, start_date, end_date) WHERE status = 'APPROVED';

-- 2. Add substitute_instructor_id column to schedules table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'schedules' 
      AND column_name = 'substitute_instructor_id'
  ) THEN
    ALTER TABLE public.schedules ADD COLUMN substitute_instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedules_substitute_instructor_id ON public.schedules (substitute_instructor_id) WHERE substitute_instructor_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.instructor_leaves ENABLE ROW LEVEL SECURITY;

-- Permissive policy for authenticated / service role or public read
DROP POLICY IF EXISTS "instructor_leaves_all" ON public.instructor_leaves;
CREATE POLICY "instructor_leaves_all" ON public.instructor_leaves FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
