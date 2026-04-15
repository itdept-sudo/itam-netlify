-- 1. Reparar el disparador para nuevos usuarios
-- Asegura que el id del perfil sea igual al id de Auth para usuarios nuevos sin pre-registro
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
    -- Si NO existe, creamos un perfil nuevo usando el ID de Auth como ID principal
    -- Esto restaura la compatibilidad con el resto de la aplicación
    INSERT INTO public.profiles (id, auth_id, email, full_name, role, avatar_url, employee_number, department)
    VALUES (
      NEW.id, -- El ID del perfil será igual al de Auth
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name', 
        NEW.raw_user_meta_data ->> 'name', 
        SPLIT_PART(NEW.email, '@', 1)
      ),
      -- Forzar admin para el correo maestro de IT
      CASE 
        WHEN NEW.email = 'itdept@prosper-mfg.com' THEN 'admin' 
        ELSE COALESCE(NEW.raw_user_meta_data ->> 'role', 'user') 
      END,
      COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'employee_number', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'department', '')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Limpiar el usuario de prueba actual para que se re-cree correctamente
-- Reemplaza con el email proporcionado si es necesario, pero aquí usamos el indicado
DELETE FROM public.profiles WHERE email = 'test.itamdesk@prosper-mfg.com';
-- Nota: El usuario de Auth permanecerá, al volver a iniciar sesión el trigger lo creará de nuevo bien.
