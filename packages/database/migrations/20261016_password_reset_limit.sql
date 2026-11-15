-- Migration: 24-Hour Password Reset Limit Tracking
-- Adds last_password_reset_at and last_password_reset_request_at to profiles

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_password_reset_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_password_reset_request_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_password_reset_at ON profiles(last_password_reset_at);
