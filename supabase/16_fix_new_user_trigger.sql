-- ============================================================
-- FIX: handle_new_user collision on employee_number
-- ============================================================

-- 1. Limpiar valores vacíos existentes que causan colisión
UPDATE public.profiles 
SET employee_number = NULL 
WHERE employee_number = '';

-- 2. Actualizar el disparador para usar NULL por defecto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- 1. Validar dominio
  IF NEW.email NOT LIKE '%@prosper-mfg.com' THEN
    RAISE EXCEPTION 'Dominio no autorizado para registro.';
  END IF;

  -- 2. Verificar si ya existe un perfil con este correo (pre-registrado por RRHH/Admin)
  SELECT id INTO v_existing_id FROM public.profiles WHERE email = NEW.email;

  IF v_existing_id IS NOT NULL THEN
    -- Si ya existe, vinculamos su cuenta de Auth
    UPDATE public.profiles 
    SET auth_id = NEW.id
    WHERE id = v_existing_id;
  ELSE
    -- Si NO existe, creamos un perfil nuevo
    INSERT INTO public.profiles (id, auth_id, email, full_name, role, avatar_url, employee_number, department)
    VALUES (
      NEW.id,
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
      -- CAMBIO CRÍTICO: No usar COALESCE(..., '') ya que '' colisiona en UNIQUE
      NEW.raw_user_meta_data ->> 'employee_number',
      COALESCE(NEW.raw_user_meta_data ->> 'department', '')
    );
  END IF;
  
  RETURN NEW;
END;
$$;
