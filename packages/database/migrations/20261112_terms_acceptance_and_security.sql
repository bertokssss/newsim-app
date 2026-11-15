-- ============================================================================
-- NEWSIM MARITIME TRAINING MANAGEMENT SYSTEM
-- Terms & Conditions Acceptance Records & Privacy Compliance Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  acceptance_context text NOT NULL DEFAULT 'REGISTRATION',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_terms_acceptances_user_version UNIQUE (user_id, terms_version)
);

CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user_id
  ON public.terms_acceptances(user_id, accepted_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_version text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own terms acceptances" ON public.terms_acceptances;
CREATE POLICY "Users can view own terms acceptances"
  ON public.terms_acceptances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own terms acceptances" ON public.terms_acceptances;
CREATE POLICY "Users can insert own terms acceptances"
  ON public.terms_acceptances FOR INSERT
  WITH CHECK (auth.uid() = user_id);
