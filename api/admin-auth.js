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
      
      if (!email.endsWith("@prosper-mfg.com")) {
        return res.status(400).json({ error: "Dominio no autorizado." });
      }

      // Generate a secure temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";

      // Create Auth User
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authError) throw authError;

      // Update existing profile with the new auth link
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          email,
          role,
          auth_id: authData.user.id // Linked via auth_id to preserve original PK id
        })
        .eq("id", profileId);

      if (profileError) throw profileError;

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
