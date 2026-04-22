-- ============================================================
-- ITAM DESK — COMPREHENSIVE RLS FIX (Resilient Identity)
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- ─── 1. PROFILES ──────────────────────────────────────────
DROP POLICY IF EXISTS "Profiles: anyone authenticated can read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can update any" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can delete" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins and rrhh can insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: managers can insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own or managers can update all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: managers or owners can update" ON public.profiles;

CREATE POLICY "Profiles: anyone authenticated can read" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Profiles: managers can insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role IN ('admin', 'rrhh'))
    OR NOT EXISTS (SELECT 1 FROM public.profiles)
  );

CREATE POLICY "Profiles: managers or owners can update" ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth_id = auth.uid() OR id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role IN ('admin', 'rrhh'))
  );

CREATE POLICY "Profiles: admins can delete" ON public.profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));


-- ─── 2. ACCESS REQUESTS ──────────────────────────────────
DROP POLICY IF EXISTS "Access Requests: admins and rrhh can read" ON public.access_requests;
DROP POLICY IF EXISTS "Access Requests: admins and rrhh can insert" ON public.access_requests;
DROP POLICY IF EXISTS "Access Requests: admins and rrhh can update" ON public.access_requests;
DROP POLICY IF EXISTS "Access Requests: managers can read" ON public.access_requests;
DROP POLICY IF EXISTS "Access Requests: managers can insert" ON public.access_requests;
DROP POLICY IF EXISTS "Access Requests: managers can update" ON public.access_requests;

CREATE POLICY "Access Requests: managers can read" ON public.access_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role IN ('admin', 'rrhh')));

CREATE POLICY "Access Requests: managers can insert" ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role IN ('admin', 'rrhh')));

CREATE POLICY "Access Requests: managers can update" ON public.access_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role IN ('admin', 'rrhh')));


-- ─── 3. TICKETS ───────────────────────────────────────────
DROP POLICY IF EXISTS "Tickets: admins and owners can read" ON public.tickets;
DROP POLICY IF EXISTS "Tickets: admins and owners can update" ON public.tickets;
DROP POLICY IF EXISTS "Tickets: users can create own" ON public.tickets;
DROP POLICY IF EXISTS "Tickets: users can create" ON public.tickets;
DROP POLICY IF EXISTS "Tickets: managers and owners can read" ON public.tickets;
DROP POLICY IF EXISTS "Tickets: managers and owners can update" ON public.tickets;

CREATE POLICY "Tickets: managers and owners can read" ON public.tickets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin')
    OR user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid() OR id = auth.uid())
  );

CREATE POLICY "Tickets: users can create" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid() OR id = auth.uid()));

CREATE POLICY "Tickets: managers and owners can update" ON public.tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin')
    OR user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid() OR id = auth.uid())
  );


-- ─── 4. ITEMS & INVENTARIO ───────────────────────────────
DROP POLICY IF EXISTS "Items: anyone authenticated can read" ON public.items;
DROP POLICY IF EXISTS "Items: admins can insert" ON public.items;
DROP POLICY IF EXISTS "Items: admins can update" ON public.items;
DROP POLICY IF EXISTS "Items: admins can delete" ON public.items;

CREATE POLICY "Items: anyone authenticated can read" ON public.items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Items: admins can insert" ON public.items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

CREATE POLICY "Items: admins can update" ON public.items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

CREATE POLICY "Items: admins can delete" ON public.items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));


-- ─── 5. BRANDS & MODELS ──────────────────────────────────
DROP POLICY IF EXISTS "Brands: anyone authenticated can read" ON public.brands;
DROP POLICY IF EXISTS "Brands: admins can insert" ON public.brands;
DROP POLICY IF EXISTS "Brands: admins can update" ON public.brands;
DROP POLICY IF EXISTS "Brands: admins can delete" ON public.brands;

CREATE POLICY "Brands: anyone authenticated can read" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Brands: admins can modify" ON public.brands FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Models: anyone authenticated can read" ON public.models;
DROP POLICY IF EXISTS "Models: admins can insert" ON public.models;
DROP POLICY IF EXISTS "Models: admins can update" ON public.models;
DROP POLICY IF EXISTS "Models: admins can delete" ON public.models;

CREATE POLICY "Models: anyone authenticated can read" ON public.models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Models: admins can modify" ON public.models FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));


-- ─── 6. MOVEMENTS & RELATIONS ───────────────────────────
DROP POLICY IF EXISTS "Movements: anyone authenticated can read" ON public.movements;
DROP POLICY IF EXISTS "Movements: admins can insert" ON public.movements;

CREATE POLICY "Movements: anyone authenticated can read" ON public.movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Movements: admins can insert" ON public.movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "Relations: anyone authenticated can read" ON public.asset_relations;
DROP POLICY IF EXISTS "Relations: admins can insert" ON public.asset_relations;
DROP POLICY IF EXISTS "Relations: admins can delete" ON public.asset_relations;

CREATE POLICY "Relations: anyone authenticated can read" ON public.asset_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Relations: admins can modify" ON public.asset_relations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));


-- ─── 7. WMS (Inventario/Ordenes) ─────────────────────────
DROP POLICY IF EXISTS "Inventario: permit select for all authenticated" ON public.inventario;
DROP POLICY IF EXISTS "Inventario: permit all for admins" ON public.inventario;
DROP POLICY IF EXISTS "Ordenes: permit select for all authenticated" ON public.ordenes;
DROP POLICY IF EXISTS "Ordenes: permit all for admins" ON public.ordenes;

CREATE POLICY "Inventario: select for all" ON public.inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inventario: admin modify" ON public.inventario FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

CREATE POLICY "Ordenes: select for all" ON public.ordenes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ordenes: admin modify" ON public.ordenes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));


-- ─── 8. MAINTENANCE & SETTINGS ───────────────────────────
DROP POLICY IF EXISTS "Settings: anyone authenticated can read" ON public.system_settings;
DROP POLICY IF EXISTS "Settings: admins can update" ON public.system_settings;
DROP POLICY IF EXISTS "Settings: admins can insert" ON public.system_settings;

CREATE POLICY "Settings: anyone authenticated can read" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Settings: admins can modify" ON public.system_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "MaintenanceItems: admins can read all" ON public.ticket_maintenance_items;
DROP POLICY IF EXISTS "MaintenanceItems: admins can modify" ON public.ticket_maintenance_items;

CREATE POLICY "MaintenanceItems: admins can modify" ON public.ticket_maintenance_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE (auth_id = auth.uid() OR id = auth.uid()) AND role = 'admin'));
