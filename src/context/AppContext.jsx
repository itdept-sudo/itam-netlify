import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { translations } from "../data/translations";

const AppContext = createContext();

export function AppProvider({ children }) {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [models, setModels] = useState([]);
  const [brands, setBrands] = useState([]);
  const [assetTypes, setAssetTypes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [users, setUsers] = useState([]);
  const [relations, setRelations] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [movements, setMovements] = useState([]);
  const [toast, setToast] = useState(null);
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

  const fetchAll = useCallback(async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const [bRes, mRes, aRes, arRes, iRes, uRes, rRes, tRes, mvRes] = await Promise.all([
        supabase.from("brands").select("*").order("name"),
        supabase.from("models").select("*").order("name"),
        supabase.from("asset_types").select("*").order("name"),
        supabase.from("areas").select("*").order("name"),
        supabase.from("items").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("asset_relations").select("*"),
        supabase.from("tickets").select("*").order("created_at", { ascending: false }),
        supabase.from("movements").select("*").order("created_at", { ascending: false }),
      ]);
      setBrands(bRes.data || []);
      setModels(mRes.data || []);
      setAssetTypes(aRes.data || []);
      setAreas(arRes.data || []);
      setItems(iRes.data || []);
      setUsers(uRes.data || []);
      setRelations(rRes.data || []);
      setMovements(mvRes.data || []);

      if (tRes.data?.length) {
        const { data: comments } = await supabase
          .from("ticket_comments").select("*")
          .in("ticket_id", tRes.data.map(t => t.id))
          .order("created_at");
        setTickets(tRes.data.map(t => ({ ...t, comments: (comments || []).filter(c => c.ticket_id === t.id) })));
      } else {
        setTickets([]);
      }
    } catch (err) { console.error("Fetch error:", err); }
    setDataLoading(false);
  }, [session]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel("itam-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchAll())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_comments" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, fetchAll]);

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
    if (error) { showToast(error.message, "error"); return null; }
    setAreas(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    showToast("areaCreated"); return data;
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
    const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
    if (error) { showToast(error.message, "error"); return; }
    setTickets(p => p.map(t => t.id === id ? { ...t, status } : t));
    showToast(`Ticket → ${status}`);
  };
  const addTicketComment = async (ticketId, text, isStaff, userId) => {
    const { data, error } = await supabase.from("ticket_comments")
      .insert({ ticket_id: ticketId, user_id: userId, text, is_staff: isStaff }).select().single();
    if (error) { showToast(error.message, "error"); return null; }
    setTickets(p => p.map(t => t.id === ticketId ? { ...t, comments: [...t.comments, data] } : t));
    showToast("commentAdded"); return data;
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

  return (
    <AppContext.Provider value={{
      items, models, brands, assetTypes, areas, users, relations, tickets, movements,
      dataLoading, showToast, clearToast, toast, fetchAll,
      language, t, toggleLanguage,
      createBrand, updateBrand, deleteBrand,
      createAssetType, updateAssetType, deleteAssetType,
      createArea, updateArea, deleteArea,
      createModel, updateModel, deleteModel,
      createItem, updateItem, deleteItem,
      createRelation, deleteRelation,
      createTicket, updateTicketStatus, addTicketComment,
      updateUserProfile, toggleUserActive,
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
