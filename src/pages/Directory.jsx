import { useState } from "react";
import { Search, User, Mail, Phone, Building, ChevronRight, Contact } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, EmptyState, Modal } from "../components/ui";

export default function Directory() {
  const { users, t } = useApp();
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(query.toLowerCase()) || 
    u.department?.toLowerCase().includes(query.toLowerCase()) ||
    u.email?.toLowerCase().includes(query.toLowerCase())
  ).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("directory")}</h2>
          <p className="text-sm text-slate-500">{users.length} {t("users").toLowerCase()}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("searchDirectory")}
          className="w-full pl-10 pr-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(u => (
          <div 
            key={u.id}
            onClick={() => setSelectedUser(u)}
            className="group p-4 rounded-2xl bg-[#151A24] border border-slate-700/50 hover:border-blue-500/30 hover:bg-blue-500/[0.02] transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-600/10 border border-slate-700/50 flex items-center justify-center text-blue-400 font-bold text-lg shrink-0 group-hover:scale-110 transition-transform">
                {u.full_name?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                  {u.full_name}
                </h3>
                <p className="text-xs text-slate-500 truncate mb-2">{u.department || t("noneArea")}</p>
                <div className="flex items-center gap-2">
                   <Badge color={u.role === 'admin' ? 'purple' : 'blue'}>{t(u.role)}</Badge>
                   {u.is_active === false && <Badge color="red">{t("inactive")}</Badge>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <EmptyState icon={Contact} title={t("noResults")} subtitle={t("noResults")} />
      )}

      {/* Profile Detail Modal */}
      <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title={t("contactInfo")}>
        {selectedUser && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center text-3xl font-bold text-blue-400 mb-4 border border-blue-500/20 shadow-2xl shadow-blue-500/10">
                {selectedUser.full_name?.[0]}
              </div>
              <h3 className="text-xl font-bold text-slate-100">{selectedUser.full_name}</h3>
              <p className="text-sm text-slate-400">{selectedUser.department}</p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400">
                  <Mail size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Email</p>
                  <p className="text-sm text-slate-200 truncate">{selectedUser.email}</p>
                </div>
              </div>

              {selectedUser.employee_number && (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400">
                    <Building size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">{t("employeeNumber")}</p>
                    <p className="text-sm text-slate-200 truncate">{selectedUser.employee_number}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-6 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all border border-slate-700"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
