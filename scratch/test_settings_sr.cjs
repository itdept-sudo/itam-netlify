const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bdenezutrprobthfssbq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZW5lenV0cnByb2J0aGZzc2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1ODE4NSwiZXhwIjoyMDg4ODM0MTg1fQ.pjS8QJk2AXxS_EyunaQvdX9a4qtyAF1mWvzidCV6mWM'
);

async function test() {
  const { data: all, error } = await supabase.from('system_settings').select('*');
  if (error) console.error("Select error:", error);
  console.log("All settings (Service Role):", all);
}

test();
