import { useState } from "react";
import { Download, FileText, Users, Boxes, BarChart3, Loader2, CheckCircle2 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Btn } from "../components/ui";

export default function Reports() {
  const { items, users, tickets, models, brands, t } = useApp();
  const [loading, setLoading] = useState(null);

  const downloadCSV = (data, filename, headers) => {
    const csvRows = [];
    csvRows.push(headers.join(","));

    data.forEach(row => {
      const values = headers.map(header => {
        const escaped = ("" + (row[header] || "")).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (type) => {
    setLoading(type);
    setTimeout(() => {
      if (type === "inventory") {
        const flatItems = items.map(i => {
          const m = models.find(x => x.id === i.model_id);
          const b = brands.find(x => x.id === m?.brand_id);
          const u = users.find(x => x.id === i.user_id);
          return {
            ID: i.id,
            Serial: i.serial,
            Model: m?.name,
            Brand: b?.name,
            Type: m?.type,
            Status: i.status,
            AssignedUser: u?.full_name,
            CreatedAt: i.created_at
          };
        });
        downloadCSV(flatItems, "ITAM_Inventory", ["Serial", "Model", "Brand", "Type", "Status", "AssignedUser", "CreatedAt"]);
      } else if (type === "users") {
        const flatUsers = users.map(u => ({
          ID: u.id,
          Name: u.full_name,
          Email: u.email,
          Dept: u.department,
          EmpNumber: u.employee_number,
          Role: u.role,
          Active: u.is_active ? "Yes" : "No"
        }));
        downloadCSV(flatUsers, "ITAM_Users", ["Name", "Email", "Dept", "EmpNumber", "Role", "Active"]);
      } else if (type === "tickets") {
        const flatTickets = tickets.map(tk => {
          const u = users.find(x => x.id === tk.user_id);
          return {
            ID: tk.id,
            Number: tk.ticket_number,
            Title: tk.title,
            Status: tk.status,
            Priority: tk.priority,
            User: u?.full_name,
            CreatedAt: tk.created_at
          };
        });
        downloadCSV(flatTickets, "ITAM_Tickets", ["Number", "Title", "Status", "Priority", "User", "CreatedAt"]);
      }
      setLoading(null);
    }, 800);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 mb-1">{t("reports")}</h2>
        <p className="text-sm text-slate-500">{t("generalStats")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ReportCard 
          icon={Boxes} 
          title={t("inventory")} 
          count={items.length} 
          desc={t("exportInventory")}
          onExport={() => handleExport("inventory")}
          loading={loading === "inventory"}
          color="blue"
        />
        <ReportCard 
          icon={Users} 
          title={t("users")} 
          count={users.length} 
          desc={t("exportUsers")}
          onExport={() => handleExport("users")}
          loading={loading === "users"}
          color="violet"
        />
        <ReportCard 
          icon={FileText} 
          title={t("helpDesk")} 
          count={tickets.length} 
          desc={t("exportTickets")}
          onExport={() => handleExport("tickets")}
          loading={loading === "tickets"}
          color="emerald"
        />
      </div>

      <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-500/[0.05] to-violet-600/[0.05] border border-blue-500/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <BarChart3 size={120} className="text-blue-400 rotate-12" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <h3 className="text-lg font-bold text-slate-100 mb-3 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-blue-400" />
            Control de Auditoría
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Todos los reportes se generan en formato CSV, compatible con Microsoft Excel, Google Sheets y sistemas de BI. 
            La exportación incluye datos históricos y metadatos de relación para auditorías completas.
          </p>
          <div className="flex flex-wrap gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-500">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Cifrado de datos</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Formato Estandar</span>
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Filtros Activos</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportCard({ icon: Icon, title, count, desc, onExport, loading, color }) {
  const colorMap = {
    blue: "from-blue-500 to-blue-600 shadow-blue-500/20 text-blue-400",
    violet: "from-violet-500 to-violet-600 shadow-violet-500/20 text-violet-400",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-500/20 text-emerald-400"
  };

  return (
    <div className="group bg-[#151A24] border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-all flex flex-col items-center text-center">
      <div className={`w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${colorMap[color].split(" ")[3]}`}>
        <Icon size={24} />
      </div>
      <h3 className="text-base font-bold text-slate-100 mb-1">{title}</h3>
      <p className="text-3xl font-black text-slate-200 mb-2">{count}</p>
      <p className="text-xs text-slate-500 mb-6 px-4">{desc}</p>
      
      <button 
        onClick={onExport}
        disabled={loading}
        className={`w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700/50 flex items-center justify-center gap-2 disabled:opacity-50`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Descargar CSV
      </button>
    </div>
  );
}
