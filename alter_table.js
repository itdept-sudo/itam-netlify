import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function alterTable() {
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: "ALTER TABLE public.access_requests ADD COLUMN IF NOT EXISTS it_requirements JSONB DEFAULT '[]'::jsonb;"
  });
  
  // If rpc doesn't exist, we just log it. Since we don't have postgres access via port,
  // maybe we can't alter without the Supabase Dashboard, unless they have the rpc.
  console.log("RPC Error (if any):", error);
}

alterTable().catch(console.error);
