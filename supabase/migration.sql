-- ============================================================
-- ITAM DESK — Full Supabase Migration
-- Run this ENTIRE script in the Supabase SQL Editor
-- ============================================================

-- ─── 1. PROFILES TABLE (extends auth.users) ───────────────
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  department TEXT DEFAULT '',
  employee_number TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'rrhh')),
  avatar_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admins can do everything; users can read all profiles and update their own
CREATE POLICY "Profiles: anyone authenticated can read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles: admins can insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR NOT EXISTS (SELECT 1 FROM public.profiles)  -- allow first user
  );

CREATE POLICY "Profiles: admins can update any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Profiles: admins can delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, avatar_url, employee_number, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', SPLIT_PART(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'itdept@prosper-mfg.com' THEN 'admin' ELSE COALESCE(NEW.raw_user_meta_data ->> 'role', 'user') END,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'employee_number', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'department', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── 2. BRANDS ────────────────────────────────────────────
CREATE TABLE public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands: anyone authenticated can read"
  ON public.brands FOR SELECT TO authenticated USING (true);

CREATE POLICY "Brands: admins can insert"
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Brands: admins can update"
  ON public.brands FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Brands: admins can delete"
  ON public.brands FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ─── 3. MODELS ────────────────────────────────────────────
CREATE TABLE public.models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  photo TEXT DEFAULT '',
  specs JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Models: anyone authenticated can read"
  ON public.models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Models: admins can insert"
  ON public.models FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Models: admins can update"
  ON public.models FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Models: admins can delete"
  ON public.models FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ─── 4. ITEMS (Inventory) ─────────────────────────────────
CREATE TABLE public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  serial TEXT UNIQUE NOT NULL,
  model_id UUID REFERENCES public.models(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Disponible' CHECK (status IN ('Disponible','Asignado','Mantenimiento','Baja')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items: anyone authenticated can read"
  ON public.items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Items: admins can insert"
  ON public.items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Items: admins can update"
  ON public.items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Items: admins can delete"
  ON public.items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ─── 5. ASSET RELATIONS ──────────────────────────────────
CREATE TABLE public.asset_relations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'Estación de trabajo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.asset_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Relations: anyone authenticated can read"
  ON public.asset_relations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Relations: admins can insert"
  ON public.asset_relations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Relations: admins can delete"
  ON public.asset_relations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ─── 6. MOVEMENTS (audit trail) ──────────────────────────
CREATE TABLE public.movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movements: anyone authenticated can read"
  ON public.movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Movements: admins can insert"
  ON public.movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ─── 7. TICKETS ───────────────────────────────────────────
CREATE TABLE public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Abierto' CHECK (status IN ('Abierto','Proceso','Cerrado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Users can read their own tickets; admins can read all
CREATE POLICY "Tickets: admins can read all"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR user_id = auth.uid()
  );

-- Users can create their own tickets
CREATE POLICY "Tickets: users can create own"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins can update any; users can update own (only certain fields via app logic)
CREATE POLICY "Tickets: admins can update any"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR user_id = auth.uid()
  );


-- ─── 8. TICKET COMMENTS ──────────────────────────────────
CREATE TABLE public.ticket_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments: can read if can read ticket"
  ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR t.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Comments: authenticated can insert on accessible tickets"
  ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id
      AND (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        OR t.user_id = auth.uid()
      )
    )
  );


-- ─── 9. EMAIL NOTIFICATION ON TICKET STATUS CHANGE ───────
-- This uses Supabase's pg_net extension to call an Edge Function
-- that sends the email. Make sure pg_net is enabled in your project.

-- First, enable pg_net if not already
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that gets called by the trigger
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_project_url TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get the ticket owner's email
    SELECT email, full_name INTO v_user_email, v_user_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF v_user_email IS NOT NULL THEN
      -- Get the Supabase project URL from config (set via vault or hardcode)
      -- This calls a Supabase Edge Function to send the email
      PERFORM extensions.http_post(
        url := current_setting('app.settings.site_url', true) || '/.netlify/functions/send-ticket-email',
        body := json_build_object(
          'to', v_user_email,
          'userName', v_user_name,
          'ticketId', NEW.id,
          'ticketTitle', NEW.title,
          'oldStatus', OLD.status,
          'newStatus', NEW.status
        )::text,
        headers := json_build_object('Content-Type', 'application/json')::jsonb
      );
    END IF;
  END IF;

  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_ticket_status_change
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status_change();


-- ─── 10. INDEXES FOR PERFORMANCE ─────────────────────────
CREATE INDEX idx_items_user_id ON public.items(user_id);
CREATE INDEX idx_items_status ON public.items(status);
CREATE INDEX idx_items_model_id ON public.items(model_id);
CREATE INDEX idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX idx_movements_item_id ON public.movements(item_id);
CREATE INDEX idx_models_brand_id ON public.models(brand_id);
CREATE INDEX idx_asset_relations_parent ON public.asset_relations(parent_id);
CREATE INDEX idx_asset_relations_child ON public.asset_relations(child_id);


-- ─── 11. SEED: Insert your admin brand data ──────────────
-- (Optional) Run after first login with itdept@prosper-mfg.com
-- INSERT INTO public.brands (name) VALUES ('Dell'),('HP'),('Lenovo'),('Apple'),('Samsung'),('LG');
