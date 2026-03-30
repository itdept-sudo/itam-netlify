import { useState } from "react";
import { Search, Plus, ArrowRight, Package, Users, Unlink, Building } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ASSET_ICONS } from "../data/constants";
import { Badge, EmptyState, Modal, Btn } from "../components/ui";

export default function AssignmentsView() {
  const { items, models, brands, users, areas, updateItem, showToast, t } = useApp();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [selectedItem, setSelectedItem] = useState(null);
  const [assignModal, setAssignModal] = useState(false);

  const activeUsers = users.filter(u => u.is_active !== false);
  const filteredUsers = activeUsers.filter(u => `${u.full_name} ${u.email} ${u.department}`.toLowerCase().includes(search.toLowerCase()));
  const filteredAreas = areas.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  
  const assignedList = selectedItem ? (activeTab === "users" ? items.filter(i => i.user_id === selectedItem.id) : items.filter(i => i.area_id === selectedItem.id)) : [];
  const availableItems = items.filter(i => i.status === "Disponible");

  const assignItem = async (itemId) => {
    if (!selectedItem) return;
    if (activeTab === "users") {
      await updateItem(itemId, { status: "Asignado", user_id: selectedItem.id, area_id: null }, `Asignado a ${selectedItem.full_name}`);
    } else {
      await updateItem(itemId, { status: "Asignado", area_id: selectedItem.id, user_id: null }, `Asignado a área ${selectedItem.name}`);
    }
    setAssignModal(false);
  };

  const unassignItem = async (itemId) => {
    if (!selectedItem) return;
    const noteName = activeTab === "users" ? selectedItem.full_name : selectedItem.name;
    await updateItem(itemId, { status: "Disponible", user_id: null, area_id: null }, `Devuelto por ${noteName}`);
  };

  const getInitials = (name) => name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "??";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("assignmentsTitle")}</h2>
        <p className="text-sm text-slate-500">{t("assignmentsSummary")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex bg-slate-800/40 p-1 rounded-xl">
            <button onClick={() => { setActiveTab("users"); setSelectedItem(null); setSearch(""); }} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === "users" ? "bg-slate-700/50 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300"}`}>{t("usersTab")}</button>
            <button onClick={() => { setActiveTab("areas"); setSelectedItem(null); setSearch(""); }} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${activeTab === "areas" ? "bg-slate-700/50 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300"}`}>{t("areasTab")}</button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={activeTab === "users" ? t("searchUser") : t("searchArea")} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
          </div>
          <div className="space-y-1.5">
            {activeTab === "users" ? filteredUsers.map(u => {
              const count = items.filter(i => i.user_id === u.id).length;
              return (
                <button key={u.id} onClick={() => setSelectedItem(u)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${selectedItem?.id === u.id ? "bg-blue-500/10 border border-blue-500/30" : "bg-slate-800/20 border border-slate-700/30 hover:bg-slate-800/40"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${selectedItem?.id === u.id ? "bg-blue-500/20 text-blue-400" : "bg-slate-700/50 text-slate-400"}`}>{getInitials(u.full_name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{u.full_name}</p>
                    <p className="text-xs text-slate-500">{u.department || u.email}</p>
                  </div>
                  <Badge color={count > 0 ? "blue" : "gray"}>{count}</Badge>
                </button>
              );
            }) : filteredAreas.map(a => {
              const count = items.filter(i => i.area_id === a.id).length;
              return (
                <button key={a.id} onClick={() => setSelectedItem(a)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${selectedItem?.id === a.id ? "bg-amber-500/10 border border-amber-500/30" : "bg-slate-800/20 border border-slate-700/30 hover:bg-slate-800/40"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${selectedItem?.id === a.id ? "bg-amber-500/20 text-amber-500" : "bg-slate-700/50 text-slate-400"}`}><Building size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{a.name}</p>
                  </div>
                  <Badge color={count > 0 ? "blue" : "gray"}>{count}</Badge>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedItem ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#151A24] border border-slate-700/50">
                <div className="flex items-center gap-3">
                  {activeTab === "users" ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg font-bold">{getInitials(selectedItem.full_name)}</div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">{selectedItem.full_name}</h3>
                        <p className="text-sm text-slate-500">{selectedItem.email} · {selectedItem.department}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-lg font-bold"><Building size={20} /></div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">{selectedItem.name}</h3>
                        <p className="text-sm text-slate-500">{t("areasTab").slice(0,-1)}</p>
                      </div>
                    </>
                  )}
                </div>
                <Btn onClick={() => setAssignModal(true)}><Plus size={15} /> {t("assign")}</Btn>
              </div>
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">{t("currentKit")} ({assignedList.length})</h4>
              {assignedList.length > 0 ? (
                <div className="space-y-2">
                  {assignedList.map(item => {
                    const model = models.find(m => m.id === item.model_id);
                    const brand = model ? brands.find(b => b.id === model.brand_id) : null;
                    const Icon = model ? (ASSET_ICONS[model.type] || Package) : Package;
                    return (
                      <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#151A24] border border-slate-700/50">
                        <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center overflow-hidden">{model?.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <Icon size={20} className="text-slate-500" />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200">{brand?.name} {model?.name}</p>
                          <p className="text-xs font-mono text-slate-500">{item.serial}</p>
                        </div>
                        <Badge color="gray">{model?.type}</Badge>
                        <Btn variant="danger" size="sm" onClick={() => unassignItem(item.id)}><Unlink size={13} /> {t("return")}</Btn>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon={Package} title={t("noResults")} subtitle={t("noAssetsFound")} />}
            </div>
          ) : <EmptyState icon={activeTab === "users" ? Users : Building} title={t("selectUserArea").replace("{{type}}", activeTab === "users" ? t("user").toLowerCase() : t("areasTab").toLowerCase().slice(0,-1))} subtitle={t("chooseFromList")} />}
        </div>
      </div>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title={`${t("assignTo")} ${activeTab === "users" ? selectedItem?.full_name : selectedItem?.name}`}>
        <div className="space-y-2">
          {availableItems.length > 0 ? availableItems.map(item => {
            const model = models.find(m => m.id === item.model_id);
            const brand = model ? brands.find(b => b.id === model.brand_id) : null;
            return (
              <button key={item.id} onClick={() => assignItem(item.id)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/20 border border-slate-700/30 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center overflow-hidden">{model?.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <Package size={16} className="text-slate-500" />}</div>
                <div className="flex-1"><p className="text-sm text-slate-200">{brand?.name} {model?.name}</p><p className="text-xs font-mono text-slate-500">{item.serial}</p></div>
                <ArrowRight size={16} className="text-slate-500" />
              </button>
            );
          }) : <EmptyState icon={Package} title={t("noAvailableAssets")} subtitle={t("noAssetsAvailableDesc")} />}
        </div>
      </Modal>
    </div>
  );
}
