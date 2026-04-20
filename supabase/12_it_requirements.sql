-- 1. Agrega la columna opcional `it_requirements` a la tabla `access_requests`
ALTER TABLE public.access_requests 
ADD COLUMN IF NOT EXISTS it_requirements JSONB DEFAULT '[]'::jsonb;
