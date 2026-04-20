-- ============================================================
-- MIGRATION: 11_maintenance_module.sql
-- Descripción: Agrega soporte para mantenimientos programados, tipos de ticket y checklist.
-- ============================================================

-- 1. Configuraciones del Sistema (Globales)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuración por defecto de 30 días para mantenimiento
INSERT INTO public.system_settings (setting_key, setting_value) 
VALUES ('maintenance_interval_days', '30'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settings: anyone authenticated can read"
  ON public.system_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Settings: admins can update"
  ON public.system_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Settings: admins can insert"
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Modificaciones a tabla de Equipos (items)
ALTER TABLE public.items 
ADD COLUMN IF NOT EXISTS last_maintenance_date TIMESTAMPTZ DEFAULT NOW();

-- 3. Modificaciones a la tabla de Tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'support' CHECK (ticket_type IN ('support', 'maintenance'));

-- 4. Nueva tabla de Checklist de Mantenimiento ligada al ticket
CREATE TABLE IF NOT EXISTS public.ticket_maintenance_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Para evitar que un mismo equipo aparezca dos veces en el mismo checklist del ticket
  UNIQUE(ticket_id, item_id)
);

ALTER TABLE public.ticket_maintenance_items ENABLE ROW LEVEL SECURITY;

-- Políticas del Checklist
CREATE POLICY "MaintenanceItems: admins can read all"
  ON public.ticket_maintenance_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "MaintenanceItems: admins can modify"
  ON public.ticket_maintenance_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Activar Realtime para las nuevas tablas
BEGIN;
  -- Intentar activar si no existen ya en la publicación
  DO $$
  BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'system_settings') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ticket_maintenance_items') THEN
          ALTER PUBLICATION supabase_realtime ADD TABLE ticket_maintenance_items;
      END IF;
  END
  $$;
COMMIT;
