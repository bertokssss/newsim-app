-- =============================================================================
-- Migration: Restore mfa_secret column on public.profiles & reset MFA for fresh QR setup
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_codes text,
  ADD COLUMN IF NOT EXISTS mfa_type text DEFAULT 'APP';

-- Reset Instructor, Admin, and Super Admin profiles to fresh first-time QR login state
UPDATE public.profiles
SET
  mfa_enabled = false,
  mfa_secret = NULL,
  recovery_codes = NULL,
  last_login_at = NULL,
  failed_login_attempts = 0,
  cumulative_failed_attempts = 0,
  offense_level = 0,
  lockout_until = NULL
WHERE LOWER(role) IN ('super_admin', 'super-admin', 'superadmin', 'admin', 'instructor');

-- Reload PostgREST schema cache so Supabase API immediately recognizes mfa_secret
NOTIFY pgrst, 'reload schema';
