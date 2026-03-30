import { useEffect } from "react";
import { useApp } from "../context/AppContext";
import {
  CheckCircle2, XCircle, AlertCircle, X, Loader2, Package
} from "lucide-react";

/* ─── Toast ─── */
export function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : type === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-400"
      : "border-blue-500/30 bg-blue-500/10 text-blue-400";

  return (
    <div
      className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg border ${colors} backdrop-blur-xl flex items-center gap-2 shadow-2xl animate-slide-in`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : type === "error" ? (
        <XCircle size={16} />
      ) : (
        <AlertCircle size={16} />
      )}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

/* ─── Badge ─── */
const BADGE_COLORS = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
  purple: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  gray: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export function Badge({ children, color = "blue", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
        BADGE_COLORS[color] || BADGE_COLORS.blue
      } ${className}`}
    >
      {children}
    </span>
  );
}

/* ─── StatusBadge ─── */
export function StatusBadge({ status, type = "asset" }) {
  const { t } = useApp();
  const map =
    type === "ticket"
      ? { Abierto: "red", Proceso: "yellow", Cerrado: "green" }
      : { Disponible: "green", Asignado: "blue", Mantenimiento: "yellow", Baja: "red" };
  return <Badge color={map[status] || "gray"}>{t(status)}</Badge>;
}

/* ─── Spinner ─── */
export function Spinner() {
  return <Loader2 size={20} className="animate-spin text-blue-400" />;
}

/* ─── EmptyState ─── */
export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
        <Icon size={24} className="text-slate-500" />
      </div>
      <p className="text-slate-300 font-medium mb-1">{title}</p>
      <p className="text-slate-500 text-sm mb-4">{subtitle}</p>
      {action}
    </div>
  );
}

/* ─── Modal ─── */
export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className={`relative bg-[#151A24] border border-slate-700/50 rounded-2xl shadow-2xl ${
          wide ? "max-w-3xl" : "max-w-lg"
        } w-full max-h-[85vh] overflow-hidden flex flex-col animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Form Components ─── */
export function Input({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        {...props}
        className={`w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all ${
          props.className || ""
        }`}
      />
    </div>
  );
}

export function Select({ label, options, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        {...props}
        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Textarea({ label, ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <textarea
        {...props}
        className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none"
        rows={3}
      />
    </div>
  );
}

/* ─── Button ─── */
const BTN_VARIANTS = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20",
  secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/50",
  ghost: "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200",
  danger: "bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20",
  success: "bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20",
};

const BTN_SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Btn({ children, variant = "primary", size = "md", className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── KPI Card ─── */
const KPI_COLORS = {
  blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400",
  green: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
  yellow: "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400",
  red: "from-red-500/20 to-red-600/5 border-red-500/20 text-red-400",
  purple: "from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400",
};

export function KpiCard({ icon: Icon, label, value, trend, color = "blue" }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${KPI_COLORS[color]} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
          <p className="text-3xl font-bold text-slate-100 tracking-tight">{value}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-black/20 ${KPI_COLORS[color].split(" ").pop()}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

/* ─── MiniBar Chart ─── */
export function MiniBar({ data, colors }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-slate-500 font-medium">{d.value}</span>
          <div
            className="w-full rounded-t-md transition-all duration-500"
            style={{
              height: `${total ? (d.value / total) * 100 : 0}%`,
              minHeight: 4,
              background: colors[i],
            }}
          />
          <span className="text-[10px] text-slate-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
