-- ============================================================
-- ITAM DESK — User Unification & Security Migration
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- 1. Modify PROFILES to support non-auth users and unification
-- We keep id as the primary identifier. If they have auth, id will match auth.users.id.
-- If they don't, it will be a random UUID.

-- 1. Remove the strict link between profiles and auth.users
-- This allows production users to exist in profiles without an auth account.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS card_number TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name_paternal TEXT,
ADD COLUMN IF NOT EXISTS last_name_maternal TEXT;

-- Permitir que el email sea NULL (para personal de producción sin cuenta web)
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- Convertimos vacíos a NULL para que la restricción UNIQUE no falle por múltiples ''
UPDATE public.profiles SET employee_number = NULL WHERE employee_number = '';

-- Asegurar que employee_number sea único (los NULL no cuentan como duplicados)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_employee_number_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_employee_number_key UNIQUE (employee_number);

-- Update role check to include 'produccion'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'user', 'rrhh', 'produccion'));

-- 2. DOMAIN RESTRICTION TRIGGER
CREATE OR REPLACE FUNCTION public.validate_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if email is not null (production users might have null email until elevated)
  IF NEW.email IS NOT NULL AND NEW.email NOT LIKE '%@prosper-mfg.com' THEN
    RAISE EXCEPTION 'Solo se permiten correos con el dominio @prosper-mfg.com';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_email_domain ON public.profiles;
CREATE TRIGGER tr_validate_email_domain
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_email_domain();


-- 3. MIGRATION: production_users -> profiles
-- We'll try to find if a profile already exists with that employee_number
-- (Though in this system they are usually separate now)

INSERT INTO public.profiles (
  id, 
  employee_number, 
  first_name, 
  last_name_paternal, 
  last_name_maternal, 
  full_name, 
  department, 
  card_number, 
  role,
  email -- Can be null for prod users
)
SELECT 
  id, 
  employee_number, 
  first_name, 
  last_name_paternal, 
  last_name_maternal, 
  (first_name || ' ' || last_name_paternal || ' ' || last_name_maternal),
  department, 
  card_number, 
  'produccion',
  NULL
FROM public.production_users
ON CONFLICT (employee_number) DO NOTHING;


-- 4. UPDATE ACCESS REQUESTS REFERENCES
-- We need to point user_id to the profiles table instead of production_users.
-- Since they share the same IDs (we migrated IDs), we just need to change the FK.

ALTER TABLE public.access_requests 
DROP CONSTRAINT IF EXISTS access_requests_user_id_fkey;

ALTER TABLE public.access_requests 
ADD CONSTRAINT access_requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- 5. UPDATE TRIGGER handle_new_user to handle Domain restriction on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Security: Domain Check
  IF NEW.email NOT LIKE '%@prosper-mfg.com' THEN
    RAISE EXCEPTION 'Dominio no autorizado para registro.';
  END IF;

  -- Check if a profile with this email already exists (Pre-registered by Admin/RRHH)
  -- If it exists, update it with the auth ID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
    UPDATE public.profiles 
    SET auth_id = NEW.id
    WHERE email = NEW.email;
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, auth_id, email, full_name, role, avatar_url, employee_number, department)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name', 
      NEW.raw_user_meta_data ->> 'name', 
      SPLIT_PART(NEW.email, '@', 1)
    ),
    CASE 
      WHEN NEW.email = 'itdept@prosper-mfg.com' THEN 'admin' 
      ELSE COALESCE(NEW.raw_user_meta_data ->> 'role', 'user') 
    END,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'employee_number', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'department', '')
  );
  RETURN NEW;
END;
$$;

-- IMPORTANT: The above handle_new_user assumes id = auth.uid(). 
-- If we want to support "pre-registered" users, we must be careful with IDs.
-- For simplicity, if RRHH registers them, they get a random UUID.
-- If they later login, they create a NEW ID.
-- We'll need a way for Admin to "LINK" them or just stick to the platform identity once elevated.
