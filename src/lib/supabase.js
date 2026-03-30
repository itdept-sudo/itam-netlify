import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ ITAM Desk: Missing Supabase env vars!\n' +
    'Expected: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
    'Current URL value:', supabaseUrl ? 'SET' : 'EMPTY',
    'Current KEY value:', supabaseAnonKey ? 'SET' : 'EMPTY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Admin client should use Service Role Key for administrative tasks (like resetting passwords)
export const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
