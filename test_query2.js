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
          id, full_name, role, card_number,
          access_requests!access_requests_user_id_fkey(id, requested_doors)
        `)
        .limit(10);
        
  console.log("Error:", error);
  console.log("Profiles count:", data?.length);
  if(data) console.log("Sample:", data.slice(0,3));
}

test().catch(console.error);
