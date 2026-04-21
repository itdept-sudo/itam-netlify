-- ============================================================
-- ITAM DESK — RLS Policy Fix (Unified User Model)
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- ─── 1. PROFILES ──────────────────────────────────────────
DROP POLICY IF EXISTS "Profiles: anyone authenticated can read" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can update any" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins can delete" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admins and rrhh can insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update own or managers can update all" ON public.profiles;

-- SELECT: Anyone logged in can read all profiles
CREATE POLICY "Profiles: anyone authenticated can read"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- INSERT: Admins and RRHH can create new profiles
CREATE POLICY "Profiles: admins and rrhh can insert"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh'))
    OR NOT EXISTS (SELECT 1 FROM public.profiles) -- allow first user
  );

-- UPDATE: Users can update their own OR Admins/RRHH can update any
CREATE POLICY "Profiles: users can update own or managers can update all"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    auth_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh'))
  );

-- DELETE: Only admins can delete
CREATE POLICY "Profiles: admins can delete"
  ON public.profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));


-- ─── 2. TICKETS ───────────────────────────────────────────
DROP POLICY IF EXISTS "Tickets: admins can read all" ON public.tickets;
CREATE POLICY "Tickets: admins and owners can read"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin')
    OR user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tickets: users can create own" ON public.tickets;
CREATE POLICY "Tickets: users can create own"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Tickets: admins can update any" ON public.tickets;
CREATE POLICY "Tickets: admins and owners can update"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin')
    OR user_id IN (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
  );


-- ─── 3. ITEMS (Inventory) ─────────────────────────────────
DROP POLICY IF EXISTS "Items: admins can insert" ON public.items;
CREATE POLICY "Items: admins can insert"
  ON public.items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Items: admins can update" ON public.items;
CREATE POLICY "Items: admins can update"
  ON public.items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Items: admins can delete" ON public.items;
CREATE POLICY "Items: admins can delete"
  ON public.items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));


-- ─── 4. BRANDS & MODELS ──────────────────────────────────
DROP POLICY IF EXISTS "Brands: admins can insert" ON public.brands;
CREATE POLICY "Brands: admins can insert" ON public.brands FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Brands: admins can update" ON public.brands;
CREATE POLICY "Brands: admins can update" ON public.brands FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Brands: admins can delete" ON public.brands;
CREATE POLICY "Brands: admins can delete" ON public.brands FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Models: admins can insert" ON public.models;
CREATE POLICY "Models: admins can insert" ON public.models FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Models: admins can update" ON public.models;
CREATE POLICY "Models: admins can update" ON public.models FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Models: admins can delete" ON public.models;
CREATE POLICY "Models: admins can delete" ON public.models FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));


-- ─── 5. MOVEMENTS ────────────────────────────────────────
DROP POLICY IF EXISTS "Movements: admins can insert" ON public.movements;
CREATE POLICY "Movements: admins can insert" ON public.movements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));


-- ─── 6. ASSET RELATIONS ─────────────────────────────────
DROP POLICY IF EXISTS "Relations: admins can insert" ON public.asset_relations;
CREATE POLICY "Relations: admins can insert" ON public.asset_relations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Relations: admins can delete" ON public.asset_relations;
CREATE POLICY "Relations: admins can delete" ON public.asset_relations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));


-- ─── 7. ACCESS CONTROL TABLES ────────────────────────────
DROP POLICY IF EXISTS "Production Users: admins and rrhh can read" ON public.production_users;
CREATE POLICY "Production Users: managers can read" ON public.production_users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh')));

DROP POLICY IF EXISTS "Production Users: admins and rrhh can insert" ON public.production_users;
CREATE POLICY "Production Users: managers can insert" ON public.production_users FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh')));

DROP POLICY IF EXISTS "Access Requests: admins and rrhh can read" ON public.access_requests;
CREATE POLICY "Access Requests: managers can read" ON public.access_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh')));

DROP POLICY IF EXISTS "Access Requests: admins and rrhh can insert" ON public.access_requests;
CREATE POLICY "Access Requests: managers can insert" ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh')));

DROP POLICY IF EXISTS "Access Requests: admins and rrhh can update" ON public.access_requests;
CREATE POLICY "Access Requests: managers can update" ON public.access_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'rrhh')));


-- ─── 8. WMS TABLES (Inventario/Ordenes) ──────────────────
DROP POLICY IF EXISTS "Inventario: permit all for admins" ON public.inventario;
CREATE POLICY "Inventario: permit all for admins" ON public.inventario FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Ordenes: permit all for admins" ON public.ordenes;
CREATE POLICY "Ordenes: permit all for admins" ON public.ordenes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE auth_id = auth.uid() AND role = 'admin'));
