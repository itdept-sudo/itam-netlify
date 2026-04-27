import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with Service Role Key for administrative access
// This runs on the server (Vercel), where process.env is secure.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { action, userData, userId, newPassword } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Falta el parámetro 'action'." });
    }

    // 1. Create User
    if (action === "createUser") {
      const { email, password, full_name, role, department, employee_number } = userData;
      
      if (!email || !password || !full_name) {
        return res.status(400).json({ error: "Datos de usuario incompletos." });
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role,
          department,
          employee_number
        }
      });

      if (error) throw error;
      return res.status(200).json({ success: true, user: data.user });
    }

    // 2. Reset Password
    if (action === "resetPassword") {
      if (!userId || !newPassword) {
        return res.status(400).json({ error: "Faltan parámetros: userId o newPassword." });
      }

      const { data, error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) throw error;
      return res.status(200).json({ success: true, message: "Contraseña actualizada exitosamente." });
    }

    // 3. Elevate User (Assign Platform Access)
    if (action === "elevateUser") {
      const { email, role, userId: profileId } = req.body;
      
      // Fetch trusted domains
      let trustedDomains = ["@prosper-mfg.com"];
      try {
        const { data: settingsData } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'trusted_domains').single();
        if (settingsData?.setting_value) {
          trustedDomains = settingsData.setting_value.split(',').map(d => d.trim().toLowerCase());
        }
      } catch (err) {
        console.warn("[ADMIN-AUTH] Could not fetch trusted domains, defaulting to @prosper-mfg.com", err.message);
      }

      if (!trustedDomains.some(d => email.toLowerCase().endsWith(d))) {
        return res.status(400).json({ error: `Dominio no autorizado. Permitidos: ${trustedDomains.join(", ")}` });
      }

      // STEP 1: Set the email on the production profile FIRST
      // This is critical: the handle_new_user trigger searches profiles by email.
      // If we set it now, the trigger will find this profile and do an UPDATE (link auth_id)
      // instead of trying to INSERT a new one (which causes the DB error).
      const { error: preUpdateErr } = await supabase
        .from("profiles")
        .update({ email })
        .eq("id", profileId);

      if (preUpdateErr) {
        console.error("[ADMIN-AUTH] Error pre-setting email on profile:", preUpdateErr);
        throw new Error("No se pudo asignar el correo al perfil: " + preUpdateErr.message);
      }

      console.log(`[ADMIN-AUTH] Email ${email} pre-set on profile ${profileId}`);

      // STEP 2: Create or reuse the Auth account
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
      let authId;

      // Check if the email already exists in auth.users (with pagination)
      const { data: lookupData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      const existingAuth = lookupData?.users?.find(u => u.email === email);

      if (existingAuth) {
        // Reuse the existing auth account
        console.log(`[ADMIN-AUTH] Email ${email} already in Auth, reusing ID: ${existingAuth.id}`);
        const { error: updateErr } = await supabase.auth.admin.updateUserById(existingAuth.id, {
          password: tempPassword,
          email_confirm: true
        });
        if (updateErr) throw updateErr;
        authId = existingAuth.id;
      } else {
        // Create new Auth User — the trigger will find the profile by email and link it
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
        });
        if (authError) throw authError;
        authId = authData.user.id;
      }

      // STEP 3: Ensure profile has auth_id and updated role
      const { error: finalUpdateErr } = await supabase
        .from("profiles")
        .update({
          role,
          auth_id: authId
        })
        .eq("id", profileId);

      if (finalUpdateErr) throw finalUpdateErr;

      console.log(`[ADMIN-AUTH] Elevation complete for ${email}, authId: ${authId}`);
      return res.status(200).json({ success: true, tempPassword });
    }

    // 4. Delete User (Force removal from Auth)
    if (action === "deleteUser") {
      if (!userId) {
        return res.status(400).json({ error: "Falta el ID del usuario." });
      }

      console.log(`[ADMIN-AUTH] Intentando eliminar usuario Auth ID: ${userId}`);
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        console.error("[ADMIN-AUTH] Error al borrar de Auth:", error.message);
        throw error;
      }

      return res.status(200).json({ success: true, message: "Cuenta de autenticación eliminada." });
    }

    return res.status(400).json({ error: "Acción no reconocida." });

  } catch (err) {
    console.error("[ADMIN-AUTH] Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
