-- profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'instructor', 'trainee')),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  department TEXT,
  employee_id TEXT,
  phone TEXT,
  permissions TEXT[] DEFAULT '{}',
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_secret TEXT,
  mfa_type TEXT DEFAULT 'APP' CHECK (mfa_type IN ('APP', 'EMAIL')),
  mfa_email_otp TEXT,
  mfa_email_otp_expires_at TIMESTAMPTZ,
  recovery_codes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can update profiles" ON public.profiles;
-- Only super_admin can update any profile
CREATE POLICY "Super admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can insert profiles" ON public.profiles;
-- Only super_admin can insert profiles
CREATE POLICY "Super admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Prevent role escalation" ON public.profiles;
-- Prevent role escalation: no one can set role to super_admin via client
CREATE POLICY "Prevent role escalation"
  ON public.profiles FOR UPDATE
  USING (
    NOT (
      role != 'super_admin'
      AND (SELECT role FROM public.profiles WHERE user_id = auth.uid()) != 'super_admin'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
