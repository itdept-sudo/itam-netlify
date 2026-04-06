-- ============================================================
-- ITAM DESK — Admin Ticket Creation Policy
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- Add policy to allow admins and rrhh to insert tickets on behalf of any user
CREATE POLICY "Tickets: admins can insert any"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );
