-- ============================================================
-- ITAM DESK — Security Fixes (Supabase Linter Recommendations)
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- 1. FIX VIEWS: Change SECURITY DEFINER to SECURITY INVOKER
-- This ensures the views respect the RLS of underlying tables for the querying user.

ALTER VIEW public.wms_low_stock SET (security_invoker = true);
ALTER VIEW public.wms_dashboard_summary SET (security_invoker = true);


-- 2. FIX TABLES: Enable Row Level Security (RLS)
-- These tables were public and had RLS disabled.

ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes ENABLE ROW LEVEL SECURITY;


-- 3. ADD POLICIES: Restore/Define Access Control
-- Basic logic: Authenticated users can read, only Admins can write/edit.

-- Policies for 'inventario'
CREATE POLICY "Inventario: permit select for all authenticated"
ON public.inventario FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Inventario: permit all for admins"
ON public.inventario FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- Policies for 'ordenes'
CREATE POLICY "Ordenes: permit select for all authenticated"
ON public.ordenes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Ordenes: permit all for admins"
ON public.ordenes FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
