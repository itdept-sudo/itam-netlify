import { useState } from "react";
import { Search, User, Package, ChevronRight, Inbox, Building } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, EmptyState, Input } from "../components/ui";

export default function RRHHPortal() {
  const { users, items, models, brands, t } = useApp();
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const filteredUsers = users.filter(u => 
    (u.full_name?.toLowerCase().includes(query.toLowerCase()) || 
     u.employee_number?.toLowerCase().includes(query.toLowerCase())) &&
    u.role !== 'admin' // Usually HR only looks up standard employees
  );

  const userItems = selectedUser ? items.filter(i => i.user_id === selectedUser.id) : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("employeeLookup")}</h2>
        <p className="text-sm text-slate-500">{t("rrhhDescription")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left Col: Search & List */}
        <div className="space-y-4">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedUser(null); }}
              placeholder={t("searchByEmployee")}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {query.length > 0 ? (
              filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    selectedUser?.id === u.id
                      ? "bg-blue-500/10 border-blue-500/40"
                      : "bg-[#151A24] border-slate-700/50 hover:border-slate-600"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 capitalize">
                    {u.full_name?.[0] || <User size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{u.full_name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {u.employee_number ? `No. ${u.employee_number}` : t("noUser")} · {u.department || t("noneArea")}
                    </p>
                  </div>
                  <ChevronRight size={14} className={selectedUser?.id === u.id ? "text-blue-400" : "text-slate-600"} />
                </button>
              ))
            ) : (
              <div className="py-12 px-4 rounded-2xl border border-dashed border-slate-800 text-center">
                <Search size={24} className="text-slate-700 mx-auto mb-3" />
                <p className="text-xs text-slate-600">{t("searchByEmployee")}</p>
              </div>
            )}
            
            {query.length > 0 && filteredUsers.length === 0 && (
              <EmptyState icon={User} title={t("noResults")} subtitle={t("noResults")} />
            )}
          </div>
        </div>

        {/* Right Col: Details */}
        <div className="space-y-4">
          {selectedUser ? (
            <div className="bg-[#151A24] rounded-2xl border border-slate-700/50 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-5 border-b border-slate-700/50 bg-slate-800/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg font-bold capitalize">
                    {selectedUser.full_name?.[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100">{selectedUser.full_name}</h3>
                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge color="blue"><Building size={10} /> {selectedUser.department || t("noneArea")}</Badge>
                  {selectedUser.employee_number && <Badge color="gray">#{selectedUser.employee_number}</Badge>}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {t("assetsAssignedTo").replace("{{name}}", "")}
                </h4>
                
                <div className="space-y-2">
                  {userItems.length > 0 ? (
                    userItems.map(item => {
                      const model = models.find(m => m.id === item.model_id);
                      const brand = model ? brands.find(b => b.id === model.brand_id) : null;
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/30 group hover:border-slate-600/50 transition-all">
                          <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {model?.photo ? (
                              <img src={model.photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-slate-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{brand?.name} {model?.name}</p>
                            <p className="text-[10px] font-mono text-slate-500 truncate uppercase mt-0.5">{item.serial}</p>
                          </div>
                          <Badge color={item.status === 'Disponible' ? 'green' : item.status === 'Mantenimiento' ? 'yellow' : 'blue'}>
                            {t(item.status)}
                          </Badge>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState 
                      icon={Inbox} 
                      title={t("noAvailableAssets")} 
                      subtitle={t("noAssetsAvailableDesc")} 
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-800 text-center text-slate-600">
              <User size={32} className="mb-4 opacity-20" />
              <p className="text-sm">{t("selectUserArea").replace("{{type}}", t("user").toLowerCase())}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
