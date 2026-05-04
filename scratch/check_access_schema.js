import { supabase } from '../src/lib/supabase.js';

async function checkSchema() {
  const { data, error } = await supabase
    .from('access_requests')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching access_requests:', error);
  } else {
    console.log('Columns in access_requests:', data.length > 0 ? Object.keys(data[0]) : 'No data found');
  }

  const { data: buckets, error: bError } = await supabase.storage.listBuckets();
  if (bError) {
    console.error('Error fetching buckets:', bError);
  } else {
    console.log('Available buckets:', buckets.map(b => b.name));
  }
}

checkSchema();
