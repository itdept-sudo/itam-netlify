import { useState, useEffect } from "react";
import { 
  Shield, Search, Loader2, Download, Upload, 
  Eye, FileCheck, CheckCircle2, XCircle, Clock,
  Filter, ChevronRight, User, Building, MapPin

} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { generateAccessFormatPDF } from "../utils/pdfFormatGenerator";
import { Badge, EmptyState } from "../components/ui";

export default function SecurityPortal() {
  const { profile } = useAuth();
  const { t, showToast } = useApp();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Pendiente");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("access_requests")
        .select(`
          *,
          user:user_id(*),
          requester:requested_by(full_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error(err);
      showToast("Error al cargar solicitudes", "error");
    } finally {
      setLoading(false);
    }
  }

  const handleProcessAction = async (token, action, requestId) => {
    setProcessingId(requestId);
    try {
      const res = await fetch("/api/process-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      showToast(action === "approve" ? "Solicitud aprobada" : "Solicitud denegada", "success");
      await fetchRequests();
    } catch (err) {
      console.error(err);
      showToast(err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUploadSigned = async (requestId, file) => {
    if (!file) return;
    setProcessingId(requestId);
    try {
      const fileName = `signed_${requestId}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("signed-access-formats")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("signed-access-formats")
        .getPublicUrl(uploadData.path);

      const { error: updateError } = await supabase
        .from("access_requests")
        .update({ signed_format_url: publicUrl })
        .eq("id", requestId);

      if (updateError) throw updateError;

      showToast("Formato firmado cargado", "success");
      await fetchRequests();
    } catch (err) {
      console.error(err);
      showToast("Error al cargar archivo", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesFilter = filter === "Todos" || r.status === filter;
    const matchesSearch = 
      r.user?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.user?.employee_number?.includes(search) ||
      r.request_type?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Shield size={28} className="text-blue-500" />

            Gestión de Accesos (Seguridad)
          </h2>
          <p className="text-sm text-slate-500">Aprobación y control de formatos FT-SP-PP-001</p>
        </div>

        <div className="flex items-center gap-2 bg-[#151A24] p-1 rounded-xl border border-slate-800">
          {["Pendiente", "Aprobado", "Denegado", "Todos"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por empleado o tipo..."
          className="w-full pl-10 pr-4 py-3 bg-[#151A24] border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-slate-500 text-sm">Cargando solicitudes...</p>
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredRequests.map(req => (
            <div 
              key={req.id} 
              className="bg-[#151A24] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all group relative overflow-hidden"
            >
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 left-0 w-1 h-full ${
                req.status === 'Pendiente' ? 'bg-amber-500' : req.status === 'Aprobado' ? 'bg-emerald-500' : 'bg-red-500'
              }`} />

              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 capitalize">
                        {req.user?.full_name?.[0] || <User size={18} />}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-100">{req.user?.full_name}</h3>
                        <p className="text-xs text-slate-500">#{req.user?.employee_number} · {req.user?.department}</p>
                      </div>
                    </div>
                    <Badge color={req.status === 'Pendiente' ? 'yellow' : req.status === 'Aprobado' ? 'green' : 'red'}>
                      {req.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                        <Clock size={10} /> Fecha Solicitud
                      </span>
                      <p className="text-xs text-slate-300">{new Date(req.created_at).toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                        <MapPin size={10} /> Puertas Solicitadas
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(req.requested_doors || []).map(d => (
                          <span key={d} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] border border-blue-500/20">{d}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                        <User size={10} /> Solicitado por
                      </span>
                      <p className="text-xs text-slate-300">{req.requester?.full_name || "N/A"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center gap-2 min-w-[200px]">
                  {req.status === 'Pendiente' ? (
                    <>
                      <button
                        onClick={() => handleProcessAction(req.token, "approve", req.id)}
                        disabled={processingId === req.id}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                      >
                        {processingId === req.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Autorizar y Crear Ticket
                      </button>
                      <button
                        onClick={() => handleProcessAction(req.token, "deny", req.id)}
                        disabled={processingId === req.id}
                        className="w-full py-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 border border-slate-700 hover:border-red-500/20"
                      >
                        <XCircle size={14} />
                        Denegar Acceso
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => generateAccessFormatPDF(req.user, req)}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 border border-slate-700"
                      >
                        <Download size={14} className="text-red-400" />
                        Descargar Formato
                      </button>

                      {req.signed_format_url ? (
                        <a
                          href={req.signed_format_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-emerald-500/20"
                        >
                          <FileCheck size={14} />
                          Ver Formato Firmado
                        </a>
                      ) : (
                        <label className="w-full py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-blue-500/20 cursor-pointer">
                          <Upload size={14} />
                          Subir Formato Firmado
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={(e) => handleUploadSigned(req.id, e.target.files[0])} 
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState 
          icon={Clock} 
          title="No hay solicitudes" 
          subtitle="No se encontraron solicitudes con el filtro actual." 
        />
      )}
    </div>
  );
}
