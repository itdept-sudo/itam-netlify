import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkUser() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'rh@prosper-mfg.com')
    .single();
    
  if (error) console.error('Error:', error.message);
  else console.log('User Profile:', data);
}

checkUser();
