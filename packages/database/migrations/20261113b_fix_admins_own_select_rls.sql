-- Addendum Migration: Allow authenticated admins to read their own admins record
-- Required so payments_authorized_select (and any RLS policy joining public.admins)
-- evaluates accurately for authorized billing admins without exposing other admins.

DROP POLICY IF EXISTS "admins_own_select" ON public.admins;
CREATE POLICY "admins_own_select" ON public.admins
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());
