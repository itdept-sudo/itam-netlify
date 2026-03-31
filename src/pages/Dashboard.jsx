import { Boxes, UserCheck, Wrench, TicketCheck, Plus, MessageSquare, Loader2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { STATUSES, TICKET_STATUSES } from "../data/constants";
import { KpiCard, MiniBar, StatusBadge } from "../components/ui";

export default function Dashboard() {
  const { items, tickets, models, users, dataLoading, dashboardStats, t } = useApp();

  if (dataLoading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-blue-400" /></div>;

  // Use filtered data from limited sets for remaining charts
  const statusCounts = STATUSES.reduce((a, s) => ({ ...a, [s]: items.filter(i => i.status === s).length }), {});
  const ticketCounts = TICKET_STATUSES.reduce((a, s) => ({ ...a, [s]: tickets.filter(t => t.status === s).length }), {});
  
  // For types, we use the limited items list which is fine for a "snapshot"
  const typeCounts = {};
  items.slice(0, 100).forEach(item => {
    const model = models.find(m => m.id === item.model_id);
    if (model) typeCounts[model.type] = (typeCounts[model.type] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("dashboard")}</h2>
        <p className="text-sm text-slate-500">{t("generalSummary")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Boxes} label={t("totalAssets")} value={dashboardStats.items} trend={t("totalModels").replace("{{count}}", models.length)} color="blue" />
        <KpiCard icon={UserCheck} label={t("Asignado")} value={dashboardStats.active} trend={t("availableTrend").replace("{{count}}", statusCounts.Disponible || 0)} color="green" />
        <KpiCard icon={Wrench} label={t("maintenance")} value={statusCounts.Mantenimiento || 0} trend={t("bajaTrend").replace("{{count}}", statusCounts.Baja || 0)} color="yellow" />
        <KpiCard icon={TicketCheck} label={t("openTicketsStat")} value={dashboardStats.pending} trend={t("closedTrend").replace("{{count}}", ticketCounts.Cerrado || 0)} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("assetByStatus")}</h3>
          <MiniBar data={STATUSES.map(s => ({ label: t(s).slice(0, 4), value: statusCounts[s] }))} colors={["#10B981", "#3B82F6", "#F59E0B", "#EF4444"]} />
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("ticketByStatus")}</h3>
          <MiniBar data={TICKET_STATUSES.map(s => ({ label: t(s).slice(0, 4), value: ticketCounts[s] }))} colors={["#EF4444", "#F59E0B", "#10B981"]} />
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("byType")}</h3>
          <MiniBar data={Object.entries(typeCounts).map(([k, v]) => ({ label: k.slice(0, 5), value: v }))} colors={["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"]} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">{t("topUsers")}</h3>
          <div className="space-y-2">
            {users.filter(u => items.some(i => i.user_id === u.id)).slice(0, 5).map(u => {
              const count = items.filter(i => i.user_id === u.id).length;
              const initials = u.full_name ? u.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : "??";
              return (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">{initials}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.department || u.email}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-300">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
