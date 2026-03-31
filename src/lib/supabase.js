import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

export const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.includes('supabase.co'));

if (!isConfigured) {
  console.error(
    '⚠️ ITAM Desk: Configuration Error!\n' +
    'Missing or invalid: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
    'Current URL value:', supabaseUrl ? (supabaseUrl.includes('supabase.co') ? 'SET' : 'INVALID_FORMAT') : 'EMPTY',
    '\nCurrent KEY value:', supabaseAnonKey ? 'SET' : 'EMPTY'
  );
}

// Create client normally - it will be empty or fail gracefully with our UI check
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder', 
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

export const supabaseAdminClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseServiceRoleKey || supabaseAnonKey || 'placeholder', 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);
