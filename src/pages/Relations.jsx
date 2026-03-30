import { useState } from "react";
import { Plus, Link2, Trash2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, EmptyState, Modal, Input, Select, Btn } from "../components/ui";

export default function RelationsView() {
  const { items, models, brands, relations, createRelation, deleteRelation, t } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ parent_id: "", child_id: "", type: "Estación de trabajo" });

  const save = async () => {
    if (!form.parent_id || !form.child_id || form.parent_id === form.child_id) return;
    await createRelation(form);
    setModalOpen(false);
  };

  const getItemLabel = (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return "—";
    const model = models.find(m => m.id === item.model_id);
    const brand = model ? brands.find(b => b.id === model.brand_id) : null;
    return `${brand?.name || ""} ${model?.name || ""} (${item.serial})`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("assetRelations")}</h2>
          <p className="text-sm text-slate-500">{t("linkAssetsSummary")}</p>
        </div>
        <Btn onClick={() => { setForm({ parent_id: "", child_id: "", type: "Estación de trabajo" }); setModalOpen(true); }}><Link2 size={15} /> {t("newRelation")}</Btn>
      </div>

      {relations.length > 0 ? (
        <div className="space-y-3">
          {relations.map(r => (
            <div key={r.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[#151A24] border border-slate-700/50">
              <div className="flex-1 min-w-0"><p className="text-sm text-slate-200">{getItemLabel(r.parent_id)}</p><p className="text-xs text-slate-500 mt-0.5">{t("principal")}</p></div>
              <div className="flex flex-col items-center gap-0.5"><Link2 size={16} className="text-blue-400" /><Badge color="blue">{r.type}</Badge></div>
              <div className="flex-1 min-w-0 text-right"><p className="text-sm text-slate-200">{getItemLabel(r.child_id)}</p><p className="text-xs text-slate-500 mt-0.5">{t("linked")}</p></div>
              <button onClick={() => deleteRelation(r.id)} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Link2} title={t("noRelations")} subtitle={t("notLinkedYet")} action={<Btn onClick={() => setModalOpen(true)}><Plus size={14} /> {t("create")}</Btn>} />}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("newRelation")}>
        <div className="space-y-4">
          <Select label={t("mainAssetLabel")} options={[{ value: "", label: t("select") + "..." }, ...items.map(i => ({ value: i.id, label: getItemLabel(i.id) }))]} value={form.parent_id} onChange={e => setForm(p => ({ ...p, parent_id: e.target.value }))} />
          <Select label={t("linkedAssetLabel")} options={[{ value: "", label: t("select") + "..." }, ...items.filter(i => i.id !== form.parent_id).map(i => ({ value: i.id, label: getItemLabel(i.id) }))]} value={form.child_id} onChange={e => setForm(p => ({ ...p, child_id: e.target.value }))} />
          <Input label={t("type")} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} placeholder="Ej: Estación de trabajo" />
          <div className="flex justify-end gap-2 pt-2">
            <Btn variant="secondary" onClick={() => setModalOpen(false)}>{t("cancel")}</Btn>
            <Btn onClick={save}><Link2 size={15} /> {t("link")}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
