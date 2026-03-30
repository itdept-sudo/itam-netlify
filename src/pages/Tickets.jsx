import { useState } from "react";
import { Plus, Send, ChevronRight, MessageSquare, Inbox, AlertCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { TICKET_STATUSES, TICKET_COLORS } from "../data/constants";
import { StatusBadge, EmptyState, Modal, Input, Select, Textarea, Btn } from "../components/ui";

export default function TicketsView() {
  const { tickets, items, models, brands, users, createTicket, updateTicketStatus, addTicketComment, t } = useApp();
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", user_id: "", item_id: "" });
  const [comment, setComment] = useState("");

  const openNew = () => { setForm({ title: "", description: "", user_id: users[0]?.id || "", item_id: "" }); setModalOpen(true); };

  const save = async () => {
    if (!form.title || !form.user_id) return;
    await createTicket({ title: form.title, description: form.description, user_id: form.user_id, item_id: form.item_id || null, status: "Abierto" });
    setModalOpen(false);
  };

  const handleStatus = async (ticketId, status) => {
    await updateTicketStatus(ticketId, status);
    if (detailTicket?.id === ticketId) setDetailTicket(prev => prev ? { ...prev, status } : prev);
  };

  const handleComment = async (ticketId) => {
    if (!comment.trim()) return;
    const data = await addTicketComment(ticketId, comment, true, user.id);
    if (data && detailTicket?.id === ticketId) {
      setDetailTicket(prev => prev ? { ...prev, comments: [...prev.comments, data] } : prev);
    }
    setComment("");
  };

  const filtered = tickets.filter(t_obj => statusFilter === "all" || t_obj.status === statusFilter);
  const userItemsForForm = form.user_id ? items.filter(i => i.user_id === form.user_id) : [];

  // Keep detail in sync
  const currentDetail = detailTicket ? tickets.find(t => t.id === detailTicket.id) || detailTicket : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">Help Desk</h2>
          <p className="text-sm text-slate-500">{tickets.length} tickets · {tickets.filter(t_obj => t_obj.status === "Abierto").length} {t("Abierto").toLowerCase()}</p>
        </div>
        <Btn onClick={openNew}><Plus size={15} /> {t("newTicket")}</Btn>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["all", ...TICKET_STATUSES].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-slate-800/30 text-slate-400 border border-slate-700/30 hover:bg-slate-800/50"}`}>
            {t(s)} {s !== "all" && <span className="ml-1 text-xs opacity-60">({tickets.filter(t_obj => t_obj.status === s).length})</span>}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(ticket => {
          const u = users.find(x => x.id === ticket.user_id);
          const item = ticket.item_id ? items.find(i => i.id === ticket.item_id) : null;
          const model = item ? models.find(m => m.id === item.model_id) : null;
          const TIcon = TICKET_COLORS[ticket.status]?.icon || AlertCircle;
          return (
            <button key={ticket.id} onClick={() => { setDetailTicket(ticket); setComment(""); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#151A24] border border-slate-700/50 hover:border-slate-600/50 transition-all text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: TICKET_COLORS[ticket.status]?.bg }}><TIcon size={18} style={{ color: TICKET_COLORS[ticket.status]?.text }} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5"><p className="text-sm font-medium text-slate-200 truncate">{ticket.title}</p><StatusBadge status={ticket.status} type="ticket" /></div>
                <p className="text-xs text-slate-500 truncate">{u?.full_name || "—"} {model ? `· ${model.name}` : ""} · {new Date(ticket.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 text-slate-500"><MessageSquare size={14} /><span className="text-xs">{ticket.comments?.length || 0}</span></div>
              <ChevronRight size={16} className="text-slate-600" />
            </button>
          );
        })}
        {filtered.length === 0 && <EmptyState icon={Inbox} title={t("noResults")} subtitle={t("noResults")} />}
      </div>

      {/* New Ticket */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newTicket")}>
        <div className="space-y-4">
          <Select label={t("reportedBy")} options={[{ value: "", label: t("select") + "..." }, ...users.filter(u => u.is_active !== false).map(u => ({ value: u.id, label: u.full_name }))]} value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value, item_id: "" }))} />
          <Select label={t("optionalAsset")} options={[{ value: "", label: t("noneGeneral") }, ...userItemsForForm.map(i => { const m = models.find(x => x.id === i.model_id); return { value: i.id, label: `${m?.name || "—"} (${i.serial})` }; })]} value={form.item_id} onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} />
          <Input label={t("title")} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("summaryPlaceholder")} />
          <Textarea label={t("description")} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t("detailPlaceholder")} />
          <div className="flex justify-end gap-2 pt-2"><Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn><Btn onClick={save}><Send size={15} /> {t("create")}</Btn></div>
        </div>
      </Modal>

      {/* Detail */}
      <Modal open={!!currentDetail} onClose={() => setDetailTicket(null)} title={t("ticketDetail").replace("{{title}}", currentDetail?.title)} wide>
        {currentDetail && (() => {
          const u = users.find(x => x.id === currentDetail.user_id);
          const item = currentDetail.item_id ? items.find(i => i.id === currentDetail.item_id) : null;
          const model = item ? models.find(m => m.id === item.model_id) : null;
          const brand = model ? brands.find(b => b.id === model.brand_id) : null;
          const initials = u?.full_name ? u.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : "??";
          return (
            <div className="space-y-5">
              <div><div className="flex items-center gap-2 mb-2"><StatusBadge status={currentDetail.status} type="ticket" /><span className="text-xs text-slate-500">{new Date(currentDetail.created_at).toLocaleString()}</span></div><p className="text-sm text-slate-300">{currentDetail.description}</p></div>
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/20 border border-slate-700/30">
                <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">{initials}</div><div><p className="text-sm text-slate-200">{u?.full_name}</p><p className="text-xs text-slate-500">{u?.department || u?.email}</p></div></div>
                {model && <><div className="w-px h-8 bg-slate-700/50" /><div><p className="text-sm text-slate-200">{brand?.name} {model.name}</p><p className="text-xs font-mono text-slate-500">{item.serial}</p></div></>}
              </div>
              <div className="flex gap-2">{TICKET_STATUSES.map(s => <Btn key={s} variant={currentDetail.status === s ? "primary" : "secondary"} size="sm" onClick={() => handleStatus(currentDetail.id, s)}>{t(s)}</Btn>)}</div>
              <div>
                <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{t("conversation")} ({currentDetail.comments?.length || 0})</h5>
                <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                  {(currentDetail.comments || []).map(c => {
                    const cUser = c.is_staff ? { name: "Soporte IT", avatar: "IT" } : users.find(x => x.id === c.user_id);
                    const cInitials = cUser?.full_name ? cUser.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : cUser?.avatar || "??";
                    const cName = cUser?.full_name || cUser?.name || "Usuario";
                    return (
                      <div key={c.id} className={`flex gap-3 ${c.is_staff ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${c.is_staff ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>{cInitials}</div>
                        <div className={`max-w-[75%] p-3 rounded-xl ${c.is_staff ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-slate-800/30 border border-slate-700/30"}`}>
                          <div className="flex items-center gap-2 mb-1"><span className="text-xs font-medium text-slate-300">{cName}</span><span className="text-[10px] text-slate-600">{new Date(c.created_at).toLocaleString()}</span></div>
                          <p className="text-sm text-slate-300">{c.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  {(!currentDetail.comments || currentDetail.comments.length === 0) && <p className="text-sm text-slate-500 text-center py-4">{t("noComments")}</p>}
                </div>
                <div className="flex gap-2">
                  <input value={comment} onChange={e => setComment(e.target.value)} placeholder={t("replyAsSupport")} className="flex-1 px-3 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" onKeyDown={e => e.key === "Enter" && handleComment(currentDetail.id)} />
                  <Btn onClick={() => handleComment(currentDetail.id)}><Send size={14} /></Btn>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
