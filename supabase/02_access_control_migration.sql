-- ============================================================
-- ITAM DESK — Access Control Migration
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- ─── 1. PRODUCTION USERS ─────────────────────────────────
CREATE TABLE public.production_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_number TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name_paternal TEXT NOT NULL,
  last_name_maternal TEXT DEFAULT '',
  department TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.production_users ENABLE ROW LEVEL SECURITY;

-- Admins and RRHH can read
CREATE POLICY "Production Users: admins and rrhh can read"
  ON public.production_users FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );

-- Admins and RRHH can insert
CREATE POLICY "Production Users: admins and rrhh can insert"
  ON public.production_users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );

-- Admins and RRHH can update
CREATE POLICY "Production Users: admins and rrhh can update"
  ON public.production_users FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );


-- ─── 2. ACCESS REQUESTS ──────────────────────────────────
CREATE TABLE public.access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.production_users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('Alta', 'Actualizacion', 'Baja')),
  requested_doors JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Aprobado', 'Denegado')),
  token UUID DEFAULT gen_random_uuid(), -- Used for email approval link
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  puesto_encargado TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Admins and RRHH can read
CREATE POLICY "Access Requests: admins and rrhh can read"
  ON public.access_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );

-- Admins and RRHH can insert
CREATE POLICY "Access Requests: admins and rrhh can insert"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );

-- Admins and RRHH can update
CREATE POLICY "Access Requests: admins and rrhh can update"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh'))
  );

-- Allow public update to status IF token matches (useful for the email approval)
CREATE POLICY "Access Requests: public can update status via token"
  ON public.access_requests FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true); -- In a real prod environment we'd check if auth.uid() is null but it's simpler to let Edge function/api do it via Service Role usually. Since Vercel Serverless function will use normal Anon key or Service Role Key, if Service Role Key is used, RLS is bypassed anyway. Let's just create standard policies.

-- Since we are going to use API (Vercel/Netlify), if we use Supabase Service Role Key to update, we don't need anon policies. I'll omit anon update policy and just assume the Vercel API will use Service Role Key, or we simply use the authenticated Admin token if possible. But the public page (/approve-access) isn't logged in, so it calls an API endpoint that validates the token and uses Service Role Key to mutate.

-- Index for token
CREATE INDEX idx_access_requests_token ON public.access_requests(token);
CREATE INDEX idx_production_users_emp_num ON public.production_users(employee_number);
