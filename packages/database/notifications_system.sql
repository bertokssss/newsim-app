-- ============================================================================
-- NEWSIM Centralized Multi-Portal Notification System Migration
-- ============================================================================

-- 1. Ensure all required notification columns exist on public.notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Ensure check constraint on priority
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_priority_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_priority_check
  CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'));

-- Ensure check constraint on category
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_category_check
  CHECK (category IN (
    'ACCOUNT', 'SECURITY', 'ENROLLMENT', 'PAYMENT', 'BATCH',
    'SCHEDULE', 'ATTENDANCE', 'PROGRESS', 'ASSESSMENT',
    'PRACTICAL', 'CERTIFICATION', 'SYSTEM'
  ));

-- 2. Performance and Deduplication Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON public.notifications (recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (recipient_id, type, entity_id)
  WHERE entity_id IS NOT NULL;

-- 3. Row-Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop previous policies to prevent duplicates
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view center notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role has full access to notifications" ON public.notifications;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (
    recipient_id = auth.uid()
  );

-- Policy: Users can update is_read and read_at on their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (
    recipient_id = auth.uid()
  )
  WITH CHECK (
    recipient_id = auth.uid()
  );

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to notifications"
  ON public.notifications
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 4. Enable Supabase Realtime publication for notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Publication might not exist in non-supabase environments, safely continue
    NULL;
END $$;

NOTIFY pgrst, 'reload schema';
