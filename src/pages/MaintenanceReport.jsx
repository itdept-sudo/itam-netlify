import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { Wrench, Calendar, Search, Filter } from "lucide-react";
import { StatusBadge, Badge, Btn, EmptyState } from "../components/ui";

export default function MaintenanceReport() {
  const { items, models, brands, t } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ticket_maintenance_items")
        .select(`
          *,
          tickets ( title, created_at, ticket_number )
        `)
        .order("created_at", { ascending: false });
        
      if (!error && data) setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const itm = items.find(i => i.id === log.item_id);
    const mod = itm ? models.find(m => m.id === itm.model_id) : null;
    const brn = mod ? brands.find(b => b.id === mod.brand_id) : null;
    
    const term = `${itm?.serial || ""} ${mod?.name || ""} ${brn?.name || ""} ${log.notes || ""} ${log.tickets?.title || ""}`.toLowerCase();
    const matchesSearch = term.includes(search.toLowerCase());
    
    const isCompleted = log.is_completed;
    const matchesStatus = filterStatus === "all" || 
                          (filterStatus === "completed" && isCompleted) || 
                          (filterStatus === "pending" && !isCompleted);
                          
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1 flex items-center gap-2">
            <Wrench className="text-purple-400" /> Reporte de Mantenimientos
          </h2>
          <p className="text-sm text-slate-500">Histórico de mantenimientos preventivos a equipos</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por S/N, modelo, fecha o notas..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50" 
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 outline-none flex-1 sm:flex-none"
          >
            <option value="all">Todos los Registros</option>
            <option value="completed">Solo Completados</option>
            <option value="pending">Pendientes de Completar</option>
          </select>
        </div>
      </div>

      <div className="bg-[#151A24] border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Fecha / Ticket</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Detalle del Equipo</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Dictamen Técnico</th>
                <th className="px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-10 text-slate-500">Cargando registros...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="4"><EmptyState icon={Wrench} title="Sin resultados" subtitle="No hay mantenimientos que coincidan con la búsqueda." /></td></tr>
              ) : (
                filteredLogs.map(log => {
                  const itm = items.find(i => i.id === log.item_id);
                  const mod = itm ? models.find(m => m.id === itm.model_id) : null;
                  const brn = mod ? brands.find(b => b.id === mod.brand_id) : null;
                  const logDate = new Date(log.created_at).toLocaleDateString("es-MX", { year: 'numeric', month: 'short', day: 'numeric' });

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar size={14} className="text-slate-500" />
                          <span className="text-sm text-slate-200">{logDate}</span>
                        </div>
                        <span className="text-xs text-slate-500">TK-{log.tickets?.ticket_number}</span>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <p className="text-sm font-medium text-slate-200">{brn?.name} {mod?.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">S/N: {itm?.serial || "Desconocido"}</p>
                      </td>
                      <td className="px-6 py-4 align-top max-w-xs">
                        <p className="text-sm text-slate-300 line-clamp-3">{log.notes || <span className="text-slate-600 italic">Sin observaciones</span>}</p>
                        {log.images && log.images.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{log.images.length} foto(s)</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        {log.is_completed ? (
                          <Badge color="green">Mantenimiento Aplicado</Badge>
                        ) : (
                          <Badge color="yellow">Programado</Badge>
                        )}
                        {itm && (
                          <div className="mt-2">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Estatus Real</p>
                            <StatusBadge status={itm.status} type="asset" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
