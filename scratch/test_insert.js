import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseKey.startsWith('eyJ')) {
  console.error("❌ ERROR: Parecen faltar las nuevas llaves en tu archivo .env local, o sigues usando las viejas (las que empiezan con eyJ).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log("Iniciando prueba de inserción directa...");
  
  // Generar un ID aleatorio falso para la prueba
  const testId = crypto.randomUUID();
  
  const { error } = await supabase.from('profiles').insert({
    id: testId,
    auth_id: testId,
    email: 'test.fabian@tecma.com',
    full_name: 'Prueba Fabian',
    role: 'user',
    employee_number: null
  });

  if (error) {
    console.error("\n🚨 EL ERROR REAL DETRÁS DEL 'DATABASE ERROR' ES:");
    console.error(error);
  } else {
    console.log("\n✅ INSERCIÓN EXITOSA. La tabla profiles acepta datos correctamente.");
    console.log("Limpiando datos de prueba...");
    await supabase.from('profiles').delete().eq('id', testId);
  }
}

runTest();
