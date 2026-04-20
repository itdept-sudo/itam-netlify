import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testFetchAll() {
  const promises = [
    supabase.from("items").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("tickets").select("*, ticket_comments(count)").order("created_at", { ascending: false }).limit(5), 
    supabase.from("profiles").select("*").order("full_name").limit(5),
    supabase.from("models").select("*").order("name").limit(5),
    supabase.from("asset_relations").select("*").limit(5),
    supabase.from("movements").select("*").order("created_at", { ascending: false }).limit(5),
  ];
  
  const settingsPromise = supabase.from("system_settings").select("*").catch(e => {
      console.log("Settings caught:", e);
      return null;
  });
  promises.push(settingsPromise);

  try {
    const resAll = await Promise.all(promises);
    const [iRes, tRes, uRes, mRes, rRes, mvRes, sysRes] = resAll;
    
    console.log("uRes (Profiles):", !!uRes?.data, "Error:", uRes?.error);
    if (!uRes?.data) console.log("Missing profiles data. Complete uRes:", uRes);
    
    console.log("tRes (Tickets):", !!tRes?.data, "Error:", tRes?.error);
    console.log("sysRes (Settings):", !!sysRes?.data, "Error:", sysRes?.error);

  } catch (err) {
    console.error("Promise.all threw an error!!", err);
  }
}

testFetchAll().catch(console.error);
