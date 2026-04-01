import { useState, useEffect } from "react";
import { UserPlus, UserCog, UserMinus, Search, Mail, Loader2, CheckCircle, ShieldAlert, List, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

const DOORS = [
  "Art Room",
  "Entrada Personal",
  "Lobby",
  "Logistics 1",
  "Logistics 2",
  "MD Offices",
  "TSC Offices"
];

export default function AccessControl() {
  const { profile } = useAuth();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState("alta"); // alta, actualizacion, baja, directorio
  const [loading, setLoading] = useState(false);

  // Directory State
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [dirSearchQuery, setDirSearchQuery] = useState("");

  // Form State - Alta
  const [altaEmployeeNumber, setAltaEmployeeNumber] = useState("");
  const [altaFirstName, setAltaFirstName] = useState("");
  const [altaLastNameP, setAltaLastNameP] = useState("");
  const [altaLastNameM, setAltaLastNameM] = useState("");
  const [altaDepartment, setAltaDepartment] = useState("");
  const [altaPuesto, setAltaPuesto] = useState("");
  const [altaSelectedDoors, setAltaSelectedDoors] = useState(["Entrada Personal"]);

  // Search State - Actualización & Baja
  const [searchQuery, setSearchQuery] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Actualización Form
  const [selectedDoors, setSelectedDoors] = useState([]);
  const [actPuesto, setActPuesto] = useState("");

  const fetchDirectory = async () => {
    setLoadingDirectory(true);
    try {
      const { data, error } = await supabase
        .from('production_users')
        .select(`
          *,
          access_requests(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process users to map their doors
      const mapped = data.map(user => {
        let activeDoors = new Set();
        let isActive = true;

        if (user.access_requests) {
          // Sort requests by date theoretically, though typically "Baja" comes last
          const approvedRequests = user.access_requests.filter(req => req.status === 'Aprobado');
          
          approvedRequests.forEach(req => {
            if (req.request_type === 'Baja') {
              isActive = false;
              activeDoors.clear(); // If baja is approved, remove all doors
            } else if (req.request_type === 'Alta' || req.request_type === 'Actualizacion') {
              if (isActive) {
                (req.requested_doors || []).forEach(d => activeDoors.add(d));
              }
            }
          });
        }

        return {
          ...user,
          isActive,
          activeDoors: Array.from(activeDoors)
        };
      });

      setDirectoryUsers(mapped);
    } catch (err) {
      console.error(err);
      showToast("Error al cargar directorio.", "error");
    } finally {
      setLoadingDirectory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "directorio") {
      fetchDirectory();
    }
  }, [activeTab]);

  const handleExportCSV = () => {
    if (directoryUsers.length === 0) return;

    const headers = ["Numero de Empleado", "Nombres", "Apellidos", "Departamento", "Estado", "Puertas de Acceso"];
    const rows = directoryUsers.map(u => [
      u.employee_number,
      u.first_name,
      `${u.last_name_paternal} ${u.last_name_maternal}`.trim(),
      u.department,
      u.isActive ? 'Activo' : 'Baja',
      u.activeDoors.join(', ')
    ]);

    const csvContent = [headers, ...rows]
      .map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Accesos_Produccion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setFoundUser(null);
    setSelectedDoors([]);

    try {
      const { data, error } = await supabase
        .from("production_users")
        .select("*")
        .or(`employee_number.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name_paternal.ilike.%${searchQuery}%`)
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          showToast("No se encontró ningún empleado con ese criterio.", "error");
        } else {
          throw error;
        }
      } else {
        setFoundUser(data);
      }
    } catch (err) {
      console.error(err);
      showToast("Error al buscar empleado.", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAlta = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create the user
      const { data: user, error: userError } = await supabase
        .from("production_users")
        .insert({
          employee_number: altaEmployeeNumber,
          first_name: altaFirstName,
          last_name_paternal: altaLastNameP,
          last_name_maternal: altaLastNameM,
          department: altaDepartment
        })
        .select()
        .single();

      if (userError) throw new Error(userError.message.includes('duplicate') ? 'Ya existe un usuario con este número de empleado.' : userError.message);

      if (altaSelectedDoors.length === 0) {
        throw new Error("Debes seleccionar al menos una puerta de acceso.");
      }

      // 2. Create the Access Request with a manually generated token for safety
      const requestToken = crypto.randomUUID();
      
      const { data: request, error: reqError } = await supabase
        .from("access_requests")
        .insert({
          user_id: user.id,
          request_type: "Alta",
          requested_doors: altaSelectedDoors,
          requested_by: profile.id,
          puesto_encargado: altaPuesto,
          status: "Pendiente",
          token: requestToken // Enviar token manualmente
        })
        .select()
        .single();

      if (reqError) throw reqError;

      // 3. Enviar correo (no-bloqueante)
      console.log("Enviando correo con token:", requestToken);
      
      fetch("/api/send-access-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: `${user.first_name} ${user.last_name_paternal}`,
          employeeNumber: user.employee_number,
          department: user.department,
          requestType: "Alta",
          requestedDoors: altaSelectedDoors,
          token: requestToken,
          puestoEncargado: altaPuesto,
          requesterName: profile.full_name
        })
      }).catch(e => console.warn("Correo no enviado:", e));

      showToast("Alta registrada. IT será notificado para autorizar los accesos.", "success");
      
      // Reset
      setAltaEmployeeNumber("");
      setAltaFirstName("");
      setAltaLastNameP("");
      setAltaLastNameM("");
      setAltaDepartment("");
      setAltaPuesto("");
      setAltaSelectedDoors(["Entrada Personal"]);

    } catch (err) {
      console.error(err);
      showToast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleActualizacion = async () => {
    if (!foundUser) return;
    if (selectedDoors.length === 0) {
      showToast("Debes seleccionar al menos una puerta adicional.", "error");
      return;
    }
    setLoading(true);
    try {
      // Create request with manual token
      const requestToken = crypto.randomUUID();
      
      const { data: request, error: reqError } = await supabase
        .from("access_requests")
        .insert({
          user_id: foundUser.id,
          request_type: "Actualizacion",
          requested_doors: selectedDoors,
          requested_by: profile.id,
          puesto_encargado: actPuesto,
          status: "Pendiente",
          token: requestToken
        })
        .select()
        .single();
      
      if (reqError) throw reqError;

      // Enviar correo (no-bloqueante)
      console.log("Enviando correo con token (Act):", requestToken);

      fetch("/api/send-access-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: `${foundUser.first_name} ${foundUser.last_name_paternal}`,
          employeeNumber: foundUser.employee_number,
          department: foundUser.department,
          requestType: "Actualizacion",
          requestedDoors: selectedDoors,
          token: requestToken,
          puestoEncargado: actPuesto,
          requesterName: profile.full_name
        })
      }).catch(e => console.warn("Correo no enviado:", e));

      showToast("Actualización solicitada. IT será notificado para autorizar los accesos.", "success");
      setSelectedDoors([]);
      setActPuesto("");
      setFoundUser(null);
      setSearchQuery("");
      
    } catch (err) {
      console.error(err);
      showToast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBaja = async () => {
    if (!foundUser) return;
    setLoading(true);
    try {
      // Create request (immediately approved)
      const { data: request, error: reqError } = await supabase
        .from("access_requests")
        .insert({
          user_id: foundUser.id,
          request_type: "Baja",
          requested_doors: [],
          requested_by: profile.id,
          status: "Aprobado" 
        })
        .select()
        .single();
      
      if (reqError) throw reqError;

      // Automatically create the Ticket
      const description = `Baja de Usuario (Despido).\nEmpleado: ${foundUser.first_name} ${foundUser.last_name_paternal} (#${foundUser.employee_number})\nDepartamento: ${foundUser.department}`;
      
      const { error: tktError } = await supabase
        .from("tickets")
        .insert({
          title: `⚙️ IT/Accesos - Baja: ${foundUser.first_name} ${foundUser.last_name_paternal}`,
          description,
          user_id: profile.id,
          status: "Abierto"
        });
      
      if (tktError) throw tktError;

      showToast("Baja registrada y ticket creado automáticamente.", "success");
      setFoundUser(null);
      setSearchQuery("");
      
    } catch (err) {
      console.error(err);
      showToast("Error: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleDoor = (door) => {
    if (selectedDoors.includes(door)) {
      setSelectedDoors(prev => prev.filter(d => d !== door));
    } else {
      setSelectedDoors(prev => [...prev, door]);
    }
  };

  const toggleAltaDoor = (door) => {
    if (altaSelectedDoors.includes(door)) {
      setAltaSelectedDoors(prev => prev.filter(d => d !== door));
    } else {
      setAltaSelectedDoors(prev => [...prev, door]);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          Control de Acceso (Usuarios Producción)
        </h1>
        <p className="text-sm text-slate-400 mt-1">Gestión de accesos físicos sin cuentas del sistema.</p>
      </div>

      <div className="flex gap-2 p-1 bg-[#151A24] rounded-xl border border-slate-800 w-fit">
        <button
          onClick={() => { setActiveTab("alta"); setFoundUser(null); setSearchQuery(""); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "alta" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserPlus size={16} /> Solicitud de Alta
        </button>
        <button
          onClick={() => { setActiveTab("actualizacion"); setFoundUser(null); setSearchQuery(""); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "actualizacion" ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserCog size={16} /> Actualizar Permisos
        </button>
        <button
          onClick={() => { setActiveTab("baja"); setFoundUser(null); setSearchQuery(""); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "baja" ? "bg-red-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserMinus size={16} /> Baja (Despido)
        </button>
        <button
          onClick={() => { setActiveTab("directorio"); setFoundUser(null); setSearchQuery(""); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "directorio" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <List size={16} /> Directorio y Reportes
        </button>
      </div>

      <div className="bg-[#151A24] border border-slate-800 rounded-3xl p-6 lg:p-8">
        {/* ALTA TAB */}
        {activeTab === "alta" && (
          <form onSubmit={handleAlta} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Nombres *</label>
                <input required value={altaFirstName} onChange={e => setAltaFirstName(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Número de Empleado *</label>
                <input required value={altaEmployeeNumber} onChange={e => setAltaEmployeeNumber(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Apellido Paterno *</label>
                <input required value={altaLastNameP} onChange={e => setAltaLastNameP(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Apellido Materno</label>
                <input value={altaLastNameM} onChange={e => setAltaLastNameM(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Departamento *</label>
                <input required value={altaDepartment} onChange={e => setAltaDepartment(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Puesto Encargado (Opcional)</label>
                <input value={altaPuesto} onChange={e => setAltaPuesto(e.target.value)} placeholder="Ej. Supervisor de Línea"
                  className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1.5 md:col-span-2 mt-2">
                <label className="text-sm font-medium text-slate-300 block mb-2">Accesos Solicitados *</label>
                <div className="flex flex-wrap gap-2">
                  {DOORS.map(door => (
                    <button
                      key={door}
                      type="button"
                      onClick={() => toggleAltaDoor(door)}
                      className={`px-4 py-2 rounded-xl text-sm transition-colors border ${
                        altaSelectedDoors.includes(door)
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20"
                          : "bg-[#151A24] text-slate-300 border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {door}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <button disabled={loading || altaSelectedDoors.length === 0} type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />} Enviar Solicitud de Alta
              </button>
            </div>
          </form>
        )}

        {/* ACTUALIZACION & BAJA TABS (Require Search) */}
        {(activeTab === "actualizacion" || activeTab === "baja") && (
          <div className="space-y-6">
            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                type="text"
                placeholder="Buscar por N° de Empleado o Nombre..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              />
              <button disabled={isSearching || !searchQuery} type="submit" className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center gap-2">
                {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Buscar
              </button>
            </form>

            {foundUser && (
              <div className="p-5 border border-slate-800 bg-[#0d121b] rounded-2xl animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Empleado Encontrado</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                  <div><span className="text-slate-500 block">Nombre</span> <span className="text-slate-200 font-medium">{foundUser.first_name} {foundUser.last_name_paternal}</span></div>
                  <div><span className="text-slate-500 block">N° de Empleado</span> <span className="font-mono text-blue-400">{foundUser.employee_number}</span></div>
                  <div><span className="text-slate-500 block">Departamento</span> <span className="text-slate-200">{foundUser.department}</span></div>
                  <div><span className="text-slate-500 block">Fecha Alta</span> <span className="text-slate-400">{new Date(foundUser.created_at).toLocaleDateString()}</span></div>
                </div>

                {activeTab === "actualizacion" && (
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <h4 className="text-sm font-medium text-slate-300">Solicitar Puertas Adicionales</h4>
                    <div className="flex flex-wrap gap-2">
                      {DOORS.filter(d => d !== "Entrada Personal").map(door => (
                        <button
                          key={door}
                          type="button"
                          onClick={() => toggleDoor(door)}
                          className={`px-4 py-2 rounded-xl text-sm transition-colors border ${
                            selectedDoors.includes(door)
                              ? "bg-amber-500 text-white border-amber-400"
                              : "bg-[#151A24] text-slate-300 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          {door}
                        </button>
                      ))}
                    </div>
                    
                    <div className="pt-2 max-w-sm">
                      <label className="text-sm font-medium text-slate-300 block mb-1">Puesto Encargado (Opcional)</label>
                      <input value={actPuesto} onChange={e => setActPuesto(e.target.value)} placeholder="Ej. Supervisor de Línea"
                        className="w-full bg-[#0B0E14] border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500" />
                    </div>

                    <div className="flex justify-end pt-4">
                      <button disabled={loading} onClick={handleActualizacion} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />} Enviar Solicitud
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "baja" && (
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-sm text-red-300 flex gap-2 items-start">
                        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                        <span>Al confirmar la baja, se creará un ticket inmediatamente para retirar los permisos del sistema.</span>
                      </p>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button disabled={loading} onClick={handleBaja} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50">
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <UserMinus size={18} />} Confirmar Baja
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* DIRECTORIO TAB */}
        {activeTab === "directorio" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center bg-[#0B0E14] p-4 rounded-2xl border border-slate-800">
              <input
                type="text"
                placeholder="Filtrar directorio..."
                value={dirSearchQuery}
                onChange={e => setDirSearchQuery(e.target.value)}
                className="w-full max-w-xs bg-transparent border-none text-slate-200 text-sm focus:outline-none"
              />
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Download size={16} /> Exportar CSV
              </button>
            </div>

            {loadingDirectory ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-slate-500" size={32} />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm text-slate-400">
                  <thead className="bg-[#0B0E14] text-slate-300 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-4 font-medium">N° Empleado</th>
                      <th className="px-6 py-4 font-medium">Nombre</th>
                      <th className="px-6 py-4 font-medium">Departamento</th>
                      <th className="px-6 py-4 font-medium">Estado</th>
                      <th className="px-6 py-4 font-medium">Accesos Vigentes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-[#151A24]">
                    {directoryUsers
                      .filter(u => 
                        !dirSearchQuery || 
                        u.employee_number.toLowerCase().includes(dirSearchQuery.toLowerCase()) || 
                        u.first_name.toLowerCase().includes(dirSearchQuery.toLowerCase()) || 
                        u.last_name_paternal.toLowerCase().includes(dirSearchQuery.toLowerCase())
                      )
                      .map((user) => (
                      <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-blue-400">{user.employee_number}</td>
                        <td className="px-6 py-4 text-slate-200 font-medium">
                          {user.first_name} {user.last_name_paternal} {user.last_name_maternal}
                        </td>
                        <td className="px-6 py-4">{user.department}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                            user.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            {user.isActive ? 'Activo' : 'Baja'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {user.activeDoors.length > 0 ? user.activeDoors.map(d => (
                              <span key={d} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs rounded">
                                {d}
                              </span>
                            )) : <span className="text-slate-500 italic text-xs">Sin accesos</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {directoryUsers.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                          No hay usuarios registrados en el directorio de Producción.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
