-- ============================================================
-- ITAM DESK — Ticket Images Migration
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- 1. Añadir columna a la tabla de tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- 2. Crear el Bucket de Storage para las fotos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-photos', 'ticket-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Crear Políticas para el nuevo Bucket
-- Permitir a cualquier persona leer las imágenes generadas públicamente
CREATE POLICY "Tickets Photos - Public Read" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'ticket-photos');

-- Permitir a los usuarios logueados subir nuevas fotos
CREATE POLICY "Tickets Photos - Authenticated Upload" 
  ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'ticket-photos');
