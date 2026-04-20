import { useState, useEffect } from "react";
import { Plus, Send, ChevronRight, MessageSquare, Inbox, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { TICKET_STATUSES, TICKET_COLORS } from "../data/constants";
import { StatusBadge, EmptyState, Modal, Input, Select, Textarea, Btn, SearchableSelect } from "../components/ui";

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

export default function TicketsView() {
  const { models, brands, users, items, createTicket, updateTicketStatus, addTicketComment, t } = useApp();
  const { user, profile, isAdmin } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", user_id: "", item_id: "", photos: [] });
  const [uploading, setUploading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentPhotos, setCommentPhotos] = useState([]);
  const [commentUploading, setCommentUploading] = useState(false);

  const [pagedTickets, setPagedTickets] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 20;

  const fetchPagedTickets = async () => {
    setLoading(true);
    try {
      let query = supabase.from("tickets").select("*, ticket_comments(count)", { count: "exact" });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchTerm.trim()) {
        const cleanSearch = searchTerm.trim().toUpperCase();
        // Si el usuario escribe TK-1001, extraemos el número 1001
        const numMatch = cleanSearch.match(/TK-(\d+)/) || cleanSearch.match(/(\d+)/);
        const ticketNum = numMatch ? parseInt(numMatch[1]) : null;

        if (ticketNum) {
          query = query.or(`title.ilike.%${cleanSearch}%,ticket_number.eq.${ticketNum}`);
        } else {
          query = query.ilike("title", `%${cleanSearch}%`);
        }
      }
      
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      setPagedTickets(data || []);
      setTotal(count || 0);
    } catch (err) { console.error("Ticket fetch error:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPagedTickets(); }, [page, statusFilter, searchTerm]);
  useEffect(() => { setPage(0); }, [statusFilter, searchTerm]);

  useEffect(() => {
    const handleUrlTicket = async () => {
      const params = new URLSearchParams(window.location.search);
      const tkId = params.get("ticket");
      if (tkId) {
        const { data } = await supabase.from("tickets").select("*").eq("id", tkId).single();
        if (data) {
          selectTicket(data);
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    };
    window.addEventListener("popstate", handleUrlTicket);
    setTimeout(handleUrlTicket, 500); 
    return () => window.removeEventListener("popstate", handleUrlTicket);
  }, []);

  // Auto-select first asset when user changes
  useEffect(() => {
    if (form.user_id && !form.item_id) {
      const userAssets = items.filter(i => i.user_id === form.user_id);
      if (userAssets.length > 0) {
        setForm(p => ({ ...p, item_id: userAssets[0].id }));
      }
    }
  }, [form.user_id, items]);

  const openNew = () => { setForm({ title: "", description: "", user_id: users[0]?.id || "", item_id: "", photos: [] }); setModalOpen(true); };

  const selectTicket = async (ticket) => {
    setDetailTicket(ticket);
    const { data: comments } = await supabase
      .from("ticket_comments")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at");
      
    let maintenanceItems = [];
    if (ticket.ticket_type === "maintenance") {
      const { data: mtItems } = await supabase
        .from("ticket_maintenance_items")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at");
      maintenanceItems = mtItems || [];
    }

    setDetailTicket(prev => prev ? { ...prev, comments: comments || [], maintenanceItems } : prev);
  };

  const toggleMaintenanceItem = async (mItem) => {
    const newVal = !mItem.is_completed;
    const { error } = await supabase.from("ticket_maintenance_items").update({ is_completed: newVal }).eq("id", mItem.id);
    if (!error) {
      if (newVal) {
        await supabase.from("items").update({ last_maintenance_date: new Date().toISOString() }).eq("id", mItem.item_id);
      }
      setDetailTicket(p => ({
        ...p,
        maintenanceItems: p.maintenanceItems.map(x => x.id === mItem.id ? { ...x, is_completed: newVal } : x)
      }));
    } else {
      alert("Error actualizando checklist");
    }
  };

  const updateMaintenanceNote = async (mItemId, note) => {
    setDetailTicket(p => ({
      ...p,
      maintenanceItems: p.maintenanceItems.map(x => x.id === mItemId ? { ...x, notes: note } : x)
    }));
  };

  const saveMaintenanceNote = async (mItemId) => {
    const item = detailTicket.maintenanceItems.find(x => x.id === mItemId);
    if (item) {
      await supabase.from("ticket_maintenance_items").update({ notes: item.notes }).eq("id", mItemId);
    }
  };

  const updateItemStatusFromMaintenance = async (itemId, newStatus) => {
    const { error } = await supabase.from("items").update({ status: newStatus }).eq("id", itemId);
    if (error) alert("Error cambiando estatus del equipo: " + error.message);
  };

  const uploadMaintenanceImages = async (mItemId, e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(files.map(f => uploadTicketPhoto(f)));
      const mItem = detailTicket.maintenanceItems.find(x => x.id === mItemId);
      const newImages = [...(mItem.images || []), ...uploadedUrls];
      
      await supabase.from("ticket_maintenance_items").update({ images: newImages }).eq("id", mItemId);
      
      setDetailTicket(p => ({
        ...p,
        maintenanceItems: p.maintenanceItems.map(x => x.id === mItemId ? { ...x, images: newImages } : x)
      }));
    } catch (err) {
      alert("Error adjuntando imagen de mantenimiento");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title || !form.user_id) return;
    setUploading(true);
    try {
      let uploadedUrls = [];
      if (form.photos && form.photos.length > 0) {
        uploadedUrls = await Promise.all(form.photos.map(p => uploadTicketPhoto(p.file)));
      }

      await createTicket({ 
        title: form.title, 
        description: form.description, 
        user_id: form.user_id, 
        item_id: form.item_id || null, 
        status: "Abierto",
        images: uploadedUrls
      });
      setModalOpen(false);
      fetchPagedTickets();
    } catch (err) {
      console.error(err);
      alert("Error subiendo imágenes: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const availableSlots = 3 - (form.photos?.length || 0);
    const toAdd = files.slice(0, availableSlots);
    if (files.length > availableSlots) alert("Solo puedes adjuntar un máximo de 3 imágenes.");
    const newPhotos = toAdd.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
    setForm(p => ({ ...p, photos: [...(p.photos || []), ...newPhotos] }));
  };

  const removePhoto = (index) => setForm(p => ({ ...p, photos: (p.photos || []).filter((_, i) => i !== index) }));

  const handleStatus = async (ticketId, status) => {
    await updateTicketStatus(ticketId, status);
    if (detailTicket?.id === ticketId) setDetailTicket(prev => prev ? { ...prev, status } : prev);
    setPagedTickets(p => p.map(t => t.id === ticketId ? { ...t, status } : t));
  };

  const handleComment = async (ticketId) => {
    if (!comment.trim() && commentPhotos.length === 0) return;
    setCommentUploading(true);
    try {
      let uploadedUrls = [];
      if (commentPhotos.length > 0) {
        uploadedUrls = await Promise.all(commentPhotos.map(p => uploadTicketPhoto(p.file)));
      }
      const data = await addTicketComment(ticketId, comment.trim(), true, profile.id, uploadedUrls);
      if (data && detailTicket?.id === ticketId) {
        setDetailTicket(prev => prev ? { ...prev, comments: [...(prev.comments || []), data] } : prev);
        setPagedTickets(p => p.map(t => t.id === ticketId ? { 
          ...t, 
          ticket_comments: [{ count: (t.ticket_comments?.[0]?.count || 0) + 1 }] 
        } : t));
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

  const userItemsForForm = isAdmin ? items : (form.user_id ? items.filter(i => i.user_id === form.user_id) : []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">Help Desk</h2>
          <p className="text-sm text-slate-500">{total} tickets</p>
        </div>
        <Btn onClick={openNew} className="w-full sm:w-auto"><Plus size={15} /> {t("newTicket")}</Btn>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex gap-2 flex-wrap flex-1">
          {["all", ...TICKET_STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-slate-800/30 text-slate-400 border border-slate-700/30 hover:bg-slate-800/50"}`}>
              {t(s)}
            </button>
          ))}
        </div>
        <div className="w-full md:w-64 relative">
          <input 
            type="text" 
            placeholder="Buscar folio (TK-...) o título..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-slate-800/30 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {pagedTickets.map(ticket => {
          const u = users.find(x => x.id === ticket.user_id);
          const item = ticket.item_id ? items.find(i => i.id === ticket.item_id) : null;
          const model = item ? models.find(m => m.id === item.model_id) : null;
          const TIcon = TICKET_COLORS[ticket.status]?.icon || AlertCircle;
          return (
            <button key={ticket.id} onClick={() => { selectTicket(ticket); setComment(""); }} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-[#151A24] border border-slate-700/50 hover:border-slate-600/50 transition-all text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: TICKET_COLORS[ticket.status]?.bg }}><TIcon size={18} style={{ color: TICKET_COLORS[ticket.status]?.text }} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">TK-{ticket.ticket_number}</span>
                  <p className="text-sm font-medium text-slate-200 truncate">{ticket.title}</p>
                  <StatusBadge status={ticket.status} type="ticket" />
                </div>
                <p className="text-xs text-slate-500 truncate">{u?.full_name || "—"} {model ? `· ${model.name}` : ""} · {new Date(ticket.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 text-slate-500"><MessageSquare size={14} /><span className="text-xs">{ticket.ticket_comments?.[0]?.count || 0}</span></div>
              <ChevronRight size={16} className="text-slate-600" />
            </button>
          );
        })}
        {pagedTickets.length === 0 && <EmptyState icon={Inbox} title={t("noResults")} subtitle={t("noResults")} />}

        {total > pageSize && (
          <div className="flex justify-center gap-2 pt-4">
               <button 
                disabled={page === 0 || loading}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl bg-slate-800/40 border border-slate-700 text-slate-300 disabled:opacity-50"
              >
                {t("previous")}
              </button>
              <button 
                disabled={(page + 1) * pageSize >= total || loading}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl bg-slate-800/40 border border-slate-700 text-slate-300 disabled:opacity-50"
              >
                {t("next")}
              </button>
          </div>
        )}
      </div>

      {/* New Ticket */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newTicket")}>
        <div className="space-y-4">
          <SearchableSelect 
            label={t("reportedBy")} 
            placeholder={t("select") + "..."}
            options={users.filter(u => u.is_active !== false).map(u => ({ 
              value: u.id, 
              label: u.full_name,
              sublabel: u.employee_number ? `No. Emp: ${u.employee_number}` : u.department || "",
              image: u.avatar_url || null 
            }))} 
            value={form.user_id} 
            onChange={e => setForm(p => ({ ...p, user_id: e.target.value, item_id: "" }))} 
          />
          <SearchableSelect 
            label={t("optionalAsset")} 
            placeholder={t("noneGeneral")}
            options={userItemsForForm.map(i => { 
                const m = models.find(x => x.id === i.model_id); 
                const b = m ? brands.find(x => x.id === m.brand_id) : null;
                return { 
                    value: i.id, 
                    label: `${b?.name || ""} ${m?.name || "—"}`, 
                    sublabel: `S/N: ${i.serial}`,
                    image: m?.photo
                }; 
            })} 
            value={form.item_id} 
            onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} 
          />
          <Input label={t("title")} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder={t("summaryPlaceholder")} />
          <Textarea label={t("description")} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder={t("detailPlaceholder")} />
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Evidencia (Máx. 3)</label>
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
            {(form.photos?.length || 0) === 0 && <p className="text-[10px] text-slate-500">Opcional: Adjuntar imágenes del problema.</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn>
            <Btn onClick={save} disabled={uploading}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {uploading ? "Creando..." : t("create")}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Detail */}
      <Modal open={!!detailTicket} onClose={() => setDetailTicket(null)} title={detailTicket ? `TK-${detailTicket.ticket_number} | ${detailTicket.title}` : ""} wide>
        {detailTicket && (() => {
          const u = users.find(x => x.id === detailTicket.user_id);
          const item = detailTicket.item_id ? items.find(i => i.id === detailTicket.item_id) : null;
          const model = item ? models.find(m => m.id === item.model_id) : null;
          const brand = model ? brands.find(b => b.id === model.brand_id) : null;
          const initials = u?.full_name ? u.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : "??";
          return (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={detailTicket.status} type="ticket" />
                  <span className="text-xs text-slate-500">{new Date(detailTicket.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{detailTicket.description}</p>
              </div>

              {detailTicket.images && detailTicket.images.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Evidencia Adjunta</h5>
                  <div className="flex flex-wrap gap-3">
                    {detailTicket.images.map((imgUrl, i) => (
                      <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block w-24 h-24 rounded-xl border border-slate-700/50 hover:border-blue-500/50 overflow-hidden transition-colors">
                        <img src={imgUrl} alt="Attached" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-3 rounded-xl bg-slate-800/20 border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">{initials}</div>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{u?.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{u?.department || u?.email}</p>
                    </div>
                  </div>
                  {model && (
                    <>
                      <div className="hidden sm:block w-px h-8 bg-slate-800" />
                      <div className="pt-2 sm:pt-0 border-t border-slate-800 sm:border-0">
                        <p className="text-sm text-slate-200">{brand?.name} {model.name}</p>
                        <p className="text-xs font-mono text-slate-500">{item.serial}</p>
                      </div>
                    </>
                  )}
                </div>
              <div className="flex gap-2">{TICKET_STATUSES.map(s => <Btn key={s} variant={detailTicket.status === s ? "primary" : "secondary"} size="sm" onClick={() => handleStatus(detailTicket.id, s)}>{t(s)}</Btn>)}</div>
              
              {detailTicket.ticket_type === "maintenance" && detailTicket.maintenanceItems && detailTicket.maintenanceItems.length > 0 && (
                <div className="pt-4 border-t border-slate-700/30">
                  <h5 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    Checklist de Mantenimiento Previsto
                  </h5>
                  <div className="space-y-4">
                    {detailTicket.maintenanceItems.map(mItem => {
                      const mItmObj = items.find(i => i.id === mItem.item_id);
                      if (!mItmObj) return null;
                      const mMod = models.find(m => m.id === mItmObj.model_id);
                      const mBrand = mMod ? brands.find(b => b.id === mMod.brand_id) : null;
                      
                      return (
                        <div key={mItem.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                          <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center border-b border-slate-700/50 pb-3 mb-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${mItem.is_completed ? "bg-emerald-500 border-emerald-500" : "bg-transparent border-slate-500 group-hover:border-emerald-500"}`}>
                                {mItem.is_completed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                              <input type="checkbox" className="hidden" checked={!!mItem.is_completed} onChange={() => toggleMaintenanceItem(mItem)} />
                              <div>
                                <p className={`text-sm font-medium transition-colors ${mItem.is_completed ? "text-slate-400 line-through" : "text-slate-200"}`}>
                                  {mBrand?.name} {mMod?.name}
                                </p>
                                <p className="text-xs text-slate-500">S/N: {mItmObj.serial}</p>
                              </div>
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 shrink-0">Estatus Físico:</span>
                              <select 
                                value={mItmObj.status}
                                onChange={(e) => updateItemStatusFromMaintenance(mItmObj.id, e.target.value)}
                                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 outline-none"
                              >
                                <option value="Disponible">Disponible</option>
                                <option value="Asignado">Asignado</option>
                                <option value="Mantenimiento">Mantenimiento</option>
                                <option value="Baja">Baja</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <textarea
                                value={mItem.notes || ""}
                                onChange={(e) => updateMaintenanceNote(mItem.id, e.target.value)}
                                onBlur={() => saveMaintenanceNote(mItem.id)}
                                placeholder="Añadir notas técnicas (ej. Se limpiaron ventiladores, requiere pasta térmica...)"
                                className="w-full h-16 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 resize-none"
                              />
                            </div>
                            
                            <div className="flex gap-3 flex-wrap">
                              {(mItem.images || []).map((imgUrl, i) => (
                                <a key={i} href={imgUrl} target="_blank" rel="noreferrer" className="block w-14 h-14 rounded-lg border border-slate-700/50 hover:border-purple-500/50 overflow-hidden">
                                  <img src={imgUrl} alt="Evidencia" className="w-full h-full object-cover" />
                                </a>
                              ))}
                              
                              <label className="w-14 h-14 rounded-lg border border-dashed border-slate-700/50 flex flex-col items-center justify-center text-slate-500 hover:text-purple-400 hover:border-purple-500/50 cursor-pointer transition-colors bg-slate-900/30">
                                <Plus size={16} />
                                <span className="text-[9px] mt-1">Someter</span>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => uploadMaintenanceImages(mItem.id, e)} />
                              </label>
                            </div>
                          </div>

                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div>
                <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">{t("conversation")} ({detailTicket.comments?.length || 0})</h5>
                <div className="space-y-3 max-h-60 overflow-y-auto mb-4">
                  {(detailTicket.comments || []).map(c => {
                    const cUser = c.is_staff ? { name: "Soporte IT", avatar: "IT" } : users.find(x => x.id === c.user_id);
                    const cInitials = cUser?.full_name ? cUser.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : cUser?.avatar || "??";
                    const cName = cUser?.full_name || cUser?.name || "Usuario";
                    return (
                      <div key={c.id} className={`flex gap-3 ${c.is_staff ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${c.is_staff ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>{cInitials}</div>
                        <div className={`max-w-[75%] p-3 rounded-xl ${c.is_staff ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-slate-800/30 border border-slate-700/30"}`}>
                          <div className="flex items-center gap-2 mb-1"><span className="text-xs font-medium text-slate-300">{cName}</span><span className="text-[10px] text-slate-600">{new Date(c.created_at).toLocaleString()}</span></div>
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
                  {(!detailTicket.comments || detailTicket.comments.length === 0) && <p className="text-sm text-slate-500 text-center py-4">{t("noComments")}</p>}
                </div>
                {commentPhotos.length > 0 && (
                  <div className="flex gap-3 mb-2 p-2 bg-slate-800/20 rounded-xl border border-slate-700/30">
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
                  <label className="flex items-center justify-center bg-slate-800/40 border border-slate-700/50 rounded-xl px-3 hover:bg-slate-700/40 cursor-pointer text-slate-400 hover:text-slate-200 transition-colors">
                    <Plus size={16} />
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleCommentPhotoSelect} />
                  </label>
                  <input disabled={commentUploading} value={comment} onChange={e => setComment(e.target.value)} placeholder={t("replyAsSupport")} className="flex-1 px-3 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 disabled:opacity-50" onKeyDown={e => e.key === "Enter" && handleComment(detailTicket.id)} />
                  <Btn onClick={() => handleComment(detailTicket.id)} disabled={commentUploading || (!comment.trim() && commentPhotos.length === 0)}>
                    {commentUploading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </Btn>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
