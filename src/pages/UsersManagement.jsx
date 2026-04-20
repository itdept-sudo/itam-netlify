import { useState, useRef } from "react";
import {
  Search, Edit, Shield, ShieldCheck, UserX, UserCheck as UserCheckIcon,
  Users, Save, ChevronRight, Plus, Building, Trash2, KeyRound, AlertTriangle, Upload
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { Badge, EmptyState, Modal, Input, Select, Btn } from "../components/ui";

export default function UsersView() {
  const { users, items, models, brands, tickets, areas, createArea, updateArea, deleteArea, updateUserProfile, toggleUserActive, deleteUserProfile, showToast, t, systemSettings, updateSystemSetting } = useApp();
  const { profile: myProfile } = useAuth();
  const [search, setSearch] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", employee_number: "", department: "", role: "user" });
  const [detailUser, setDetailUser] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: "", lastName: "", employee_number: "", email: "", password: "", department: "", role: "user" });
  const [creating, setCreating] = useState(false);
  
  const [areaModal, setAreaModal] = useState(false);
  const [areaForm, setAreaForm] = useState({ name: "" });
  const [editingArea, setEditingArea] = useState(null);

  const [resetModal, setResetModal] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [resetting, setResetting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Unification / Elevation State
  const [activeTab, setActiveTab] = useState("all"); // all, system, production
  const [elevateModal, setElevateModal] = useState(false);
  const [elevateForm, setElevateForm] = useState({ email: "", role: "user" });
  const [elevating, setElevating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleCreateUser = async () => {
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      showToast(t("mandatoryFields"), "error");
      return;
    }
    if (createForm.password.length < 6) {
      showToast(t("passwordLength"), "error");
      return;
    }
    
    setCreating(true);
    try {
      const full_name = `${createForm.firstName.trim()} ${createForm.lastName.trim()}`;
      
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "createUser", 
          userData: {
            email: createForm.email,
            password: createForm.password,
            full_name,
            role: createForm.role,
            department: createForm.department,
            employee_number: createForm.employee_number,
          }
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al crear usuario.");
      
      showToast(t("userCreated"), "success");
      setCreateModal(false);
      setCreateForm({ firstName: "", lastName: "", employee_number: "", email: "", password: "", department: "", role: "user" });
    } catch (err) {
      showToast(t("errorCreatingUser") + ": " + err.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = `${u.full_name} ${u.email || ''} ${u.department}`.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "system") return matchesSearch && u.role !== "produccion";
    if (activeTab === "production") return matchesSearch && u.role === "produccion";
    return matchesSearch;
  });

  const handleElevate = async () => {
    if (!elevateForm.email.endsWith("@prosper-mfg.com")) {
      showToast("Solo se permiten correos @prosper-mfg.com", "error");
      return;
    }
    setElevating(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "elevateUser", 
          userId: editUser.id,
          email: elevateForm.email,
          role: elevateForm.role
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al elevar permisos.");

      showToast("Acceso web asignado correctamente.", "success");
      setElevateModal(false);
      setEditModal(false);
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally {
      setElevating(false);
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    const names = u.full_name ? u.full_name.split(' ') : [];
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ');
    setForm({ firstName, lastName, employee_number: u.employee_number || "", department: u.department || "", role: u.role });
    setEditModal(true);
  };

  const saveUser = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast(t("mandatoryFields").split(",")[0], "error");
      return;
    }
    const full_name = `${form.firstName.trim()} ${form.lastName.trim()}`;
    await updateUserProfile(editUser.id, { 
      full_name, 
      employee_number: form.employee_number, 
      department: form.department, 
      role: form.role 
    });
    setEditModal(false);
  };

  const handleDelete = async () => {
    if (!editUser) return;
    const idToDelete = editUser.id;
    
    // Primero cerramos todo y limpiamos el usuario seleccionado
    // para evitar que la interfaz intente dibujar a alguien que ya no existe
    setDeleteConfirm(false);
    setEditModal(false);
    setEditUser(null);
    
    try {
      await deleteUserProfile(idToDelete);
    } catch (err) {
      console.error("Error al borrar usuario:", err);
      // El error ya lo muestra el AppContext vía toast, pero aquí evitamos el crash
    }
  };

  const handleResetPassword = async () => {
    if (newPass.length < 6) {
      showToast(t("passwordLength"), "error");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "resetPassword", 
          userId: editUser.id,
          newPassword: newPass
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al restablecer contraseña.");

      showToast(t("passwordResetSuccess"), "success");
      setResetModal(false);
      setNewPass("");
    } catch (err) {
      showToast(t("passwordResetError") + ": " + err.message, "error");
    } finally {
      setResetting(false);
    }
  };

  const saveArea = async () => {
    if (!areaForm.name) return;
    // Check for duplicate area name (case-insensitive)
    const exists = areas.some(a => a.name.toLowerCase() === areaForm.name.trim().toLowerCase());
    if (exists) {
      showToast('Área ya existe', 'error');
      return;
    }
    try {
      if (editingArea) {
        await updateArea(editingArea.id, areaForm.name);
      } else {
        await createArea(areaForm.name);
      }
      setAreaModal(false);
    } catch (err) {
      console.error('Error creating area:', err);
    }
  };

  const getAvatar = (u) => {
    if (u.avatar_url) return <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />;
    const initials = u.full_name ? u.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "??";
    return <span className="text-sm font-bold">{initials}</span>;
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        
        // Skip header if it contains known column names
        const startIndex = (lines[0].toLowerCase().includes("name") || lines[0].toLowerCase().includes("nombre")) ? 1 : 0;
        const dataLines = lines.slice(startIndex);

        if (dataLines.length === 0) throw new Error("Archivo vacío");

        const newProfiles = [];
        const departments = new Set();

        dataLines.forEach(line => {
          // Basic CSV Parsing (comma or semicolon)
          const parts = line.split(/[;,]/).map(p => p.trim());
          if (parts.length >= 4) {
            const first_name = parts[0];
            const last_name_paternal = parts[1];
            const last_name_maternal = parts[2];
            const employee_number = parts[3];
            const department = parts[4] || "";
            const card_number = parts[5] || "";

            if (first_name && employee_number) {
              const full_name = `${first_name} ${last_name_paternal} ${last_name_maternal}`.replace(/\s+/g, ' ').trim();
              newProfiles.push({
                full_name,
                first_name,
                last_name_paternal,
                last_name_maternal,
                employee_number,
                department,
                card_number,
                role: 'produccion',
                is_active: true
              });
              if (department) departments.add(department);
            }
          }
        });

        if (newProfiles.length === 0) throw new Error("No se encontraron datos válidos. El formato debe ser: Nombre, Apellido P, Apellido M, No. Empleado...");

        // 1. Ensure Departments exist as Areas
        if (departments.size > 0) {
          const deptArray = Array.from(departments).map(name => ({ name }));
          await supabase.from("areas").upsert(deptArray, { onConflict: "name", ignoreDuplicates: true });
        }

        // 2. Batch Insert Profiles
        const { data, error } = await supabase
          .from("profiles")
          .upsert(newProfiles, { onConflict: "employee_number", ignoreDuplicates: true })
          .select();

        if (error) throw error;

        const importedCount = data?.length || 0;
        const skippedCount = newProfiles.length - importedCount;
        
        showToast(`Importación completa: ${importedCount} nuevos, ${skippedCount} omitidos.`, "success");
      } catch (err) {
        console.error("CSV Import Error:", err);
        showToast("Error importando CSV: " + err.message, "error");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("organizationTitle")}</h2>
          <p className="text-sm text-slate-500">{t("usersAreasSummary").replace("{{users}}", users.length).replace("{{areas}}", areas.length)}</p>
        </div>
        <div className="flex gap-2">
          {myProfile?.role === "admin" && (
            <>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".csv" 
                onChange={handleCSVImport} 
              />
              <Btn 
                variant="secondary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? "..." : <Upload size={15} />} {t("import")}
              </Btn>
              <Btn variant="secondary" onClick={() => { setEditingArea(null); setAreaForm({ name: "" }); setAreaModal(true); }}><Building size={15} /> {t("areas")}</Btn>
              <Btn onClick={() => setCreateModal(true)}><Plus size={15} /> {t("newUser")}</Btn>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-800/20 border border-slate-700/30 rounded-xl w-fit">
        <button onClick={() => setActiveTab("all")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "all" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}>Todos</button>
        <button onClick={() => setActiveTab("system")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "system" ? "bg-blue-600/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}>Acceso Plataforma</button>
        <button onClick={() => setActiveTab("production")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "production" ? "bg-emerald-600/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}>Solo Producción</button>
        {myProfile?.role === "admin" && (
          <button onClick={() => setActiveTab("settings")} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === "settings" ? "bg-purple-600/20 text-purple-400" : "text-slate-500 hover:text-slate-300"}`}>Configuración del Sistema</button>
        )}
      </div>

      {activeTab === "settings" ? (
        <div className="p-6 bg-[#151A24] border border-slate-700/50 rounded-2xl animate-fade-in space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Mantenimiento Preventivo</h3>
            <p className="text-sm text-slate-500">Configura cada cuántos días se revisará el inventario para generar tickets automáticos.</p>
          </div>
          <div className="max-w-xs space-y-3">
            <Input 
              label="Días para Mantenimiento" 
              type="number" 
              value={systemSettings?.maintenance_interval_days || 30} 
              onChange={e => updateSystemSetting("maintenance_interval_days", parseInt(e.target.value) || 30)} 
            />
            <p className="text-xs text-slate-500">Valor por defecto: 30</p>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("searchUsersPlaceholder")} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-700/50 bg-[#151A24] p-4 text-center">
              <p className="text-2xl font-bold text-slate-100">{users.filter(u => u.role === "admin").length}</p>
              <p className="text-xs text-slate-500">{t("adminsStat")}</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-[#151A24] p-4 text-center">
              <p className="text-2xl font-bold text-slate-100">{users.filter(u => u.role === "user").length}</p>
              <p className="text-xs text-slate-500">{t("standardUsersStat")}</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-[#151A24] p-4 text-center">
              <p className="text-2xl font-bold text-slate-100">{users.filter(u => u.is_active === false).length}</p>
              <p className="text-xs text-slate-500">{t("disabledStat")}</p>
            </div>
          </div>

          {/* User list */}
          <div className="space-y-2">
            {filtered.map(u => {
          const userItems = items.filter(i => i.user_id === u.id);
          const userTickets = tickets.filter(t => t.user_id === u.id);
          const isMe = u.id === myProfile?.id;
          return (
            <div key={u.id} className={`flex items-center gap-4 p-4 rounded-2xl bg-[#151A24] border transition-all cursor-pointer hover:border-slate-600/50 ${u.is_active === false ? "opacity-50 border-slate-800/30" : "border-slate-700/50"}`} onClick={() => setDetailUser(u)}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${u.role === "admin" ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400"}`}>
                {getAvatar(u)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-200 truncate">{u.full_name}</p>
                  {isMe && <Badge color="blue">{t("me")}</Badge>}
                  {u.is_active === false && <Badge color="red">{t("inactive")}</Badge>}
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {u.email} {u.employee_number ? `· ${t("employeeNumberAbbr")}: ${u.employee_number}` : ""} {u.department ? `· ${u.department}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge color={u.role === "admin" ? "purple" : u.role === "produccion" ? "emerald" : "gray"}>
                  {u.role === "admin" ? <><ShieldCheck size={11} /> {t("admin")}</> : u.role === "produccion" ? "Producción" : t("user")}
                </Badge>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">{t("assetsCount").replace("{{count}}", userItems.length)}</p>
                  <p className="text-xs text-slate-500">{t("ticketsCount").replace("{{count}}", userTickets.length)}</p>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-200"><Edit size={14} /></button>
                  {!isMe && (
                    <button
                      onClick={() => toggleUserActive(u.id, !u.is_active)}
                      className={`p-1.5 rounded-lg hover:bg-slate-700/50 ${u.is_active !== false ? "text-slate-500 hover:text-red-400" : "text-slate-500 hover:text-emerald-400"}`}
                    >
                      {u.is_active !== false ? <UserX size={14} /> : <UserCheckIcon size={14} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <EmptyState icon={Users} title={t("noResults")} subtitle={t("noResults")} />}
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={t("editUserTitle")}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("firstName")} value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Ej: Juan Antonio" />
            <Input label={t("lastName")} value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Ej: Pérez Gómez" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("employeeNumber")} value={form.employee_number} onChange={e => setForm(p => ({ ...p, employee_number: e.target.value }))} placeholder="Ej: 15482" />
            <Input label={t("department")} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} placeholder="Ej: Ingeniería" />
          </div>
          <Select 
            label={t("role")} 
            options={[
              { value: "user", label: t("standardUsersStat").slice(0,-1) }, 
              { value: "rrhh", label: t("rrhh") },
              { value: "admin", label: t("admin") }
            ]} 
            value={form.role} 
            onChange={e => setForm(p => ({ ...p, role: e.target.value }))} 
          />
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs text-amber-400">
              <strong>{t("admin")}:</strong> {t("adminDescription")}
            </p>
            <p className="text-xs text-amber-400 mt-1">
              <strong>{t("rrhh")}:</strong> {t("rrhhDescription")}
            </p>
            <p className="text-xs text-amber-400 mt-1">
              <strong>{t("user")}:</strong> {t("userDescription")}
            </p>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              <Btn 
                variant="secondary" 
                className="!text-red-500 !bg-red-500/5 hover:!bg-red-500/10 border-red-500/20"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 size={14} /> {t("delete")}
              </Btn>
              {myProfile?.role === "admin" && editUser?.role === 'produccion' && (
                <Btn 
                  variant="secondary" 
                  className="!text-blue-400 !bg-blue-400/5 hover:!bg-blue-400/10 border-blue-400/20"
                  onClick={() => {
                    setElevateForm({ email: "", role: "user" });
                    setElevateModal(true);
                  }}
                >
                  <KeyRound size={14} /> Asignar Acceso Web
                </Btn>
              )}
              <Btn 
                variant="secondary" 
                className="!text-amber-500 !bg-amber-500/5 hover:!bg-amber-500/10 border-amber-500/20"
                onClick={() => setResetModal(true)}
              >
                <KeyRound size={14} /> {t("resetPassword")}
              </Btn>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setEditModal(false)}>{t("cancel")}</Btn>
              <Btn onClick={saveUser}><Save size={15} /> {t("save")}</Btn>
            </div>
          </div>
        </div>
      </Modal>

      {/* Password Reset Modal */}
      <Modal open={resetModal} onClose={() => setResetModal(false)} title={t("resetPassword")}>
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            {t("user")}: <span className="text-slate-200 font-medium">{editUser?.full_name}</span> ({editUser?.email})
          </p>
          <Input 
            type="password"
            label={t("newPassword")} 
            value={newPass} 
            onChange={e => setNewPass(e.target.value)} 
            placeholder="••••••••" 
          />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setResetModal(false)}>{t("cancel")}</Btn>
            <Btn onClick={handleResetPassword} disabled={resetting}>
              {resetting ? "..." : <Save size={15} />} {t("confirm")}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Elevation Modal */}
      <Modal open={elevateModal} onClose={() => setElevateModal(false)} title="Asignar Acceso a Plataforma">
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <p className="text-xs text-blue-400">
              Estás habilitando el acceso web para <span className="text-slate-200 font-medium">{editUser?.full_name}</span>. Se requiere un correo institucional de @prosper-mfg.com.
            </p>
          </div>
          <Input 
            label="Correo Electrónico (Prosper MFG)" 
            value={elevateForm.email} 
            onChange={e => setElevateForm(p => ({ ...p, email: e.target.value }))} 
            placeholder="usuario@prosper-mfg.com" 
          />
          <Select 
            label="Rol en Plataforma" 
            options={[
              { value: "user", label: "Usuario Estándar" }, 
              { value: "rrhh", label: "Recursos Humanos" },
              { value: "admin", label: "Administrador" }
            ]} 
            value={elevateForm.role} 
            onChange={e => setElevateForm(p => ({ ...p, role: e.target.value }))} 
          />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setElevateModal(false)}>{t("cancel")}</Btn>
            <Btn onClick={handleElevate} disabled={elevating || !elevateForm.email.includes('@prosper-mfg.com')}>
              {elevating ? "..." : <Save size={15} />} Confirmar Acceso
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailUser} onClose={() => setDetailUser(null)} title={detailUser?.full_name} wide>
        {detailUser && (() => {
          const userItems = items.filter(i => i.user_id === detailUser.id);
          const userTickets = tickets.filter(t => t.user_id === detailUser.id);
          return (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold ${detailUser.role === "admin" ? "bg-violet-500/20 text-violet-400" : "bg-blue-500/20 text-blue-400"}`}>
                  {getAvatar(detailUser)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{detailUser.full_name}</h3>
                  <p className="text-sm text-slate-500">{detailUser.email}</p>
                  <p className="text-xs font-mono text-slate-500 mt-1">{detailUser.employee_number ? `No. Empleado: ${detailUser.employee_number}` : ""}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge color={detailUser.role === "admin" ? "purple" : "gray"}>{t(detailUser.role)}</Badge>
                    {detailUser.department && <Badge color="blue">{detailUser.department}</Badge>}
                    {detailUser.is_active === false && <Badge color="red">{t("inactive")}</Badge>}
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{t("assignmentsTitle")} ({userItems.length})</h5>
                {userItems.length > 0 ? (
                  <div className="space-y-1.5">
                    {userItems.map(item => {
                      const model = models.find(m => m.id === item.model_id);
                      const brand = model ? brands.find(b => b.id === model.brand_id) : null;
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/20 border border-slate-700/20">
                          <div className="w-8 h-8 rounded-lg bg-slate-800/60 border border-slate-700/30 flex items-center justify-center overflow-hidden">
                            {model?.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-slate-500">{model?.type?.slice(0, 2)}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 truncate">{brand?.name} {model?.name}</p>
                            <p className="text-xs font-mono text-slate-500">{item.serial}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-slate-500">{t("noAvailableAssets")}</p>}
              </div>

              <div>
                <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Tickets ({userTickets.length})</h5>
                {userTickets.length > 0 ? (
                  <div className="space-y-1.5">
                    {userTickets.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/20 border border-slate-700/20">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{t.title}</p>
                          <p className="text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge color={t.status === "Abierto" ? "red" : t.status === "Proceso" ? "yellow" : "green"}>{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-500">{t("noResults")}</p>}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Create Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title={t("newUser")} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("firstName")} required value={createForm.firstName} onChange={e => setCreateForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Ej: Juan Antonio" />
            <Input label={t("lastName")} required value={createForm.lastName} onChange={e => setCreateForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Ej: Pérez Gómez" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("email")} required type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder={t("emailPlaceholder")} />
            <Input label={t("password")} required type="password" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} placeholder={t("passwordPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("employeeNumber")} value={createForm.employee_number} onChange={e => setCreateForm(p => ({ ...p, employee_number: e.target.value }))} placeholder="Ej: 15482" />
            <Input label={t("department")} value={createForm.department} onChange={e => setCreateForm(p => ({ ...p, department: e.target.value }))} placeholder="Ej: Ingeniería" />
          </div>
          <Select 
            label={t("role")} 
            options={[
              { value: "user", label: t("standardUsersStat").slice(0,-1) }, 
              { value: "rrhh", label: t("rrhh") },
              { value: "admin", label: t("admin") }
            ]} 
            value={createForm.role} 
            onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))} 
          />
          
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <p className="text-xs text-blue-400">
              {t("userCreationNotice")}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setCreateModal(false)}>{t("cancel")}</Btn>
            <Btn onClick={handleCreateUser} disabled={creating}>{creating ? t("uploading").replace('...', '') : <><Save size={15} /> {t("register")}</>}</Btn>
          </div>
        </div>
      </Modal>

      {/* Areas Modal */}
      <Modal open={areaModal} onClose={() => setAreaModal(false)} title={t("areasManagement")}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={areaForm.name} onChange={e => setAreaForm({ name: e.target.value })} placeholder={t("areaPlaceholder")} className="flex-1 px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
            <Btn onClick={saveArea}>{editingArea ? t("update") : <><Plus size={14} /> {t("add")}</>}</Btn>
          </div>
          <div className="space-y-1.5">
            {areas.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <span className="text-sm text-slate-200">{a.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingArea(a); setAreaForm({ name: a.name }); }} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400"><Edit size={13} /></button>
                  <button onClick={() => deleteArea(a.id)} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
            {areas.length === 0 && <p className="text-xs text-slate-500 text-center py-4">{t("noAreasRegistered")}</p>}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title={t("confirm")} small>
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-red-100">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <p className="text-xs leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente a <strong>{editUser?.full_name}</strong>?
              <br /><br />
              Esta acción es irreversible y liberará cualquier equipo asignado.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" onClick={() => setDeleteConfirm(false)}>{t("cancel")}</Btn>
            <Btn className="!bg-red-600 hover:!bg-red-500" onClick={handleDelete}>
            </Btn>
          </div>
        </div>
      </Modal>
      </>
      )}
    </div>
  );
}
