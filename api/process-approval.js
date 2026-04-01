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

    if (!token || !action) {
      return res.status(400).json({ error: "Faltan parámetros: token o action." });
    }

    if (action !== "approve" && action !== "deny") {
      return res.status(400).json({ error: "Acción inválida. Debe ser 'approve' o 'deny'." });
    }

    // 1. Fetch the request
    const { data: request, error: fetchErr } = await supabase
      .from("access_requests")
      .select(`
        *,
        user:production_users(*),
        requester:profiles(full_name, email)
      `)
      .eq("token", token)
      .single();

    if (fetchErr || !request) {
      return res.status(404).json({ error: "No se encontró la solicitud de acceso." });
    }

    if (request.status !== "Pendiente") {
      return res.status(400).json({ error: `Esta solicitud ya ha sido procesada (${request.status}).` });
    }

    const newStatus = action === "approve" ? "Aprobado" : "Denegado";
    let ticketId = null;

    // 2. If approved, create a ticket
    if (action === "approve") {
      const u = request.user;
      const doorsStr = request.requested_doors && request.requested_doors.length > 0 
        ? request.requested_doors.join(", ") 
        : "N/A";
        
      const description = `
        **Solicitud de Acceso Autorizada**
        Tipo: ${request.request_type}
        Empleado: ${u.first_name} ${u.last_name_paternal} ${u.last_name_maternal || ""} (#${u.employee_number})
        Departamento: ${u.department}
        Puesto Encargado: ${request.puesto_encargado || "N/A"}
        Puertas: ${doorsStr}
        
        *Este ticket fue generado automáticamente tras la aprobación vía correo electrónico.*
      `.trim().replace(/^\s+/gm, "");

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          title: `⚙️ IT/Accesos - ${request.request_type}: ${u.first_name} ${u.last_name_paternal}`,
          description,
          user_id: request.requested_by, // Assigned to requester
          status: "Abierto"
        })
        .select("id")
        .single();

      if (ticketError) throw new Error("Aprobado, pero falló la creación del Ticket: " + ticketError.message);
      ticketId = ticket.id;
    }

    // 3. Update the request status
    const updatePayload = { status: newStatus, updated_at: new Date() };
    if (ticketId) updatePayload.ticket_id = ticketId;

    const { error: updateError } = await supabase
      .from("access_requests")
      .update(updatePayload)
      .eq("id", request.id);

    if (updateError) throw new Error("Error al actualizar el estado: " + updateError.message);

    return res.status(200).json({ 
      success: true, 
      status: newStatus, 
      message: newStatus === "Aprobado" ? "Solicitud aprobada y ticket creado." : "Solicitud denegada."
    });

  } catch (err) {
    console.error("API Approve error:", err);
    return res.status(500).json({ error: err.message });
  }
}
