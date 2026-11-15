-- ═══════════════════════════════════════════════════════════════
-- NEWSIM Admin Account Management — Database Setup
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- 1. Fix the status constraint to include 'pending' and 'locked'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'LOCKED'));

-- 2. Ensure role constraint includes all roles (lowercase)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('SUPER-ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE'));

-- 3. Add username and position columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'position') THEN
        ALTER TABLE public.profiles ADD COLUMN position TEXT;
    END IF;
END $$;

-- 4. Auto-activate trigger: pending → active when email is confirmed
CREATE OR REPLACE FUNCTION public.activate_admin_on_email_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if email_confirmed_at was just set (changed from NULL to a timestamp)
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        -- Update the corresponding profile to 'active' if it is currently 'pending'
        UPDATE public.profiles
        SET status = 'ACTIVE'
        WHERE id = NEW.id AND status = 'PENDING' AND role = 'ADMIN';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.activate_admin_on_email_confirmation();
