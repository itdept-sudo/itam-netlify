-- 1. Actualizar el constraint de roles en la tabla profiles (si existe)
-- Nota: Si el constraint es un CHECK, lo actualizamos.
DO $$ 
BEGIN 
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'rrhh', 'user', 'seguridad'));
EXCEPTION 
    WHEN undefined_table THEN NULL; 
END $$;

-- 2. Actualizar políticas de RLS para incluir al rol de seguridad

-- Production Users
DROP POLICY IF EXISTS "Production Users: admins and rrhh can read" ON public.production_users;
CREATE POLICY "Production Users: staff can read"
  ON public.production_users FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'seguridad'))
  );

DROP POLICY IF EXISTS "Production Users: admins and rrhh can insert" ON public.production_users;
CREATE POLICY "Production Users: staff can insert"
  ON public.production_users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'seguridad'))
  );

DROP POLICY IF EXISTS "Production Users: admins and rrhh can update" ON public.production_users;
CREATE POLICY "Production Users: staff can update"
  ON public.production_users FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'seguridad'))
  );

-- Access Requests
DROP POLICY IF EXISTS "Access Requests: admins and rrhh can read" ON public.access_requests;
CREATE POLICY "Access Requests: staff can read"
  ON public.access_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'seguridad'))
  );

DROP POLICY IF EXISTS "Access Requests: admins and rrhh can insert" ON public.access_requests;
CREATE POLICY "Access Requests: staff can insert"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'seguridad'))
  );

DROP POLICY IF EXISTS "Access Requests: admins and rrhh can update" ON public.access_requests;
CREATE POLICY "Access Requests: staff can update"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'seguridad'))
  );
