import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  // Inspect profiles
  const { data: profile } = await supabase.from('profiles').select('*').limit(1).single();
  console.log('Profile columns:', Object.keys(profile || {}));

  // List all tables (using a trick to query information_schema if allowed, or just guessing)
  // Since we are using Supabase JS, we can't easily list tables without RPC.
  // Let's try to check common names
  const tables = ['profiles', 'access_requests', 'tickets', 'items', 'models', 'access_cards'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (!error) {
        console.log(`Table ${table} exists. Columns:`, data.length > 0 ? Object.keys(data[0]) : 'no data');
      } else {
        console.log(`Table ${table} check failed:`, error.message);
      }
    } catch (e) {
      console.log(`Table ${table} catch error`);
    }
  }
}

inspect();
