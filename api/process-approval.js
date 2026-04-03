import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with Service Role Key for administrative access
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
    const { token, action } = req.body;
    console.log(`[APPROVAL] Request received: action=${action}, token=${token?.substring(0,8)}...`);

    if (!token || !action) {
      return res.status(400).json({ error: "Faltan parámetros: token o action." });
    }

    // 1. Fetch the request with joins (Now pointing everything to profiles)
    const { data: request, error: fetchErr } = await supabase
      .from("access_requests")
      .select(`
        *,
        user:user_id(*),
        requester:requested_by(full_name, email)
      `)
      .eq("token", token)
      .single();

    if (fetchErr) {
      console.error("[APPROVAL] Fetch error:", fetchErr);
      return res.status(404).json({ error: "No se encontró la solicitud o hubo un problema de base de datos." });
    }

    if (!request) {
      return res.status(404).json({ error: "Solicitud no encontrada." });
    }

    if (request.status !== "Pendiente") {
      return res.status(400).json({ error: `Esta solicitud ya ha sido procesada (${request.status}).` });
    }

    const newStatus = action === "approve" ? "Aprobado" : "Denegado";
    let ticketId = null;

    // 2. If approved, create the IT Ticket
    if (action === "approve") {
      const u = request.user;
      if (!u) {
        console.warn("[APPROVAL] User data missing for request", request.id);
      }

      const doorsStr = request.requested_doors && request.requested_doors.length > 0 
        ? request.requested_doors.join(", ") 
        : "N/A";
        
      const description = `
SOLICITUD DE ACCESO AUTORIZADA (Unificada)
==========================================
Tipo: ${request.request_type}
Empleado: ${u?.full_name || u?.first_name || 'N/A'} ${u?.last_name_paternal || ''} (#${u?.employee_number || 'N/A'})
Departamento: ${u?.department || 'N/A'}
Puesto Encargado: ${request.puesto_encargado || "N/A"}
Puertas: ${doorsStr}

Nota: Este ticket fue generado automáticamente tras la aprobación vía correo electrónico por ${request.requester?.full_name || 'Sistema'}.
      `.trim();

      console.log("[APPROVAL] Creating ticket for user", u?.employee_number);

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          title: `⚙️ IT/Accesos - ${request.request_type}: ${u?.full_name || u?.first_name || 'Nuevo Usuario'}`,
          description,
          user_id: request.requested_by, // Assigned to the original requester (HR)
          status: "Abierto"
        })
        .select("id")
        .single();

      if (ticketError) {
        console.error("[APPROVAL] Ticket insertion error:", ticketError);
        // We throw here to be caught by the general catch block
        throw new Error("Solicitud aprobada, pero falló la creación del Ticket de IT: " + ticketError.message);
      }
      
      ticketId = ticket.id;
      console.log("[APPROVAL] Ticket created successfully:", ticketId);
    }

    // 3. Update the access request status
    const updatePayload = { 
      status: newStatus, 
      updated_at: new Date().toISOString(),
      ticket_id: ticketId 
    };

    const { error: updateError } = await supabase
      .from("access_requests")
      .update(updatePayload)
      .eq("id", request.id);

    if (updateError) {
      console.error("[APPROVAL] Update status error:", updateError);
      throw new Error("Se procesó la acción, pero hubo un error al actualizar el historial: " + updateError.message);
    }

    console.log(`[APPROVAL] Success: ${newStatus}`);
    return res.status(200).json({ 
      success: true, 
      status: newStatus, 
      message: newStatus === "Aprobado" 
        ? "La solicitud ha sido Autorizada y se ha generado un Ticket para el equipo de IT." 
        : "La solicitud ha sido Denegada."
    });

  } catch (err) {
    console.error("[APPROVAL] Critical error:", err);
    return res.status(500).json({ error: err.message });
  }
}
