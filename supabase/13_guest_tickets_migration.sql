-- ============================================================
-- ITAM DESK — Guest Tickets Migration (WITH IP RESTRICTION)
-- ============================================================

-- 1. Añadir columna identificadora a tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE;

-- 2. Política para permitir que usuarios sin sesión suban fotos de evidencia
DROP POLICY IF EXISTS "Tickets Photos - Anon Upload" ON storage.objects;
CREATE POLICY "Tickets Photos - Anon Upload" 
  ON storage.objects FOR INSERT TO anon 
  WITH CHECK (bucket_id = 'ticket-photos');

-- 3. Función RPC para verificar si el empleado puede crear ticket en modo visitante
CREATE OR REPLACE FUNCTION public.check_guest_status(p_emp_no text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user public.profiles%ROWTYPE;
  v_client_ip text;
  v_allowed_ip text := '187.249.0.68';
BEGIN
  -- Validar IP On-site
  v_client_ip := COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
  IF v_client_ip NOT LIKE '%' || v_allowed_ip || '%' THEN
    RETURN jsonb_build_object('status', 'forbidden', 'message', 'Acceso denegado: Fuera de la red autorizada');
  END IF;

  SELECT * INTO v_user FROM public.profiles WHERE employee_number = p_emp_no LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;
  
  -- Si no es producción o ya tiene auth_id (cuenta web vinculada)
  IF v_user.role != 'produccion' OR v_user.auth_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'has_web_access', 'name', v_user.full_name);
  END IF;

  RETURN jsonb_build_object('status', 'valid_guest', 'name', v_user.full_name);
END;
$$;

-- 4. Función RPC para crear el ticket sin necesidad de cuenta web
CREATE OR REPLACE FUNCTION public.create_guest_ticket(p_emp_no text, p_title text, p_desc text, p_images jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user public.profiles%ROWTYPE;
  v_ticket_row public.tickets%ROWTYPE;
  v_ticket_id uuid;
  v_client_ip text;
  v_allowed_ip text := '187.249.0.68';
BEGIN
  -- Validar IP On-site
  v_client_ip := COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
  IF v_client_ip NOT LIKE '%' || v_allowed_ip || '%' THEN
    RAISE EXCEPTION 'Acceso denegado: Fuera de la red autorizada';
  END IF;

  -- Re-validar por seguridad
  SELECT * INTO v_user FROM public.profiles WHERE employee_number = p_emp_no LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Número de empleado no encontrado';
  END IF;

  IF v_user.role != 'produccion' OR v_user.auth_id IS NOT NULL THEN
    RAISE EXCEPTION 'El usuario tiene acceso web, debe iniciar sesión formalmente';
  END IF;

  -- Insertar el ticket de visitante
  INSERT INTO public.tickets (title, description, user_id, status, is_guest, images)
  VALUES (p_title, p_desc, v_user.id, 'Abierto', true, COALESCE(p_images, '[]'::jsonb))
  RETURNING * INTO v_ticket_row;

  RETURN jsonb_build_object(
    'success', true, 
    'ticket_id', v_ticket_row.id,
    'ticket_number', v_ticket_row.ticket_number,
    'requester_name', v_user.full_name,
    'title', v_ticket_row.title
  );
END;
$$;
