import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { translations } from "../data/translations";

const AppContext = createContext();

export function AppProvider({ children }) {
  const { session, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState(() => JSON.parse(localStorage.getItem("itam_brands") || "[]"));
  const [assetTypes, setAssetTypes] = useState(() => JSON.parse(localStorage.getItem("itam_types") || "[]"));
  const [areas, setAreas] = useState(() => JSON.parse(localStorage.getItem("itam_areas") || "[]"));
  const [users, setUsers] = useState([]);
  const [relations, setRelations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem("itam_unread_notifications");
      if (!saved || saved === "undefined" || saved === "null") return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  });
  const [movements, setMovements] = useState([]);
  const [toast, setToast] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({ items: 0, tickets: 0, pending: 0, active: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem("itam_lang") || "es");

  const t = useMemo(() => (key) => translations[language][key] || key, [language]);

  const toggleLanguage = useCallback(() => {
    const next = language === "es" ? "en" : "es";
    setLanguage(next);
    localStorage.setItem("itam_lang", next);
  }, [language]);

  const showToast = useCallback((message, type = "success") => {
    // If message is a key in translations, translate it
    const translated = translations[language][message] || message;
    setToast({ message: translated, type });
  }, [language]);
  const clearToast = useCallback(() => setToast(null), []);

  const syncMetadata = useCallback(async () => {
    if (!session) return;
    try {
      const [bRes, aRes, arRes] = await Promise.all([
        supabase.from("brands").select("*").order("name"),
        supabase.from("asset_types").select("*").order("name"),
        supabase.from("areas").select("*").order("name"),
      ]);
      if (bRes.data) { setBrands(bRes.data); localStorage.setItem("itam_brands", JSON.stringify(bRes.data)); }
      if (aRes.data) { setAssetTypes(aRes.data); localStorage.setItem("itam_types", JSON.stringify(aRes.data)); }
      if (arRes.data) { setAreas(arRes.data); localStorage.setItem("itam_areas", JSON.stringify(arRes.data)); }
    } catch (err) { console.error("Metadata sync error:", err); }
  }, [session]);

  const fetchDashboardStats = useCallback(async () => {
    if (!session) return;
    try {
      const [itemsCount, ticketsCount, pendingCount, activeCount] = await Promise.all([
        supabase.from("items").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["Abierto", "Proceso"]),
        supabase.from("items").select("*", { count: "exact", head: true }).eq("status", "Asignado"),
      ]);
      setDashboardStats({
        items: itemsCount.count || 0,
        tickets: ticketsCount.count || 0,
        pending: pendingCount.count || 0,
        active: activeCount.count || 0
      });
    } catch (err) { console.error("Stats error:", err); }
  }, [session]);

  const fetchAll = useCallback(async (options = {}) => {
    if (!session) return;
    const { showLoader = false, forceMetadata = false } = options;
    if (showLoader) setDataLoading(true);

    try {
      const promises = [
        supabase.from("items").select("*").order("created_at", { ascending: false }).limit(200), // LIMIT for performance
        supabase.from("tickets").select("*, ticket_comments(count)").order("created_at", { ascending: false }).limit(50), 
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("models").select("*").order("name"),
        supabase.from("asset_relations").select("*"),
        supabase.from("movements").select("*").order("created_at", { ascending: false }).limit(100),
      ];

      if (forceMetadata || !brands.length) {
        promises.push(syncMetadata());
      }

      const [iRes, tRes, uRes, mRes, rRes, mvRes] = await Promise.all(promises);

      if (iRes.data) setItems(iRes.data);
      if (tRes.data) setTickets(tRes.data); // Simplified tickets for now, comments paged later
      if (uRes.data) setUsers(uRes.data);
      if (mRes.data) setModels(mRes.data);
      if (rRes.data) setRelations(rRes.data);
      if (mvRes.data) setMovements(mvRes.data);
      
      await fetchDashboardStats();
    } catch (err) { 
      console.error("Fetch error:", err); 
    } finally {
      setDataLoading(false);
    }
  }, [session, brands.length, syncMetadata, fetchDashboardStats]);

  useEffect(() => { 
    if (session) {
      if (brands.length > 0) {
        // We have cached metadata, show app faster
        setDataLoading(false);
        fetchAll({ showLoader: false });
      } else {
        fetchAll({ showLoader: true }); 
      }
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem("itam_unread_notifications", JSON.stringify(unreadNotifications));
  }, [unreadNotifications]);

  useEffect(() => {
    if (!session) return;
    
    let timeout;
    const debouncedFetch = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fetchAll({ showLoader: false }), 1500);
    };

    const handleNewTicket = async (payload) => {
      if (!isAdmin) return; // For now only admins get "new ticket" alerts
      
      const newT = payload.new;
      // Evitar duplicados si ya está en la lista (evita ráfagas)
      setUnreadNotifications(prev => {
        if (prev.some(n => n.id === newT.id)) return prev;
        
        const u = users.find(x => x.id === newT.user_id);
        const notification = {
          id: newT.id,
          ticket_id: newT.id,
          title: newT.title,
          ticket_number: newT.ticket_number,
          user_name: u?.full_name || "Usuario",
          created_at: newT.created_at,
          type: "new_ticket"
        };
        return [notification, ...prev].slice(0, 10); // Mantener máximo 10
      });
      debouncedFetch();
    };

    const ch = supabase.channel("itam-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, handleNewTicket)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, async (payload) => {
        if (!isAdmin && payload.new.user_id === session?.user?.id && payload.new.status !== payload.old?.status) {
          setUnreadNotifications(p => {
            if (p.some(n => n.id === payload.new.id + "_status")) return p;
            return [{ id: payload.new.id + "_status", ticket_id: payload.new.id, title: "Cambio de Estatus: " + payload.new.status, ticket_number: payload.new.ticket_number, created_at: new Date().toISOString(), type: "status" }, ...p].slice(0, 10);
          });
        }
        debouncedFetch();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tickets" }, debouncedFetch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_comments" }, async (payload) => {
        const newC = payload.new;
        const { data: ticket } = await supabase.from("tickets").select("*").eq("id", newC.ticket_id).single();
        if (ticket) {
          if (!isAdmin && newC.is_staff && ticket.user_id === session?.user?.id) {
             setUnreadNotifications(p => [{
                id: newC.id, ticket_id: ticket.id, title: "IT respondió a tu ticket", ticket_number: ticket.ticket_number, type: "new_comment", created_at: newC.created_at
             }, ...p].slice(0, 10));
          } else if (isAdmin && !newC.is_staff) {
             setUnreadNotifications(p => [{
                id: newC.id, ticket_id: ticket.id, title: "Nuevo comentario del usuario", ticket_number: ticket.ticket_number, type: "new_comment", created_at: newC.created_at
             }, ...p].slice(0, 10));
          }
        }
        debouncedFetch();
      })
      .subscribe();

    return () => { 
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(ch); 
    };
  }, [session, fetchAll, isAdmin, users]);

  // ── Brands CRUD ──
  const createBrand = async (name) => {
    const { data, error } = await supabase.from("brands").insert({ name }).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setBrands(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    showToast("brandCreated"); return data;
  };
  const updateBrand = async (id, name) => {
    const { error } = await supabase.from("brands").update({ name }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setBrands(p => p.map(b => b.id === id ? { ...b, name } : b));
    showToast("brandUpdated");
  };
  const deleteBrand = async (id) => {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setBrands(p => p.filter(b => b.id !== id));
    showToast("brandDeleted", "error");
  };

  // ── Asset Types CRUD ──
  const createAssetType = async (name) => {
    const { data, error } = await supabase.from("asset_types").insert({ name }).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setAssetTypes(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    showToast("typeCreated"); return data;
  };
  const updateAssetType = async (id, name) => {
    const { error } = await supabase.from("asset_types").update({ name }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAssetTypes(p => p.map(a => a.id === id ? { ...a, name } : a));
    showToast("typeUpdated");
  };
  const deleteAssetType = async (id) => {
    const { error } = await supabase.from("asset_types").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAssetTypes(p => p.filter(a => a.id !== id));
    showToast("typeDeleted", "error");
  };

  // ── Areas CRUD ──
  const createArea = async (name) => {
    const { data, error } = await supabase.from("areas").insert({ name }).select().single();
    if (error) {
      // Supabase duplicate key error code is 23505
      if (error.code === "23505") {
        showToast('Área ya existe', 'error');
        // Refresh areas to ensure UI reflects existing entry
        await syncMetadata();
        throw new Error('Área ya existe');
      }
      showToast(error.message, "error");
      throw new Error(error.message);
    }
    setAreas(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    showToast("areaCreated");
    return data;
  };
  const updateArea = async (id, name) => {
    const { error } = await supabase.from("areas").update({ name }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAreas(p => p.map(a => a.id === id ? { ...a, name } : a));
    showToast("areaUpdated");
  };
  const deleteArea = async (id) => {
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAreas(p => p.filter(a => a.id !== id));
    showToast("areaDeleted", "error");
  };

  // ── Models CRUD ──
  const createModel = async (model) => {
    const { data, error } = await supabase.from("models").insert(model).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setModels(p => [...p, data]); showToast("modelCreated"); return data;
  };
  const updateModel = async (id, updates) => {
    const { error } = await supabase.from("models").update(updates).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setModels(p => p.map(m => m.id === id ? { ...m, ...updates } : m));
    showToast("modelUpdated");
  };
  const deleteModel = async (id) => {
    const { error } = await supabase.from("models").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setModels(p => p.filter(m => m.id !== id));
    showToast("modelDeleted", "error");
  };

  // ── Items CRUD ──
  const createItem = async (item) => {
    const { data, error } = await supabase.from("items").insert(item).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setItems(p => [data, ...p]);
    await supabase.from("movements").insert({ item_id: data.id, user_id: item.user_id, action: "Registrado", note: "Registro inicial" });
    await fetchAll(); showToast("itemRegistered"); return data;
  };
  const updateItem = async (id, updates, movementNote) => {
    const { error } = await supabase.from("items").update(updates).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setItems(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
    if (movementNote) {
      await supabase.from("movements").insert({ item_id: id, user_id: updates.user_id || null, action: updates.status || "Actualizado", note: movementNote });
      const { data: mvs } = await supabase.from("movements").select("*").order("created_at", { ascending: false });
      if (mvs) setMovements(mvs);
    }
    showToast("itemUpdated");
  };
  const deleteItem = async (id) => {
    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setItems(p => p.filter(i => i.id !== id));
    showToast("itemDeleted", "error");
  };

  // ── Relations ──
  const createRelation = async (rel) => {
    const { data, error } = await supabase.from("asset_relations").insert(rel).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setRelations(p => [...p, data]); showToast("relationCreated"); return data;
  };
  const deleteRelation = async (id) => {
    const { error } = await supabase.from("asset_relations").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setRelations(p => p.filter(r => r.id !== id));
    showToast("relationDeleted", "error");
  };

  // ── Tickets ──
  const createTicket = async (ticket) => {
    const { data, error } = await supabase.from("tickets").insert(ticket).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setTickets(p => [{ ...data, comments: [] }, ...p]);
    showToast("ticketCreated"); return data;
  };
  const updateTicketStatus = async (id, status) => {
    const ticket = tickets.find(t => t.id === id);
    const oldStatus = ticket?.status;
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setTickets(p => p.map(t => t.id === id ? { ...t, status } : t));
    showToast(`Ticket → ${status}`);

    // Notificación robusta de cambio de estatus
    if (ticket) {
      const u = users.find(x => x.id === ticket.user_id);
      if (u?.email) {
        console.log(`[Notification] Enviando cambio de estatus a ${u.email}...`);
        fetch("/api/send-ticket-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: u.email, userName: u.full_name, ticketTitle: ticket.title, oldStatus, newStatus: status, type: "status" })
        })
        .then(r => r.json())
        .then(res => console.log("[Notification] Respuesta API:", res))
        .catch(e => console.error("[Notification] Error enviando correo:", e));
      } else {
        console.warn("[Notification] No se encontró el correo del usuario para el ticket", id);
      }
    }
  };
  const addTicketComment = async (ticketId, text, isStaff, userId, images = []) => {
    const { data, error } = await supabase.from("ticket_comments")
      .insert({ ticket_id: ticketId, user_id: userId, text, is_staff: isStaff, images }).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setTickets(p => p.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          comments: [...(t.comments || []), data],
          ticket_comments: [{ count: (t.ticket_comments?.[0]?.count || 0) + 1 }]
        };
      }
      return t;
    }));
    showToast("commentAdded"); 

    // Notificación al usuario si IT respondió
    if (isStaff) {
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
        const u = users.find(x => x.id === ticket.user_id);
        if (u?.email) {
          console.log(`[Notification] Enviando respuesta de IT a ${u.email}...`);
          fetch("/api/send-ticket-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: u.email, userName: u.full_name, ticketTitle: ticket.title, commentText: text, type: "comment" })
          })
          .then(r => r.json())
          .then(res => console.log("[Notification] Respuesta API (comentario):", res))
          .catch(e => console.error("[Notification] Error enviando respuesta de IT:", e));
        } else {
          console.warn("[Notification] No se encontró el correo del usuario para notificar respuesta.");
        }
      }
    }
    return data;
  };

  // ── Users (admin) ──
  const updateUserProfile = async (id, updates) => {
    const { error } = await supabase.from("profiles").update(updates).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setUsers(p => p.map(u => u.id === id ? { ...u, ...updates } : u));
    showToast("userUpdated");
  };
  const toggleUserActive = async (id, active) => {
    const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setUsers(p => p.map(u => u.id === id ? { ...u, is_active: active } : u));
    showToast(active ? "userActivated" : "userDeactivated");
  };
  const deleteUserProfile = async (id) => {
    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) return;

    // 1. Delete from Auth (if they have a mapping)
    const targetAuthId = userToDelete.auth_id || userToDelete.id;
    try {
      await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteUser", userId: targetAuthId })
      });
    } catch (e) {
      console.warn("Could not delete from Auth (might not have an account), proceeding with profile deletion:", e.message);
    }

    // 2. Delete from Profiles
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }

    // 3. Update Local State
    setUsers(p => p.filter(u => u.id !== id));
    setItems(p => p.map(i => i.user_id === id ? { ...i, user_id: null, status: "Disponible" } : i));
    setTickets(p => p.map(t => t.user_id === id ? { ...t, user_id: null } : t));
    
    showToast("userDeleted", "error");
  };

  useEffect(() => {
    localStorage.setItem("itam_unread_notifications", JSON.stringify(unreadNotifications));
  }, [unreadNotifications]);

  const clearNotifications = () => setUnreadNotifications([]);
  const markNotificationRead = (id) => setUnreadNotifications(prev => prev.filter(n => n.id !== id));

  return (
    <AppContext.Provider value={{
      items, models, brands, assetTypes, areas, users, relations, tickets, movements,
      dataLoading, showToast, clearToast, toast, fetchAll, dashboardStats, fetchDashboardStats, syncMetadata,
      language, t, toggleLanguage,
      unreadNotifications, clearNotifications, markNotificationRead,
      createBrand, updateBrand, deleteBrand,
      createAssetType, updateAssetType, deleteAssetType,
      createArea, updateArea, deleteArea,
      createModel, updateModel, deleteModel,
      createItem, updateItem, deleteItem,
      createRelation, deleteRelation,
      createTicket, updateTicketStatus, addTicketComment,
      updateUserProfile, toggleUserActive, deleteUserProfile,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
