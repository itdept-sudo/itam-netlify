import { Boxes, UserCheck, Wrench, TicketCheck, Plus, MessageSquare, Loader2, Zap, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { STATUSES, TICKET_STATUSES } from "../data/constants";
import { KpiCard, MiniBar, StatusBadge } from "../components/ui";

export default function Dashboard() {
  const { items, tickets, models, users, dataLoading, dashboardStats, t, lastUpdate } = useApp();

  if (dataLoading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-blue-400" /></div>;

  // Use filtered data from limited sets for remaining charts
  const statusCounts = STATUSES.reduce((a, s) => ({ ...a, [s]: items.filter(i => i.status === s).length }), {});
  const ticketCounts = TICKET_STATUSES.reduce((a, s) => ({ ...a, [s]: tickets.filter(t => t.status === s).length }), {});
  
  const typeCounts = {};
  items.slice(0, 100).forEach(item => {
    const model = models.find(m => m.id === item.model_id);
    if (model) typeCounts[model.type] = (typeCounts[model.type] || 0) + 1;
  });

  // Calculate Response SLA (Response within 24h)
  const ticketsWithResponse = tickets.filter(t => t.responded_at || t.closed_at);
  const ticketsMetSla = ticketsWithResponse.filter(t => {
    const start = new Date(t.created_at).getTime();
    const response = new Date(t.responded_at || t.closed_at).getTime();
    return (response - start) <= 24 * 60 * 60 * 1000;
  });
  const slaPercent = ticketsWithResponse.length > 0 
    ? Math.round((ticketsMetSla.length / ticketsWithResponse.length) * 100) 
    : 100;

  // IT Leaderboard (Closed tickets by user)
  const solvers = users.filter(u => u.role === "admin" || u.role === "rrhh");
  const leaderboard = solvers.map(u => {
    const closedCount = tickets.filter(t => t.closed_by === u.id && t.status === "Cerrado").length;
    return { ...u, closedCount };
  }).sort((a, b) => b.closedCount - a.closedCount).filter(u => u.closedCount > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("dashboard")}</h2>
          <p className="text-sm text-slate-500">{t("generalSummary")}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
          <Zap size={14} className="animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider">Live Sync</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Boxes} label={t("totalAssets")} value={dashboardStats.items} trend={t("totalModels").replace("{{count}}", models.length)} color="blue" />
        <KpiCard icon={UserCheck} label={t("Asignado")} value={dashboardStats.active} trend={t("availableTrend").replace("{{count}}", statusCounts.Disponible || 0)} color="green" />
        <KpiCard icon={Wrench} label={t("maintenance")} value={statusCounts.Mantenimiento || 0} trend={t("bajaTrend").replace("{{count}}", statusCounts.Baja || 0)} color="yellow" />
        <KpiCard icon={TicketCheck} label={t("openTicketsStat")} value={dashboardStats.pending} trend={t("closedTrend").replace("{{count}}", ticketCounts.Cerrado || 0)} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* New: SLA Response Chart (Gauge style using CSS) */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-[#1A1F2B] to-[#151A24] p-5 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
          <h3 className="text-sm font-semibold text-slate-300 mb-6 flex items-center gap-2 self-start">
            <Clock size={16} className="text-emerald-400" />
            % Respuesta (SLA 24h)
          </h3>
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
              <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                strokeDasharray={364.4}
                strokeDashoffset={364.4 - (364.4 * slaPercent) / 100}
                className="text-emerald-500 transition-all duration-1000 ease-out" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-white">{slaPercent}%</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold">A tiempo</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center px-4">Meta: Atender tickets en menos de 24 horas.</p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("assetByStatus")}</h3>
          <MiniBar data={STATUSES.map(s => ({ label: t(s).slice(0, 4), value: statusCounts[s] }))} colors={["#10B981", "#3B82F6", "#F59E0B", "#EF4444"]} />
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("ticketByStatus")}</h3>
          <MiniBar data={TICKET_STATUSES.map(s => ({ label: t(s).slice(0, 4), value: ticketCounts[s] }))} colors={["#EF4444", "#F59E0B", "#10B981"]} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* New: IT Leaderboard */}
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-[#1A1F2B] to-[#151A24] p-5 relative overflow-hidden group">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-yellow-500" />
            Top Solvers (Personal IT)
          </h3>
          <div className="space-y-3">
            {leaderboard.map((u, idx) => {
              const initials = u.full_name ? u.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : "??";
              return (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-all group/item">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold relative ${idx === 0 ? "bg-yellow-500/20 text-yellow-500" : "bg-slate-700/30 text-slate-400"}`}>
                    {idx === 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px]">👑</span>}
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{u.full_name}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? "bg-yellow-500" : "bg-blue-500"}`} 
                          style={{ width: `${(u.closedCount / (leaderboard[0].closedCount || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-200">{u.closedCount}</p>
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Cerrados</p>
                  </div>
                </div>
              );
            })}
            {leaderboard.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                 <CheckCircle2 size={32} className="mb-2 opacity-20" />
                 <p className="text-xs">No hay tickets cerrados por personal de IT aún.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("recentTickets")}</h3>
          <div className="space-y-2">
            {tickets.filter(t => t.status !== "Cerrado").slice(0, 5).map(t => {
              const u = users.find(x => x.id === t.user_id);
              const initials = u?.full_name ? u.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : "??";
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-400">{initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{t.title}</p>
                    <p className="text-xs text-slate-500">{u?.full_name || "—"}</p>
                  </div>
                  <StatusBadge status={t.status} type="ticket" />
                </div>
              );
            })}
            {tickets.filter(t => t.status !== "Cerrado").length === 0 && <p className="text-sm text-slate-500 text-center py-4">{t("noOpenTickets")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
