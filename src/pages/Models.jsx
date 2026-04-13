import { useState, useRef } from "react";
import { Search, Plus, Edit, Trash2, X, Tag, Save, Package, Upload, Camera, UserCheck, AlertCircle, BarChart3 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { ASSET_ICONS } from "../data/constants";
import { Badge, Modal, Input, Select, Btn } from "../components/ui";

// Resize image client-side to max dimension, returns a Blob
function resizeImage(file, maxSize = 400) {
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

async function uploadModelPhoto(file) {
  const resized = await resizeImage(file, 400);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { data, error } = await supabase.storage
    .from("model-photos")
    .upload(fileName, resized, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("model-photos").getPublicUrl(data.path);
  return urlData.publicUrl;
}

export default function ModelsView() {
  const { items, models, brands, assetTypes, createModel, updateModel, deleteModel, createBrand, updateBrand, deleteBrand, createAssetType, updateAssetType, deleteAssetType, showToast, t } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [brandModal, setBrandModal] = useState(false);
  const [typeModal, setTypeModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingBrand, setEditingBrand] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [form, setForm] = useState({ brand_id: "", name: "", type: "", photo: "", specs: {} });
  const [brandForm, setBrandForm] = useState({ name: "" });
  const [typeForm, setTypeForm] = useState({ name: "" });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [specKey, setSpecKey] = useState("");
  const [specVal, setSpecVal] = useState("");
  const [filter, setFilter] = useState("");

  const openNew = () => { setEditing(null); setForm({ brand_id: brands[0]?.id || "", name: "", type: assetTypes[0]?.name || "", photo: "", specs: {} }); setPhotoFile(null); setPhotoPreview(""); setModalOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ brand_id: m.brand_id, name: m.name, type: m.type, photo: m.photo || "", specs: { ...(m.specs || {}) } }); setPhotoFile(null); setPhotoPreview(m.photo || ""); setModalOpen(true); };

  const handlePhotoSelect = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePhotoSelect(file);
  };

  const save = async () => {
    if (!form.name || !form.brand_id) return;
    setUploading(true);
    try {
      let finalForm = { ...form };
      if (photoFile) {
        const url = await uploadModelPhoto(photoFile);
        finalForm.photo = url;
      }
      if (editing) { await updateModel(editing.id, finalForm); }
      else { await createModel(finalForm); }
      setModalOpen(false);
    } catch (err) {
      showToast(t("uploadError") + ": " + err.message, "error");
    }
    setUploading(false);
  };

  const addSpec = () => { if (specKey && specVal) { setForm(p => ({ ...p, specs: { ...p.specs, [specKey]: specVal } })); setSpecKey(""); setSpecVal(""); } };
  const removeSpec = (k) => { setForm(p => { const s = { ...p.specs }; delete s[k]; return { ...p, specs: s }; }); };

  const saveBrand = async () => {
    if (!brandForm.name) return;
    if (editingBrand) { await updateBrand(editingBrand.id, brandForm.name); }
    else { await createBrand(brandForm.name); }
    setBrandModal(false);
  };

  const saveType = async () => {
    if (!typeForm.name) return;
    if (editingType) { await updateAssetType(editingType.id, typeForm.name); }
    else { await createAssetType(typeForm.name); }
    setTypeModal(false);
  };

  const filtered = models.filter(m => {
    const brand = brands.find(b => b.id === m.brand_id);
    return `${m.name} ${brand?.name || ""} ${m.type}`.toLowerCase().includes(filter.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("modelsAndBrands")}</h2>
          <p className="text-sm text-slate-500">{t("modelsBrandsSummary").replace("{{models}}", models.length).replace("{{brands}}", brands.length)}</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={() => { setEditingType(null); setTypeForm({ name: "" }); setTypeModal(true); }}><Tag size={15} /> {t("manageTypes")}</Btn>
          <Btn variant="secondary" onClick={() => { setEditingBrand(null); setBrandForm({ name: "" }); setBrandModal(true); }}><Tag size={15} /> {t("manageBrands")}</Btn>
          <Btn onClick={openNew}><Plus size={15} /> {t("newModel")}</Btn>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={t("searchModels")} className="w-full pl-10 pr-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(m => {
          const brand = brands.find(b => b.id === m.brand_id);
          const Icon = ASSET_ICONS[m.type] || Package;
          const specs = m.specs || {};
          return (
            <div key={m.id} className="rounded-2xl border border-slate-700/50 bg-[#151A24] overflow-hidden hover:border-slate-600/50 transition-all group">
              <div className="h-40 bg-gradient-to-br from-slate-800/80 to-slate-900/80 flex items-center justify-center relative overflow-hidden">
                {m.photo ? <img src={m.photo} alt={m.name} className="w-full h-full object-contain p-4 opacity-80 group-hover:opacity-100 transition-opacity" /> : <Icon size={48} className="text-slate-600" />}
                <div className="absolute top-3 right-3 flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-slate-300 hover:text-white"><Edit size={13} /></button>
                  <button onClick={() => deleteModel(m.id)} className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-slate-300 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="purple">{brand?.name}</Badge>
                  <Badge color="blue">{m.type}</Badge>
                </div>
                  <h4 className="text-sm font-semibold text-slate-200 mb-3">{m.name}</h4>
                
                {/* Stock Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t("total")}</p>
                    <div className="flex items-center gap-1.5">
                      <BarChart3 size={10} className="text-slate-400" />
                      <p className="text-xs font-bold text-slate-300">
                        {items.filter(i => i.model_id === m.id).length}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-800/40 border border-slate-700/30">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t("assigned")}</p>
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={10} className="text-blue-400" />
                      <p className="text-xs font-bold text-blue-400/90">
                        {items.filter(i => i.model_id === m.id && i.status === "Asignado").length}
                      </p>
                    </div>
                  </div>
                  {(() => {
                    const stock = items.filter(i => i.model_id === m.id && i.status === "Disponible").length;
                    return (
                      <div className={`flex flex-col items-center justify-center p-2 rounded-xl border ${stock === 0 ? "bg-red-500/10 border-red-500/30 animate-pulse" : "bg-emerald-500/10 border-emerald-500/30"}`}>
                        <p className={`text-[10px] uppercase font-bold mb-1 ${stock === 0 ? "text-red-400" : "text-emerald-500"}`}>{t("stock")}</p>
                        <div className="flex items-center gap-1.5">
                          {stock === 0 ? <AlertCircle size={10} className="text-red-400" /> : <Package size={10} className="text-emerald-500" />}
                          <p className={`text-xs font-bold ${stock === 0 ? "text-red-400" : "text-emerald-500"}`}>
                            {stock}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(specs).slice(0, 4).map(([k, v]) => (
                    <span key={k} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-400 border border-slate-700/30">{k}: {v}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("editModel") : t("newModel")} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("manageBrands").slice(0,-1)} options={[{ value: "", label: "..." }, ...brands.map(b => ({ value: b.id, label: b.name }))]} value={form.brand_id} onChange={e => setForm(p => ({ ...p, brand_id: e.target.value }))} />
            <Select label={t("type")} options={[{ value: "", label: "..." }, ...assetTypes.map(t => ({ value: t.name, label: t.name }))]} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} />
          </div>
          <Input label={t("modelName")} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Latitude 5540" />
          
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package size={14} className="text-blue-400/70" />
              {t("technicalSpecs")}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Input label={t("processor")} value={form.specs.processor || ""} onChange={e => setForm(p => ({ ...p, specs: { ...p.specs, processor: e.target.value } }))} placeholder="Ej: Intel Core i7" />
              <Input label={t("ram")} value={form.specs.ram || ""} onChange={e => setForm(p => ({ ...p, specs: { ...p.specs, ram: e.target.value } }))} placeholder="Ej: 16GB" />
              <Input label={t("storage")} value={form.specs.storage || ""} onChange={e => setForm(p => ({ ...p, specs: { ...p.specs, storage: e.target.value } }))} placeholder="Ej: 512GB SSD" />
              <Input label={t("os")} value={form.specs.os || ""} onChange={e => setForm(p => ({ ...p, specs: { ...p.specs, os: e.target.value } }))} placeholder="Ej: Windows 11 Pro" />
              <div className="col-span-2">
                <Input label={t("screenSize")} value={form.specs.screenSize || ""} onChange={e => setForm(p => ({ ...p, specs: { ...p.specs, screenSize: e.target.value } }))} placeholder='Ej: 15.6"' />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">{t("modelPhoto")}</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => fileInputRef.current?.click()}
              className="relative flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-slate-700/50 bg-slate-800/30 hover:border-blue-500/40 hover:bg-slate-800/50 transition-all cursor-pointer overflow-hidden"
            >
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 text-white text-xs font-medium bg-black/50 px-3 py-1.5 rounded-lg">
                      <Camera size={14} /> {t("changeImage")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPhotoFile(null); setPhotoPreview(""); setForm(p => ({ ...p, photo: "" })); }}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 text-white hover:bg-red-500/80 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400">{t("qrDescription").includes("code") ? "Drag an image or click to select" : "Arrastra una imagen o haz clic para seleccionar"}</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">{t("specsJSON")}</label>
            <div className="flex gap-2 mb-2">
              <input value={specKey} onChange={e => setSpecKey(e.target.value)} placeholder={t("specKey")} className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
              <input value={specVal} onChange={e => setSpecVal(e.target.value)} placeholder={t("specValue")} className="flex-1 px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
              <Btn variant="secondary" size="sm" onClick={addSpec}><Plus size={14} /></Btn>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(form.specs).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-800/60 text-slate-300 border border-slate-700/30">
                  <strong>{k}:</strong> {v}
                  <button onClick={() => removeSpec(k)} className="text-slate-500 hover:text-red-400 ml-1"><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn>
            <Btn onClick={save} disabled={uploading}>
              {uploading ? <><span className="animate-spin">⏳</span> {t("uploading")}</> : <><Save size={15} /> {editing ? t("update") : t("register")}</>}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal open={brandModal} onClose={() => setBrandModal(false)} title={t("brandManagement")}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={brandForm.name} onChange={e => setBrandForm({ name: e.target.value })} placeholder={t("brandNamePlaceholder")} className="flex-1 px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
            <Btn onClick={saveBrand}>{editingBrand ? t("update") : <><Plus size={14} /> {t("add")}</>}</Btn>
          </div>
          <div className="space-y-1.5">
            {brands.map(b => {
              const brandModels = models.filter(m => m.brand_id === b.id);
              const brandTotal = items.filter(i => brandModels.some(m => m.id === i.model_id)).length;
              const brandAssigned = items.filter(i => brandModels.some(m => m.id === i.model_id) && i.status === "Asignado").length;
              const brandStock = items.filter(i => brandModels.some(m => m.id === i.model_id) && i.status === "Disponible").length;
              
              return (
                <div key={b.id} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-200">{b.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingBrand(b); setBrandForm({ name: b.name }); }} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400"><Edit size={13} /></button>
                      <button onClick={() => deleteBrand(b.id)} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <BarChart3 size={10} /> {t("total")}: <span className="text-slate-300 font-medium">{brandTotal}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <UserCheck size={10} /> {t("assigned")}: <span className="text-blue-400 font-medium">{brandAssigned}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Package size={10} /> {t("stock")}: <span className={`${brandStock === 0 ? "text-red-400" : "text-emerald-500"} font-medium`}>{brandStock}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <Modal open={typeModal} onClose={() => setTypeModal(false)} title={t("typeManagement")}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={typeForm.name} onChange={e => setTypeForm({ name: e.target.value })} placeholder={t("typeNamePlaceholder")} className="flex-1 px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50" />
            <Btn onClick={saveType}>{editingType ? t("update") : <><Plus size={14} /> {t("add")}</>}</Btn>
          </div>
          <div className="space-y-1.5">
            {assetTypes.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <span className="text-sm text-slate-200">{t.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingType(t); setTypeForm({ name: t.name }); }} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400"><Edit size={13} /></button>
                  <button onClick={() => deleteAssetType(t.id)} className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
