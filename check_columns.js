import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkDiagnostics() {
  console.log("Checking profiles...");
  const { data: profiles, error: pErr } = await supabaseAdmin.from('profiles').select('*').limit(3);
  console.log("Profiles Err:", pErr);
  console.log("Profiles Data Count:", profiles?.length);

  const supabaseAnon = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  console.log("Checking profiles anon...");
  const { data: anonProfiles, error: aErr } = await supabaseAnon.from('profiles').select('*').limit(3);
  console.log("Anon Err:", aErr);
  console.log("Anon count:", anonProfiles?.length);
  
  console.log("Checking system_settings anon...");
  const { data: set, error: setE } = await supabaseAnon.from('system_settings').select('*');
  console.log("Settings anon:", set, setE);

}

checkDiagnostics().catch(console.error);
