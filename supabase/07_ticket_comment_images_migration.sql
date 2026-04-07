-- ============================================================
-- ITAM DESK — Add Images to Ticket Comments
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- Añadir soporte para arreglo de imágenes en los comentarios de los tickets
ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
