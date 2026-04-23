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
  const [systemSettings, setSystemSettings] = useState({});

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
      
      // Intentar cargar configs del sistema sin fallar si no existe (por migración pendiente)
      const settingsPromise = supabase.from("system_settings").select("*");
      promises.push(settingsPromise);

      if (forceMetadata || !brands.length) {
        promises.push(syncMetadata());
      }

      const resAll = await Promise.all(promises);
      const [iRes, tRes, uRes, mRes, rRes, mvRes, sysRes] = resAll;

      if (iRes?.data) setItems(iRes.data);
      if (tRes?.data) setTickets(tRes.data); 
      if (uRes?.data) setUsers(uRes.data);
      if (mRes?.data) setModels(mRes.data);
      if (rRes?.data) setRelations(rRes.data);
      if (mvRes?.data) setMovements(mvRes.data);
      
      if (sysRes?.data) {
        const settingsMap = {};
        sysRes.data.forEach(s => settingsMap[s.setting_key] = s.setting_value);
        setSystemSettings(settingsMap);
      }
      
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
    
    let statsTimeout;
    const debouncedStats = () => {
      clearTimeout(statsTimeout);
      statsTimeout = setTimeout(fetchDashboardStats, 2000);
    };

    const ch = supabase.channel("itam-rt")
      // ── TICKETS ──
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, async (payload) => {
        const newT = payload.new;
        // Notificación para Admins
        if (isAdmin) {
          const u = users.find(x => x.id === newT.user_id);
          setUnreadNotifications(prev => {
            if (prev.some(n => n.id === newT.id)) return prev;
            return [{
              id: newT.id, ticket_id: newT.id, title: "Nuevo Ticket", ticket_number: newT.ticket_number,
              user_name: u?.full_name || "Usuario", created_at: newT.created_at, type: "new_ticket"
            }, ...prev].slice(0, 10);
          });
        }
        // Actualización atómica de la lista
        setTickets(prev => [newT, ...prev].slice(0, 100));
        debouncedStats();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, async (payload) => {
        const newT = payload.new;
        // Notificación de cambio de estatus para el usuario
        if (!isAdmin && newT.user_id === session?.user?.id && newT.status !== payload.old?.status) {
          setUnreadNotifications(p => {
            const id = newT.id + "_status";
            if (p.some(n => n.id === id)) return p;
            return [{
              id, ticket_id: newT.id, title: "Estatus: " + newT.status,
              ticket_number: newT.ticket_number, type: "status", created_at: new Date().toISOString()
            }, ...p].slice(0, 10);
          });
        }
        setTickets(prev => prev.map(t => t.id === newT.id ? { ...t, ...newT } : t));
        debouncedStats();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tickets" }, (payload) => {
        setTickets(prev => prev.filter(t => t.id !== payload.old.id));
        debouncedStats();
      })

      // ── COMMENTS (For notifications) ──
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_comments" }, async (payload) => {
        const newC = payload.new;
        // Buscamos el ticket para la notificación
        const { data: ticket } = await supabase.from("tickets").select("id, title, ticket_number, user_id").eq("id", newC.ticket_id).single();
        if (ticket) {
          const isForMe = (!isAdmin && newC.is_staff && ticket.user_id === session?.user?.id) ||
                          (isAdmin && !newC.is_staff);
          if (isForMe) {
            setUnreadNotifications(p => [{
              id: newC.id, ticket_id: ticket.id, 
              title: isAdmin ? "Nuevo comentario" : "IT respondió",
              ticket_number: ticket.ticket_number, type: "new_comment", created_at: newC.created_at
            }, ...p].slice(0, 10));
          }
        }
        // Forzamos actualización ligera de tickets para refrescar el conteo de comentarios
        setTickets(prev => prev.map(t => t.id === newC.ticket_id ? { ...t, updated_at: new Date().toISOString() } : t));
      })

      // ── INVENTARIO (Items) ──
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setItems(prev => [payload.new, ...prev].slice(0, 300));
        } else if (payload.eventType === "UPDATE") {
          setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new : i));
        } else if (payload.eventType === "DELETE") {
          setItems(prev => prev.filter(i => i.id !== payload.old.id));
        }
        debouncedStats();
      })

      // ── USUARIOS/PROFILES ──
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setUsers(prev => [...prev, payload.new].sort((a,b) => (a.full_name||'').localeCompare(b.full_name||'')));
        } else if (payload.eventType === "UPDATE") {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new : u));
        } else if (payload.eventType === "DELETE") {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
        }
      })

      // ── AREAS ──
      .on("postgres_changes", { event: "*", schema: "public", table: "areas" }, (payload) => {
        if (payload.eventType === "INSERT") setAreas(prev => { const n = [...prev, payload.new].sort((a,b)=>a.name.localeCompare(b.name)); localStorage.setItem("itam_areas", JSON.stringify(n)); return n; });
        if (payload.eventType === "UPDATE") setAreas(prev => { const n = prev.map(a => a.id === payload.new.id ? payload.new : a).sort((a,b)=>a.name.localeCompare(b.name)); localStorage.setItem("itam_areas", JSON.stringify(n)); return n; });
        if (payload.eventType === "DELETE") setAreas(prev => { const n = prev.filter(a => a.id !== payload.old.id); localStorage.setItem("itam_areas", JSON.stringify(n)); return n; });
      })
      
      // ── SYSTEM SETTINGS ──
      .on("postgres_changes", { event: "*", schema: "public", table: "system_settings" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          setSystemSettings(prev => ({ ...prev, [payload.new.setting_key]: payload.new.setting_value }));
        }
        if (payload.eventType === "DELETE") {
          setSystemSettings(prev => {
            const next = {...prev};
            delete next[payload.old.setting_key];
            return next;
          });
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "brands" }, syncMetadata)
      .on("postgres_changes", { event: "*", schema: "public", table: "asset_types" }, syncMetadata)
      .subscribe();

    return () => { 
      if (statsTimeout) clearTimeout(statsTimeout);
      supabase.removeChannel(ch); 
    };
  }, [session, isAdmin, users.length, syncMetadata, fetchDashboardStats]);

  // ── Brands CRUD ──
  const createBrand = async (name) => {
    const { data, error } = await supabase.from("brands").insert({ name }).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setBrands(p => {
      const next = [...p, data].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem("itam_brands", JSON.stringify(next));
      return next;
    });
    showToast("brandCreated"); return data;
  };
  const updateBrand = async (id, name) => {
    const { error } = await supabase.from("brands").update({ name }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setBrands(p => {
      const next = p.map(b => b.id === id ? { ...b, name } : b);
      localStorage.setItem("itam_brands", JSON.stringify(next));
      return next;
    });
    showToast("brandUpdated");
  };
  const deleteBrand = async (id) => {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setBrands(p => {
      const next = p.filter(b => b.id !== id);
      localStorage.setItem("itam_brands", JSON.stringify(next));
      return next;
    });
    showToast("brandDeleted", "error");
  };

  // ── Asset Types CRUD ──
  const createAssetType = async (name) => {
    const { data, error } = await supabase.from("asset_types").insert({ name }).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setAssetTypes(p => {
      const next = [...p, data].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem("itam_types", JSON.stringify(next));
      return next;
    });
    showToast("typeCreated"); return data;
  };
  const updateAssetType = async (id, name) => {
    const { error } = await supabase.from("asset_types").update({ name }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAssetTypes(p => {
      const next = p.map(a => a.id === id ? { ...a, name } : a);
      localStorage.setItem("itam_types", JSON.stringify(next));
      return next;
    });
    showToast("typeUpdated");
  };
  const deleteAssetType = async (id) => {
    const { error } = await supabase.from("asset_types").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAssetTypes(p => {
      const next = p.filter(a => a.id !== id);
      localStorage.setItem("itam_types", JSON.stringify(next));
      return next;
    });
    showToast("typeDeleted", "error");
  };

  // ── Areas CRUD ──
  const createArea = async (name) => {
    const { data, error } = await supabase.from("areas").insert({ name }).select().single();
    if (error) {
      if (error.code === "23505") {
        showToast('Área ya existe', 'error');
        await syncMetadata();
        throw new Error('Área ya existe');
      }
      showToast(error.message, "error");
      throw new Error(error.message);
    }
    setAreas(p => {
      const next = [...p, data].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem("itam_areas", JSON.stringify(next));
      return next;
    });
    showToast("areaCreated");
    return data;
  };
  const updateArea = async (id, name) => {
    const { error } = await supabase.from("areas").update({ name }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAreas(p => {
      const next = p.map(a => a.id === id ? { ...a, name } : a);
      localStorage.setItem("itam_areas", JSON.stringify(next));
      return next;
    });
    showToast("areaUpdated");
  };
  const deleteArea = async (id) => {
    const { error } = await supabase.from("areas").delete().eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setAreas(p => {
      const next = p.filter(a => a.id !== id);
      localStorage.setItem("itam_areas", JSON.stringify(next));
      return next;
    });
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
      // If the update involves a user or area change, we make the note more descriptive if it's not already
      let finalNote = movementNote;
      if (updates.user_id && !movementNote.includes("Asignado a usuario")) {
        const u = users.find(x => x.id === updates.user_id);
        if (u) finalNote = `Asignado a usuario: ${u.full_name}`;
      } else if (updates.area_id && !movementNote.includes("Asignado a área")) {
        const a = areas.find(x => x.id === updates.area_id);
        if (a) finalNote = `Asignado a área: ${a.name}`;
      }

      await supabase.from("movements").insert({ 
        item_id: id, 
        user_id: updates.user_id || null, 
        action: updates.status || "Actualizado", 
        note: finalNote 
      });
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
    
    // Register movement if ticket is associated with an asset
    if (data.item_id) {
       await supabase.from("movements").insert({
         item_id: data.item_id,
         user_id: data.user_id,
         action: "Ticket",
         note: `Ticket [TK-${data.ticket_number}] generado: ${data.title}`
       });
       // Refresh movements
       const { data: mvData } = await supabase.from("movements").select("*").order("created_at", { ascending: false }).limit(100);
       if (mvData) setMovements(mvData);
    }

    setTickets(p => [{ ...data, comments: [] }, ...p]);
    showToast("ticketCreated");

    // Notificación al departamento de TI
    const u = users.find(x => x.id === data.user_id);
    fetch("/api/send-ticket-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        to: "itdept@prosper-mfg.com", 
        userName: u?.full_name || "Usuario", 
        ticketTitle: data.title, 
        ticketNumber: data.ticket_number,
        ticketId: data.id,
        type: "new_ticket" 
      })
    }).catch(e => console.error("[Notification] Error enviando alerta a TI:", e));

    return data;
  };
  const updateTicketStatus = async (id, status) => {
    const ticket = tickets.find(t => t.id === id);
    const oldStatus = ticket?.status;
    const updates = { status, updated_at: new Date().toISOString() };

    // Performance metrics
    if (status === "Proceso" && !ticket.responded_at) {
      updates.responded_at = new Date().toISOString();
    }
    if (status === "Cerrado") {
      updates.closed_at = new Date().toISOString();
      updates.closed_by = session?.user?.id;
    }

    const { error } = await supabase.from("tickets").update(updates).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    
    setTickets(p => p.map(t => t.id === id ? { ...t, ...updates } : t));
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

  const updateSystemSetting = async (key, value) => {
    const { error } = await supabase.from("system_settings").upsert({ setting_key: key, setting_value: value });
    if (error) { showToast(error.message, "error"); return; }
    setSystemSettings(prev => ({ ...prev, [key]: value }));
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
      systemSettings, updateSystemSetting,
      createBrand, updateBrand, deleteBrand,
      createAssetType, updateAssetType, deleteAssetType,
      createArea, updateArea, deleteArea,
      createModel, updateModel, deleteModel,
      createItem, updateItem, deleteItem,
      createRelation, deleteRelation,
      createTicket, updateTicketStatus, addTicketComment,
      updateUserProfile, toggleUserActive, deleteUserProfile,
      checkGuestStatus: async (empNo) => {
        const { data, error } = await supabase.rpc('check_guest_status', { p_emp_no: empNo });
        if (error) { showToast(error.message, "error"); return null; }
        return data;
      },
      createGuestTicket: async (ticketData) => {
        const { data, error } = await supabase.rpc('create_guest_ticket', {
          p_emp_no: ticketData.employee_number,
          p_title: ticketData.title,
          p_desc: ticketData.description,
          p_images: ticketData.images || []
        });
        if (error) { showToast(error.message, "error"); return null; }
        showToast("ticketCreated");

        // Notificación al departamento de TI (Modo Invitado)
        if (data?.success && data?.ticket_id) {
          fetch("/api/send-ticket-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              to: "itdept@prosper-mfg.com", 
              userName: data.requester_name || `Invitado (No. Emp: ${ticketData.employee_number})`, 
              ticketTitle: data.title || ticketData.title, 
              ticketNumber: data.ticket_number,
              ticketId: data.ticket_id,
              type: "new_ticket" 
            })
          }).catch(e => console.error("[Notification] Error enviando alerta a TI (Invitado):", e));
        }

        return data;
      },
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
