import { supabase } from '../src/lib/supabase.js';

async function checkRoles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('role');

  if (error) {
    console.error('Error fetching roles:', error);
  } else {
    const roles = [...new Set(data.map(p => p.role))];
    console.log('Current roles in database:', roles);
  }
}

checkRoles();
