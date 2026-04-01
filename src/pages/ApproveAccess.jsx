import React, { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function ApproveAccess() {
  const [status, setStatus] = useState("loading"); // loading, success, error, invalid
  const [message, setMessage] = useState("Validando solicitud...");
  const [actionDone, setActionDone] = useState(null);

  useEffect(() => {
    async function processRequest() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const action = params.get("action");

      console.log("Validando URL de aprobación:", { token, action, url: window.location.href });

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
        // Enviar al API del servidor (Vercel) para que procese con Service Role
        const res = await fetch("/api/process-approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action })
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || "Ocurrió un error al procesar la solicitud.");
        }

        setStatus("success");
        setActionDone(result.status);
        setMessage(
          result.status === "Aprobado" 
            ? `La solicitud fue Autorizada exitosamente y se generó el ticket correspondiente.` 
            : `La solicitud fue Denegada. Se notificará en el sistema.`
        );

      } catch (err) {
        console.error("ApproveAccess error:", err);
        setStatus("error");
        setMessage(err.message || "No se pudo completar la operación.");
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
