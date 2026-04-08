import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMovements() {
  const { data, error } = await supabase.from('movements').select('*').limit(1);
  if (error) {
    console.error("Error fetching movements:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    console.log("No data in movements table to infer columns.");
  }
}

checkMovements().catch(console.error);
