import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, Save, Package, Loader2, QrCode, Download, Building } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useApp } from "../context/AppContext";
import { STATUSES, ASSET_ICONS } from "../data/constants";
import { Badge, StatusBadge, EmptyState, Modal, Input, Select, Btn } from "../components/ui";

export default function InventoryView() {
  const { items, models, brands, assetTypes, areas, users, movements, createItem, updateItem, deleteItem, dataLoading, t } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ serial: "", model_id: "", status: "Disponible", user_id: "", area_id: "" });
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [detailItem, setDetailItem] = useState(null);
  const [qrItem, setQrItem] = useState(null);

  // Auto-load item if ?item=id is in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get("item");
    if (itemId && items.length > 0) {
      const item = items.find(i => i.id === itemId);
      if (item) setDetailItem(item);
    }
  }, [items]);

  const downloadQR = () => {
    const canvas = document.getElementById("qr-canvas");
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_Activo_${qrItem?.serial || "ITAM"}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const openNew = () => { setEditing(null); setForm({ serial: "", model_id: models[0]?.id || "", status: "Disponible", user_id: "", area_id: "" }); setModalOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ serial: item.serial, model_id: item.model_id, status: item.status, user_id: item.user_id || "", area_id: item.area_id || "" }); setModalOpen(true); };

  const save = async () => {
    if (!form.serial || !form.model_id) return;
    const payload = { ...form, user_id: form.user_id || null, area_id: form.area_id || null };
    if (editing) {
      const note = form.status !== editing.status ? t("statusChanged").replace("{{old}}", t(editing.status)).replace("{{new}}", t(form.status)) : null;
      await updateItem(editing.id, payload, note);
    } else {
      await createItem(payload);
    }
    setModalOpen(false);
  };

  const selectedModel = models.find(m => m.id === form.model_id);
  const selectedBrand = selectedModel ? brands.find(b => b.id === selectedModel.brand_id) : null;

  const filtered = items.filter(item => {
    const model = models.find(m => m.id === item.model_id);
    const brand = model ? brands.find(b => b.id === model.brand_id) : null;
    const user = users.find(u => u.id === item.user_id);
    const area = areas.find(a => a.id === item.area_id);
    const text = `${item.serial} ${model?.name || ""} ${brand?.name || ""} ${user?.full_name || ""} ${area?.name || ""}`.toLowerCase();
    if (!text.includes(filter.toLowerCase())) return false;
    if (statusFilter !== "Todos" && item.status !== statusFilter) return false;
    if (typeFilter !== "Todos" && model?.type !== typeFilter) return false;
    return true;
  });

  if (dataLoading) return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-blue-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("inventory")}</h2>
          <p className="text-sm text-slate-500">{items.length} {t("inventory").toLowerCase()}</p>
        </div>
        <Btn onClick={openNew}><Plus size={15} /> {t("newAsset")}</Btn>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={t("search")} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-300 focus:outline-none appearance-none">
          <option value="Todos">{t("allStatuses")}</option>
          {STATUSES.map(s => <option key={s} value={s}>{t(s)}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-300 focus:outline-none appearance-none">
          <option value="Todos">{t("allTypes")}</option>
          {assetTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-800/40">
              {["", t("serialNumber"), t("model"), t("type"), t("status"), t("assignment"), t("qr"), ""].map((h, i) => <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(item => {
                const model = models.find(m => m.id === item.model_id);
                const brand = model ? brands.find(b => b.id === model.brand_id) : null;
                const user = users.find(u => u.id === item.user_id);
                const area = areas.find(a => a.id === item.area_id);
                const Icon = model ? (ASSET_ICONS[model.type] || Package) : Package;
                const initials = user?.full_name ? user.full_name.split(" ").map(w => w[0]).join("").slice(0, 2) : "";
                return (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors cursor-pointer" onClick={() => setDetailItem(item)}>
                    <td className="px-4 py-3"><div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center overflow-hidden">{model?.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <Icon size={18} className="text-slate-500" />}</div></td>
                    <td className="px-4 py-3"><span className="text-sm font-mono text-slate-200">{item.serial}</span></td>
                    <td className="px-4 py-3"><p className="text-sm text-slate-200">{model?.name || "—"}</p><p className="text-xs text-slate-500">{brand?.name}</p></td>
                    <td className="px-4 py-3"><Badge color="gray">{model?.type}</Badge></td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {user && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">{initials}</div>
                            <span className="text-sm text-slate-300 truncate">{user.full_name}</span>
                          </div>
                        )}
                        {area && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0"><Building size={11} /></div>
                            <span className="text-xs text-slate-400 truncate">{area.name}</span>
                          </div>
                        )}
                        {!user && !area && <span className="text-sm text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); setQrItem(item); }} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-blue-400 transition-colors">
                        <QrCode size={16} />
                      </button>
                    </td>
                    <td className="px-4 py-3"><div className="flex gap-1" onClick={e => e.stopPropagation()}><button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-200"><Edit size={14} /></button><button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyState icon={Package} title={t("noResults")} subtitle={t("noAssetsFound")} />}
      </div>

      {/* New/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("editAsset") : t("registerAsset")} wide>
        <div className="space-y-4">
          <Select label={t("model")} options={[{ value: "", label: "..." }, ...models.map(m => { const b = brands.find(x => x.id === m.brand_id); return { value: m.id, label: `${b?.name || ""} ${m.name} (${m.type})` }; })]} value={form.model_id} onChange={e => setForm(p => ({ ...p, model_id: e.target.value }))} />
          {selectedModel && (
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-start gap-4">
                {selectedModel.photo && <img src={selectedModel.photo} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-700/30" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-400 mb-1">{selectedBrand?.name} {selectedModel.name}</p>
                  <p className="text-xs text-slate-500 mb-2">Datos precargados:</p>
                  <div className="flex flex-wrap gap-1.5">{Object.entries(selectedModel.specs || {}).map(([k, v]) => <span key={k} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/30">{k}: {v}</span>)}</div>
                </div>
              </div>
            </div>
          )}
          <Input label={t("serialNumberLabel")} value={form.serial} onChange={e => setForm(p => ({ ...p, serial: e.target.value }))} placeholder="Ej: DL-5540-003" />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("userOptional")} options={[{ value: "", label: t("noUser") }, ...users.filter(u => u.is_active !== false).map(u => ({ value: u.id, label: u.full_name }))]} value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))} />
            <Select label={t("areaOptional")} options={[{ value: "", label: t("noneArea") }, ...areas.map(a => ({ value: a.id, label: a.name }))]} value={form.area_id} onChange={e => setForm(p => ({ ...p, area_id: e.target.value }))} />
          </div>
          <div className="w-1/2 pr-2">
            <Select label={t("status")} options={STATUSES.map(s => ({ value: s, label: t(s) }))} value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn>
            <Btn onClick={save}><Save size={15} /> {editing ? t("update") : t("register")}</Btn>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailItem} onClose={() => setDetailItem(null)} title={t("assetDetail")} wide>
        {detailItem && (() => {
          const model = models.find(m => m.id === detailItem.model_id);
          const brand = model ? brands.find(b => b.id === model.brand_id) : null;
          const user = users.find(u => u.id === detailItem.user_id);
          const itemMvs = movements.filter(mv => mv.item_id === detailItem.id);
          return (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 rounded-2xl bg-slate-800/60 border border-slate-700/30 flex items-center justify-center overflow-hidden">{model?.photo ? <img src={model.photo} alt="" className="w-full h-full object-cover" /> : <Package size={32} className="text-slate-500" />}</div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-100">{brand?.name} {model?.name}</h4>
                  <p className="text-sm font-mono text-slate-400 mb-2">S/N: {detailItem.serial}</p>
                  <div className="flex gap-2"><StatusBadge status={detailItem.status} /><Badge color="gray">{model?.type}</Badge></div>
                </div>
              </div>
              {model?.specs && Object.keys(model.specs).length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{t("specifications")}</h5>
                  <div className="grid grid-cols-2 gap-2">{Object.entries(model.specs).map(([k, v]) => <div key={k} className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30"><p className="text-[10px] text-slate-500 uppercase">{k}</p><p className="text-sm text-slate-200">{v}</p></div>)}</div>
                </div>
              )}
              {(user || detailItem.area_id) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {user && (
                    <div>
                      <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{t("assignedTo")}</h5>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-bold">{user.full_name?.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
                        <div><p className="text-sm font-medium text-slate-200">{user.full_name}</p><p className="text-xs text-slate-500">{user.email}</p></div>
                      </div>
                    </div>
                  )}
                  {detailItem.area_id && (() => {
                    const a = areas.find(x => x.id === detailItem.area_id);
                    return a && (
                      <div>
                        <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{t("locatedIn")}</h5>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center"><Building size={16} /></div>
                          <div><p className="text-sm font-medium text-amber-100">{a.name}</p><p className="text-xs text-amber-500/70">Área o Departamento</p></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {itemMvs.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{t("history")}</h5>
                  <div className="space-y-2">{itemMvs.map(mv => <div key={mv.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/20 border border-slate-700/20"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /><div className="flex-1"><p className="text-sm text-slate-300">{mv.note}</p><p className="text-xs text-slate-500">{new Date(mv.created_at).toLocaleString()}</p></div><Badge color="gray">{t(mv.action)}</Badge></div>)}</div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* QR Code Modal */}
      <Modal open={!!qrItem} onClose={() => setQrItem(null)} title={t("qrCodeTitle")}>
        {qrItem && (() => {
          const model = models.find(m => m.id === qrItem.model_id);
          const brand = model ? brands.find(b => b.id === model.brand_id) : null;
          const qrUrl = `${window.location.origin}/inventory?item=${qrItem.id}`;
          
          return (
            <div className="flex flex-col items-center justify-center py-6 space-y-6">
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-200">{brand?.name} {model?.name}</p>
                <p className="text-xs font-mono text-slate-400">S/N: {qrItem.serial}</p>
              </div>
              
              <div className="p-4 bg-white rounded-2xl shadow-xl">
                <QRCodeCanvas id="qr-canvas" value={qrUrl} size={200} level="H" includeMargin={true} />
              </div>
              
              <p className="text-xs text-slate-500 max-w-xs text-center leading-relaxed">
                {t("qrDescription")}
              </p>
              
              <Btn onClick={downloadQR} className="w-full flex justify-center py-3">
                <Download size={16} className="mr-2" /> {t("downloadQR")}
              </Btn>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
