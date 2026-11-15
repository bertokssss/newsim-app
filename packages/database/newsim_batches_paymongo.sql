-- ============================================================================
-- NEWSIM Batch Enrollment & PayMongo Payment Integration Migration
-- Run this migration against the existing Supabase database.
-- ============================================================================

-- ============================================================================
-- 1. FIX EXISTING CHECK CONSTRAINTS ON ENROLLMENTS & PAYMENTS
-- ============================================================================
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check
  CHECK (status IN (
    'PAYMENT_PENDING',
    'PENDING',
    'PENDING_REVIEW',
    'UNDER_REVIEW',
    'QUALIFICATION_CHECK',
    'APPROVED',
    'REJECTED',
    'ACTIVE',
    'ENROLLED',
    'ONGOING',
    'COMPLETED',
    'CANCELLED'
  ));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN (
    'GCASH',
    'MAYA',
    'PAYMONGO',
    'QR_PH',
    'BANK_TRANSFER',
    'CARD',
    'OTHER'
  ));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'PENDING',
    'PROCESSING',
    'PAID',
    'VERIFIED',
    'FAILED',
    'REJECTED',
    'CANCELLED',
    'REFUNDED'
  ));

-- ============================================================================
-- 2. BATCHES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.course_packages(id) ON DELETE SET NULL,
  training_center_id UUID REFERENCES public.training_centers(id),
  batch_code TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  capacity INT NOT NULL DEFAULT 24 CHECK (capacity >= 1 AND capacity <= 50),
  enrolled_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED','FULL','COMPLETED','CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_code ON public.batches(batch_code);
CREATE INDEX IF NOT EXISTS idx_batches_course ON public.batches(course_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_start_date ON public.batches(start_date);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'batches_public_read') THEN
    CREATE POLICY "batches_public_read" ON public.batches FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'batches_service_all') THEN
    CREATE POLICY "batches_service_all" ON public.batches FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 3. ALTER ENROLLMENTS — Add Batch, Package, Review Columns
-- ============================================================================
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id),
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.course_packages(id),
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON public.enrollments(batch_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_package ON public.enrollments(package_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);

-- ============================================================================
-- 4. ALTER PAYMENTS — Add PayMongo Columns
-- ============================================================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paymongo_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS paymongo_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_environment TEXT DEFAULT 'TEST'
    CHECK (payment_environment IN ('TEST', 'LIVE')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN verified_by UUID REFERENCES public.profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_paymongo ON public.payments(paymongo_checkout_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_trainee ON public.payments(trainee_id);

-- ============================================================================
-- 5. RACE-CONDITION-SAFE ENROLLMENT FUNCTION
-- Uses FOR UPDATE row lock on the batch to prevent concurrent overbooking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enroll_in_batch(
  p_batch_id UUID,
  p_trainee_id UUID,
  p_course_id UUID,
  p_package_id UUID DEFAULT NULL,
  p_training_center_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enrollment_id UUID;
  v_batch RECORD;
BEGIN
  -- Lock the batch row to prevent concurrent overbooking
  SELECT * INTO v_batch
  FROM public.batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found';
  END IF;

  IF v_batch.status NOT IN ('OPEN') THEN
    RAISE EXCEPTION 'Batch is not open for enrollment (current status: %)', v_batch.status;
  END IF;

  IF v_batch.enrolled_count >= v_batch.capacity THEN
    RAISE EXCEPTION 'Batch is full (% / %)', v_batch.enrolled_count, v_batch.capacity;
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

  -- Check for duplicate enrollment in ANY course (Strict ONE ONGOING COURSE AT A TIME rule)
  IF EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE trainee_id = p_trainee_id
      AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'PASSED', 'FAILED')
  ) THEN
    -- Distinguish between same course and different course for a better error message
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

  -- Create enrollment record
  INSERT INTO public.enrollments (
    trainee_id, course_id, batch_id, package_id,
    training_center_id, status, enrolled_at
  ) VALUES (
    p_trainee_id, p_course_id, p_batch_id, p_package_id,
    COALESCE(p_training_center_id, v_batch.training_center_id),
    'PAYMENT_PENDING', now()
  )
  RETURNING id INTO v_enrollment_id;

  -- Atomically increment enrolled count and auto-close if full
  UPDATE public.batches
  SET enrolled_count = enrolled_count + 1,
      status = CASE
        WHEN enrolled_count + 1 >= capacity THEN 'FULL'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_batch_id;

  RETURN v_enrollment_id;
END;
$$;

-- ============================================================================
-- 6. FUNCTION: Decrement batch count on enrollment cancellation/rejection
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_batch_enrollment(
  p_enrollment_id UUID,
  p_new_status TEXT DEFAULT 'CANCELLED'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enrollment RECORD;
BEGIN
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE id = p_enrollment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  IF v_enrollment.batch_id IS NOT NULL AND v_enrollment.status NOT IN ('CANCELLED', 'REJECTED') THEN
    UPDATE public.batches
    SET enrolled_count = GREATEST(0, enrolled_count - 1),
        status = CASE
          WHEN status = 'FULL' AND enrolled_count - 1 < capacity THEN 'OPEN'
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
$$;

-- ============================================================================
-- 7. SEED INITIAL BATCHES FOR ACTIVE COURSES (IF NONE EXIST)
-- Generates 2 upcoming batches per course starting next month
-- ============================================================================
DO $$
DECLARE
  c RECORD;
  v_center_id UUID;
  v_batch_num INT;
  v_start DATE;
  v_end DATE;
  v_code TEXT;
BEGIN
  SELECT id INTO v_center_id FROM public.training_centers LIMIT 1;

  FOR c IN SELECT id, code, duration_hours FROM public.courses WHERE status = 'PUBLISHED' LOOP
    FOR v_batch_num IN 1..2 LOOP
      v_start := CURRENT_DATE + ((v_batch_num * 14) || ' days')::INTERVAL;
      v_end := v_start + (CEIL(COALESCE(c.duration_hours, 40) / 8.0)::INT || ' days')::INTERVAL;
      v_code := COALESCE(c.code, 'CRS') || '-B' || TO_CHAR(v_start, 'YYYYMMDD');

      IF NOT EXISTS (SELECT 1 FROM public.batches WHERE batch_code = v_code) THEN
        INSERT INTO public.batches (
          course_id,
          training_center_id,
          batch_code,
          start_date,
          end_date,
          capacity,
          enrolled_count,
          status
        ) VALUES (
          c.id,
          v_center_id,
          v_code,
          v_start,
          v_end,
          24,
          0,
          'OPEN'
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;
