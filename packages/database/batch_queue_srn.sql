-- ============================================================================
-- NEWSIM BATCH QUEUE & SEAFARER REGISTRATION (SRN) MIGRATION
-- ============================================================================

-- 1. Add SRN column to trainees table
ALTER TABLE public.trainees
  ADD COLUMN IF NOT EXISTS srn TEXT;

-- If trainee_number exists, populate srn if null
UPDATE public.trainees
SET srn = COALESCE(srn, trainee_number, 'SRN-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 900000) + 100000)::text, 6, '0'))
WHERE srn IS NULL;

-- 2. Add queue_order to batches table
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS queue_order INT DEFAULT 1;

-- 3. Update batches status check constraint to support QUEUED and IN_PROGRESS
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE public.batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('OPEN', 'QUEUED', 'IN_PROGRESS', 'FULL', 'CLOSED', 'COMPLETED', 'CANCELLED'));

-- 4. Create or replace atomic sequential queue enrollment function
CREATE OR REPLACE FUNCTION public.enroll_in_batch(
  p_batch_id UUID,
  p_trainee_id UUID,
  p_course_id UUID,
  p_package_id UUID DEFAULT NULL,
  p_training_center_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_enrollment_id UUID;
  v_batch RECORD;
  v_next_batch RECORD;
  v_active_batch_id UUID := p_batch_id;
  v_new_enrolled_count INT;
BEGIN
  -- If specific batch provided, lock it
  IF v_active_batch_id IS NOT NULL THEN
    SELECT * INTO v_batch
    FROM public.batches
    WHERE id = v_active_batch_id
    FOR UPDATE;
  END IF;

  -- If no specific batch or batch not found, lock current OPEN batch for the course
  IF v_batch.id IS NULL THEN
    SELECT * INTO v_batch
    FROM public.batches
    WHERE course_id = p_course_id AND status = 'OPEN'
    ORDER BY queue_order ASC, start_date ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- If no OPEN batch exists, check for the next QUEUED batch to open
  IF v_batch.id IS NULL THEN
    SELECT * INTO v_next_batch
    FROM public.batches
    WHERE course_id = p_course_id AND status = 'QUEUED'
    ORDER BY queue_order ASC, start_date ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.batches
      SET status = 'OPEN', updated_at = now()
      WHERE id = v_next_batch.id;
      v_batch := v_next_batch;
      v_batch.status := 'OPEN';
    ELSE
      RAISE EXCEPTION 'No active or queued batches currently open for this course.';
    END IF;
  END IF;

  -- If selected batch is FULL, IN_PROGRESS, or CLOSED: auto-cascade to next QUEUED batch
  IF v_batch.status IN ('FULL', 'CLOSED', 'IN_PROGRESS') OR v_batch.enrolled_count >= v_batch.capacity THEN
    -- Mark as full if reached capacity
    IF v_batch.enrolled_count >= v_batch.capacity AND v_batch.status = 'OPEN' THEN
      UPDATE public.batches SET status = 'FULL', updated_at = now() WHERE id = v_batch.id;
    END IF;

    -- Open the succeeding batch in queue
    SELECT * INTO v_next_batch
    FROM public.batches
    WHERE course_id = v_batch.course_id AND status = 'QUEUED'
    ORDER BY queue_order ASC, start_date ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.batches
      SET status = 'OPEN', updated_at = now()
      WHERE id = v_next_batch.id;
      v_batch := v_next_batch;
      v_batch.status := 'OPEN';
    ELSE
      RAISE EXCEPTION 'Current batch is full and no succeeding batches are queued.';
    END IF;
  END IF;

  v_active_batch_id := v_batch.id;

  -- Check for existing active enrollment in ANY course (Strict ONE ONGOING COURSE AT A TIME rule)
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
      RAISE EXCEPTION 'Trainee already has an active enrollment application for this course.';
    ELSE
      RAISE EXCEPTION 'Trainee already has an ongoing enrollment for another course. Please complete it before enrolling in a new one.';
    END IF;
  END IF;

  -- Create enrollment record
  INSERT INTO public.enrollments (
    trainee_id,
    course_id,
    batch_id,
    package_id,
    training_center_id,
    status,
    enrolled_at
  ) VALUES (
    p_trainee_id,
    p_course_id,
    v_active_batch_id,
    p_package_id,
    COALESCE(p_training_center_id, v_batch.training_center_id),
    'PAYMENT_PENDING',
    now()
  )
  RETURNING id INTO v_enrollment_id;

  -- Atomically increment batch capacity
  v_new_enrolled_count := v_batch.enrolled_count + 1;

  IF v_new_enrolled_count >= v_batch.capacity THEN
    -- Batch is now FULL: auto-close and open the next batch in the queue!
    UPDATE public.batches
    SET enrolled_count = v_new_enrolled_count,
        status = 'FULL',
        updated_at = now()
    WHERE id = v_active_batch_id;

    -- Promote the next batch in queue
    UPDATE public.batches
    SET status = 'OPEN',
        updated_at = now()
    WHERE id = (
      SELECT id FROM public.batches
      WHERE course_id = v_batch.course_id
        AND status = 'QUEUED'
      ORDER BY queue_order ASC, start_date ASC
      LIMIT 1
    );
  ELSE
    UPDATE public.batches
    SET enrolled_count = v_new_enrolled_count,
        updated_at = now()
    WHERE id = v_active_batch_id;
  END IF;

  RETURN v_enrollment_id;
END;
$$;

-- 5. Helper function for changing batch status with queue advancement
CREATE OR REPLACE FUNCTION public.progress_batch_status(
  p_batch_id UUID,
  p_new_status TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  SELECT course_id INTO v_course_id FROM public.batches WHERE id = p_batch_id;

  UPDATE public.batches
  SET status = p_new_status, updated_at = now()
  WHERE id = p_batch_id;

  -- When a batch moves to IN_PROGRESS, FULL, CLOSED, or COMPLETED,
  -- automatically open the next QUEUED batch for enrollment!
  IF p_new_status IN ('IN_PROGRESS', 'FULL', 'CLOSED', 'COMPLETED') THEN
    UPDATE public.batches
    SET status = 'OPEN', updated_at = now()
    WHERE id = (
      SELECT id FROM public.batches
      WHERE course_id = v_course_id AND status = 'QUEUED'
      ORDER BY queue_order ASC, start_date ASC
      LIMIT 1
    );
  END IF;
END;
$$;
