const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://bdenezutrprobthfssbq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZW5lenV0cnByb2J0aGZzc2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzI1ODE4NSwiZXhwIjoyMDg4ODM0MTg1fQ.pjS8QJk2AXxS_EyunaQvdX9a4qtyAF1mWvzidCV6mWM'
);

async function check() {
  const { data: profiles, error } = await supabase.from('profiles').select('email, employee_number');
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log(`Total profiles: ${profiles.length}`);
  
  const emails = profiles.map(p => p.email);
  const duplicateEmails = emails.filter((item, index) => emails.indexOf(item) !== index);
  console.log("Duplicate emails:", duplicateEmails);

  const empNos = profiles.map(p => p.employee_number).filter(n => n !== null);
  const duplicateEmpNos = empNos.filter((item, index) => empNos.indexOf(item) !== index);
  console.log("Duplicate employee numbers:", duplicateEmpNos);

  const emptyEmpNos = profiles.filter(p => p.employee_number === '').length;
  console.log(`Profiles with empty string employee_number: ${emptyEmpNos}`);
}

check();
