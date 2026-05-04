-- 1. Añadir columna para la URL del formato firmado en la tabla de solicitudes de acceso
ALTER TABLE public.access_requests 
ADD COLUMN IF NOT EXISTS signed_format_url TEXT;

-- 2. Crear el bucket de almacenamiento para formatos firmados (si no existe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signed-access-formats', 'signed-access-formats', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de seguridad para el nuevo bucket
-- Permitir lectura pública de los formatos (ya que el bucket es público)
CREATE POLICY "Signed Formats: public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'signed-access-formats');

-- Permitir a usuarios autenticados (Admin/RRHH) subir archivos
CREATE POLICY "Signed Formats: authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signed-access-formats');

-- Permitir a usuarios autenticados (Admin/RRHH) actualizar/borrar sus subidas
CREATE POLICY "Signed Formats: authenticated update/delete"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'signed-access-formats');
