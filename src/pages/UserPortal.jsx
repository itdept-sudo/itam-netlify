import { useState } from "react";
import { Plus, Send, ChevronRight, MessageSquare, Inbox, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { TICKET_STATUSES, TICKET_COLORS } from "../data/constants";
import { StatusBadge, Badge, EmptyState, Modal, Input, Textarea, Btn } from "../components/ui";

export default function UserPortal() {
  const { tickets, items, models, brands, users, createTicket, addTicketComment, showToast, t } = useApp();
  const { user, profile } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", item_id: "" });
  const [comment, setComment] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const myTickets = tickets.filter(t_obj => t_obj.user_id === user?.id);
  const myItems = items.filter(i => i.user_id === user?.id);
  const filtered = myTickets.filter(t_obj => statusFilter === "all" || t_obj.status === statusFilter);

  const openNew = () => { setForm({ title: "", description: "", item_id: "" }); setModalOpen(true); };

  const save = async () => {
    if (!form.title.trim()) return;
    await createTicket({
      title: form.title,
      description: form.description,
      user_id: user.id,
      item_id: form.item_id || null,
      status: "Abierto",
    });
    setModalOpen(false);
  };

  const handleComment = async (ticketId) => {
    if (!comment.trim()) return;
    const data = await addTicketComment(ticketId, comment, false, user.id);
    if (data) {
      setDetailTicket(prev => prev ? { ...prev, comments: [...prev.comments, data] } : prev);
      setComment("");
    }
  };

  // Sync detail ticket with latest data
  const currentDetail = detailTicket ? myTickets.find(t => t.id === detailTicket.id) || detailTicket : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("myTickets")}</h2>
          <p className="text-sm text-slate-500">
            {t("welcomeUser").replace("{{name}}", profile?.full_name || t("user"))} · {myTickets.length} ticket{myTickets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Btn onClick={openNew}><Plus size={15} /> {t("reportIncidencia")}</Btn>
      </div>

      {/* My equipment summary */}
      {myItems.length > 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-[#151A24] p-4">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{t("myAssignedEquipment")}</h3>
          <div className="flex flex-wrap gap-2">
            {myItems.map(item => {
              const model = models.find(m => m.id === item.model_id);
              const brand = model ? brands.find(b => b.id === model.brand_id) : null;
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="w-8 h-8 rounded-lg bg-slate-800/60 flex items-center justify-center overflow-hidden">
                    {model?.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-slate-500">{model?.type?.slice(0, 3)}</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">{brand?.name} {model?.name}</p>
                    <p className="text-[10px] font-mono text-slate-500">{item.serial}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", ...TICKET_STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-slate-800/30 text-slate-400 border border-slate-700/30 hover:bg-slate-800/50"}`}>
            {t(s)} {s !== "all" && <span className="ml-1 text-xs opacity-60">({myTickets.filter(t_obj => t_obj.status === s).length})</span>}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {filtered.map(ticket => {
          const item = ticket.item_id ? items.find(i => i.id === ticket.item_id) : null;
          const model = item ? models.find(m => m.id === item.model_id) : null;
          const TIcon = TICKET_COLORS[ticket.status]?.icon || AlertCircle;
          return (
            <button key={ticket.id} onClick={() => { setDetailTicket(ticket); setComment(""); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#151A24] border border-slate-700/50 hover:border-slate-600/50 transition-all text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: TICKET_COLORS[ticket.status]?.bg }}>
                <TIcon size={18} style={{ color: TICKET_COLORS[ticket.status]?.text }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-slate-200 truncate">{ticket.title}</p>
                  <StatusBadge status={ticket.status} type="ticket" />
                </div>
                <p className="text-xs text-slate-500 truncate">{model ? model.name + " · " : ""}{new Date(ticket.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <MessageSquare size={14} />
                <span className="text-xs">{ticket.comments?.length || 0}</span>
              </div>
              <ChevronRight size={16} className="text-slate-600" />
            </button>
          );
        })}
        {filtered.length === 0 && <EmptyState icon={Inbox} title={t("noResults")} subtitle={statusFilter === "all" ? t("noTicketsYet") : t("noResults")} action={<Btn onClick={openNew}><Plus size={14} /> {t("newTicket")}</Btn>} />}
      </div>

      {/* New Ticket Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("reportIncidencia")}>
        <div className="space-y-4">
          {myItems.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t("optionalAsset")}</label>
              <select value={form.item_id} onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 appearance-none">
                <option value="">{t("noneGeneral")}</option>
                {myItems.map(i => {
                  const m = models.find(x => x.id === i.model_id);
                  return <option key={i.id} value={i.id}>{m?.name || "—"} ({i.serial})</option>;
                })}
              </select>
            </div>
          )}
          <Input label={t("title")} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("issueSummary")} />
          <Textarea label={t("description")} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t("issueDetail")} />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn>
            <Btn onClick={save}><Send size={15} /> {t("sendTicket")}</Btn>
          </div>
        </div>
      </Modal>

      {/* Ticket Detail */}
      <Modal open={!!currentDetail} onClose={() => setDetailTicket(null)} title={currentDetail?.title} wide>
        {currentDetail && (() => {
          const item = currentDetail.item_id ? items.find(i => i.id === currentDetail.item_id) : null;
          const model = item ? models.find(m => m.id === item.model_id) : null;
          const brand = model ? brands.find(b => b.id === model.brand_id) : null;
          return (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={currentDetail.status} type="ticket" />
                  <span className="text-xs text-slate-500">{new Date(currentDetail.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-300">{currentDetail.description}</p>
              </div>

              {model && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/20 border border-slate-700/30">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center overflow-hidden">
                    {model.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-slate-500">{model.type?.slice(0, 3)}</span>}
                  </div>
                  <div>
                    <p className="text-sm text-slate-200">{brand?.name} {model.name}</p>
                    <p className="text-xs font-mono text-slate-500">{item.serial}</p>
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{t("conversation")} ({currentDetail.comments?.length || 0})</h5>
                <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
                  {(currentDetail.comments || []).map(c => {
                    const cUser = c.is_staff
                      ? { name: t("itSupport"), avatar: "IT" }
                      : { name: profile?.full_name || t("user"), avatar: profile?.full_name?.split(" ").map(w => w[0]).join("").slice(0, 2) || "??" };
                    return (
                      <div key={c.id} className={`flex gap-3 ${c.is_staff ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${c.is_staff ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>{cUser.avatar}</div>
                        <div className={`max-w-[75%] p-3 rounded-xl ${c.is_staff ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-slate-800/30 border border-slate-700/30"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-300">{cUser.name}</span>
                            <span className="text-[10px] text-slate-600">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-300">{c.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  {(!currentDetail.comments || currentDetail.comments.length === 0) && <p className="text-sm text-slate-500 text-center py-4">{t("noCommentsUser")}</p>}
                </div>
                {currentDetail.status !== "Cerrado" ? (
                  <div className="flex gap-2">
                    <input value={comment} onChange={e => setComment(e.target.value)} placeholder={t("writeMessage")} className="flex-1 px-3 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" onKeyDown={e => e.key === "Enter" && handleComment(currentDetail.id)} />
                    <Btn onClick={() => handleComment(currentDetail.id)}><Send size={14} /></Btn>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                    <p className="text-xs text-emerald-400">{t("ticketClosed")}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
