const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bdenezutrprobthfssbq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZW5lenV0cnByb2J0aGZzc2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTgxODUsImV4cCI6MjA4ODgzNDE4NX0.o6Ser9Kpw4vt9uSFd3r9w0-91kuAE12JyjRlESuos_Q'
);

async function test() {
  console.log("Testing upsert...");
  const { data, error } = await supabase.from('system_settings').upsert(
    { setting_key: 'trusted_domains', setting_value: '@prosper-mfg.com,@test.com' },
    { onConflict: 'setting_key' }
  ).select();

  if (error) {
    console.error("Upsert error:", error);
  } else {
    console.log("Upsert success:", data);
  }

  const { data: all } = await supabase.from('system_settings').select('*');
  console.log("All settings:", all);
}

test();
