import { useState } from "react";
import { Plus, Send, ChevronRight, MessageSquare, Inbox, AlertCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { TICKET_STATUSES, TICKET_COLORS } from "../data/constants";
import { StatusBadge, Badge, EmptyState, Modal, Input, Textarea, Btn } from "../components/ui";

function resizeImage(file, maxSize = 1000) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), "image/webp", 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadTicketPhoto(file) {
  const resized = await resizeImage(file, 1000);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { data, error } = await supabase.storage
    .from("ticket-photos")
    .upload(fileName, resized, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("ticket-photos").getPublicUrl(data.path);
  return urlData.publicUrl;
}

export default function UserPortal() {
  const { tickets, items, models, brands, users, createTicket, addTicketComment, showToast, t } = useApp();
  const { user, profile } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", item_id: "", photos: [] });
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentPhotos, setCommentPhotos] = useState([]);
  const [commentUploading, setCommentUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const myTickets = tickets.filter(t_obj => t_obj.user_id === user?.id);
  const myItems = items.filter(i => i.user_id === user?.id);
  const filtered = myTickets.filter(t_obj => statusFilter === "all" || t_obj.status === statusFilter);

  const openNew = () => { setForm({ title: "", description: "", item_id: "", photos: [] }); setModalOpen(true); };

  const save = async () => {
    if (!form.title.trim()) return;
    setUploading(true);
    try {
      let uploadedUrls = [];
      if (form.photos && form.photos.length > 0) {
        uploadedUrls = await Promise.all(form.photos.map(p => uploadTicketPhoto(p.file)));
      }

      await createTicket({
        title: form.title,
        description: form.description,
        user_id: user.id,
        item_id: form.item_id || null,
        status: "Abierto",
        images: uploadedUrls
      });
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast("Error subiendo imágenes: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    // Limits
    const availableSlots = 3 - (form.photos?.length || 0);
    const toAdd = files.slice(0, availableSlots);
    
    if (files.length > availableSlots) {
      showToast("Solo puedes adjuntar un máximo de 3 imágenes.", "error");
    }

    const newPhotos = toAdd.map(file => {
      const url = URL.createObjectURL(file);
      return { file, previewUrl: url };
    });

    setForm(p => ({ ...p, photos: [...(p.photos || []), ...newPhotos] }));
  };

  const removePhoto = (index) => {
    setForm(p => ({
      ...p,
      photos: (p.photos || []).filter((_, i) => i !== index)
    }));
  };

  const selectTicket = async (ticket) => {
    setDetailTicket(ticket);
    const { data: comments } = await supabase
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at");
    setDetailTicket(prev => prev ? { ...prev, comments: comments || [] } : prev);
  };

  const handleComment = async (ticketId) => {
    if (!comment.trim() && commentPhotos.length === 0) return;
    setCommentUploading(true);
    try {
      let uploadedUrls = [];
      if (commentPhotos.length > 0) {
        uploadedUrls = await Promise.all(commentPhotos.map(p => uploadTicketPhoto(p.file)));
      }
      const data = await addTicketComment(ticketId, comment.trim(), false, user.id, uploadedUrls);
      if (data && detailTicket?.id === ticketId) {
        setDetailTicket(prev => prev ? { ...prev, comments: [...(prev.comments || []), data] } : prev);
      }
      setComment("");
      setCommentPhotos([]);
    } catch (err) {
      alert("Error subiendo imágenes del comentario: " + err.message);
    } finally {
      setCommentUploading(false);
    }
  };

  const handleCommentPhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const availableSlots = 3 - (commentPhotos.length || 0);
    const toAdd = files.slice(0, availableSlots);
    if (files.length > availableSlots) alert("Solo puedes adjuntar un máximo de 3 imágenes.");
    const newPhotos = toAdd.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
    setCommentPhotos(p => [...p, ...newPhotos]);
  };
  const removeCommentPhoto = (index) => setCommentPhotos(p => p.filter((_, i) => i !== index));
  const currentDetail = detailTicket ? { ...detailTicket, ...(myTickets.find(t => t.id === detailTicket.id) || {}), comments: detailTicket.comments } : null;

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
            <button key={ticket.id} onClick={() => { selectTicket(ticket); setComment(""); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#151A24] border border-slate-700/50 hover:border-slate-600/50 transition-all text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: TICKET_COLORS[ticket.status]?.bg }}>
                <TIcon size={18} style={{ color: TICKET_COLORS[ticket.status]?.text }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">TK-{ticket.ticket_number}</span>
                  <p className="text-sm font-medium text-slate-200 truncate">{ticket.title}</p>
                  <StatusBadge status={ticket.status} type="ticket" />
                </div>
                <p className="text-xs text-slate-500 truncate">{model ? model.name + " · " : ""}{new Date(ticket.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <MessageSquare size={14} />
                <span className="text-xs">{ticket.ticket_comments?.[0]?.count || 0}</span>
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
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Adjuntar Imágenes (Máx. 3)</label>
            <div className="flex gap-3 mt-2">
              {(form.photos || []).map((photo, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
                  <img src={photo.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-red-500/80 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              
              {(form.photos?.length || 0) < 3 && (
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-700/50 flex items-center justify-center text-slate-500 hover:text-slate-300 hover:border-slate-500 hover:bg-slate-800/30 transition-all cursor-pointer">
                  <Plus size={20} />
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </label>
              )}
            </div>
            {(form.photos?.length || 0) === 0 && <p className="text-[10px] text-slate-500">Haz clic en el recuadro para seleccionar imágenes de evidencia.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn>
            <Btn onClick={save} disabled={uploading}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} 
              {uploading ? "Subiendo..." : t("sendTicket")}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Ticket Detail */}
      <Modal open={!!currentDetail} onClose={() => setDetailTicket(null)} title={currentDetail ? `TK-${currentDetail.ticket_number} | ${currentDetail.title}` : ""} wide>
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
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{currentDetail.description}</p>
              </div>

              {currentDetail.images && currentDetail.images.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Imágenes Adjuntas</h5>
                  <div className="flex flex-wrap gap-3">
                    {currentDetail.images.map((imgUrl, i) => (
                      <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block w-24 h-24 rounded-xl border border-slate-700/50 hover:border-blue-500/50 overflow-hidden transition-colors">
                        <img src={imgUrl} alt="Attached" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

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
                    const cName = cUser.name;
                    return (
                      <div key={c.id} className={`flex gap-3 ${c.is_staff ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${c.is_staff ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>{cUser.avatar}</div>
                        <div className={`max-w-[85%] p-3 rounded-xl ${c.is_staff ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-slate-800/60 border border-slate-700/50"}`}>
                        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-slate-200">{cName}</span><span className="text-[10px] text-slate-500">{new Date(c.created_at).toLocaleString()}</span></div>
                        {c.text && <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.text}</p>}
                        {c.images && c.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-700/30">
                            {c.images.map((imgUrl, i) => (
                              <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg border border-slate-700/50 hover:border-blue-500/50 overflow-hidden transition-colors">
                                <img src={imgUrl} alt="Attached" className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    );
                  })}
                  {(!currentDetail.comments || currentDetail.comments.length === 0) && <p className="text-sm text-slate-500 text-center py-4">{t("noCommentsUser")}</p>}
                </div>
                {currentDetail.status !== "Cerrado" ? (
                  <>
                  {commentPhotos.length > 0 && (
                <div className="flex gap-3 mb-2 p-2 bg-slate-800/40 rounded-xl border border-slate-700/50">
                  {commentPhotos.map((photo, i) => (
                    <div key={i} className="relative w-12 h-12 rounded-lg border border-slate-700/50 overflow-hidden">
                      <img src={photo.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => removeCommentPhoto(i)} className="absolute top-0 right-0 p-0.5 bg-black/60 rounded-bl text-white hover:bg-red-500/80 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex items-center justify-center bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 hover:bg-slate-700/60 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors">
                  <Plus size={16} />
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleCommentPhotoSelect} />
                </label>
                <input disabled={commentUploading || detailTicket.status === "Cerrado"} value={comment} onChange={e => setComment(e.target.value)} placeholder={detailTicket.status === "Cerrado" ? t("ticketClosed") : t("replyPlaceholder")} className="flex-1 px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 disabled:opacity-50" onKeyDown={e => e.key === "Enter" && detailTicket.status !== "Cerrado" && handleComment(detailTicket.id)} />
                <Btn disabled={detailTicket.status === "Cerrado" || commentUploading || (!comment.trim() && commentPhotos.length === 0)} onClick={() => handleComment(detailTicket.id)}>
                  {commentUploading ? <Loader2 size={14} className="animate-spin" /> : <Send size={15} />}
                </Btn>
              </div>
              </>
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
