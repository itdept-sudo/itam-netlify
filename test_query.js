import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function test() {
  const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          access_requests!access_requests_user_id_fkey(id)
        `)
        .limit(1);
        
  console.log("Error:", error);
  console.log("Data:", data);
}

test().catch(console.error);
