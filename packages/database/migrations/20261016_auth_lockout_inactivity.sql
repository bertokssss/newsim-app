-- Migration: 20261016_auth_lockout_inactivity.sql
-- Add progressive brute-force lockout and inactivity tracking columns to profiles table

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS cumulative_failed_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offense_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Ensure failed_login_attempts and lockout_until exist and have proper defaults
ALTER TABLE profiles 
  ALTER COLUMN failed_login_attempts SET DEFAULT 0;

-- Optional index for faster lockout and email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_lockout_until ON profiles(lockout_until);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
