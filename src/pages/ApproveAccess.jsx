import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function ApproveAccess() {
  const [status, setStatus] = useState("loading"); // loading, success, error, invalid
  const [message, setMessage] = useState("Validando solicitud...");
  const [actionDone, setActionDone] = useState(null);

  useEffect(() => {
    async function processRequest() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const action = params.get("action");

      if (!token || !action) {
        setStatus("invalid");
        setMessage("Ruta inválida. Faltan parámetros en la URL.");
        return;
      }

      if (action !== "approve" && action !== "deny") {
        setStatus("invalid");
        setMessage("Acción inválida. Utiliza los botones del correo.");
        return;
      }

      try {
        // Fetch the access request matching the token
        // Use single() to ensure we get a match
        const { data: request, error: fetchReqError } = await supabase
          .from("access_requests")
          .select(`
            *,
            user:production_users(*),
            requester:profiles(full_name, email)
          `)
          .eq("token", token)
          .single();

        if (fetchReqError) throw new Error("No se encontró la solicitud o hubo un problema al leerla.");

        if (request.status !== "Pendiente") {
          setStatus("invalid");
          setMessage(`Esta solicitud ya ha sido procesada anteriormente (Estado actual: ${request.status}).`);
          return;
        }

        const newStatus = action === "approve" ? "Aprobado" : "Denegado";
        let ticketId = null;

        // If approved, create a ticket directly
        if (action === "approve") {
          const u = request.user;
          const doorsStr = request.requested_doors && request.requested_doors.length > 0 
            ? request.requested_doors.join(", ") 
            : "Entrada Personal";
            
          const description = `
            Tipo: ${request.request_type}
            Empleado: ${u.first_name} ${u.last_name_paternal} ${u.last_name_maternal || ""} (#${u.employee_number})
            Departamento: ${u.department}
            Puertas Solicitadas: ${doorsStr}
            Puesto Encargado: ${request.puesto_encargado || "N/A"}
          `.trim();

          const { data: ticket, error: ticketError } = await supabase
            .from("tickets")
            .insert({
              title: `⚙️ IT/Accesos - ${request.request_type}: ${u.first_name} ${u.last_name_paternal}`,
              description: description,
              user_id: request.requested_by, // assigned to the person who requested it
              status: "Abierto"
            })
            .select("id")
            .single();

          if (ticketError) throw new Error("Aprobado, pero falló la creación del Ticket.");
          ticketId = ticket.id;
        }

        // Update the access request
        const updatePayload = { status: newStatus };
        if (ticketId) updatePayload.ticket_id = ticketId;

        const { error: updateError } = await supabase
          .from("access_requests")
          .update(updatePayload)
          .eq("id", request.id);

        if (updateError) throw new Error("No se pudo actualizar el estado de la solicitud.");

        setStatus("success");
        setActionDone(newStatus);
        setMessage(
          newStatus === "Aprobado" 
            ? `La solicitud fue Autorizada exitosamente y se generó el ticket correspondiente.` 
            : `La solicitud fue Denegada. Se notificará en el sistema.`
        );

      } catch (err) {
        console.error("ApproveAccess error:", err);
        setStatus("error");
        setMessage(err.message || "Ocurrió un error inesperado al procesar la solicitud.");
      }
    }

    processRequest();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-200 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#151A24] border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 size={48} className="animate-spin text-blue-500 mx-auto" />
            <h1 className="text-xl font-bold text-slate-100">Procesando</h1>
            <p className="text-sm text-slate-400">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            {actionDone === "Aprobado" ? (
              <CheckCircle2 size={56} className="text-emerald-500 mx-auto" />
            ) : (
              <XCircle size={56} className="text-red-500 mx-auto" />
            )}
            <h1 className="text-xl font-bold text-slate-100">
              {actionDone === "Aprobado" ? "Solicitud Autorizada" : "Solicitud Denegada"}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
            <div className="pt-4">
              <a href="/" className="inline-block px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors">
                Ir al Dashboard
              </a>
            </div>
          </div>
        )}

        {(status === "error" || status === "invalid") && (
          <div className="space-y-4">
            <AlertTriangle size={56} className="text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold text-slate-100">Error</h1>
            <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
          </div>
        )}

      </div>
    </div>
  );
}
