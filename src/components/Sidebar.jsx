import {
  Monitor, LayoutDashboard, Boxes, Cpu, UserCheck, Users,
  Link2, TicketCheck, ChevronRight, ChevronDown, LogOut, Inbox, Languages, Search
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

export function getNavItems(isAdmin, isRRHH, t) {
  const ADMIN_NAV = [
    { id: "dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { id: "inventory", label: t("inventory"), icon: Boxes },
    { id: "models", label: t("models"), icon: Cpu },
    { id: "assignments", label: t("assignments"), icon: UserCheck },
    { id: "relations", label: t("relations"), icon: Link2 },
    { id: "tickets", label: t("helpDesk"), icon: TicketCheck },
    { id: "users", label: t("users"), icon: Users },
  ];

  const RRHH_NAV = [
    { id: "lookup", label: t("employeeLookup"), icon: Search },
    { id: "portal", label: t("myTickets"), icon: Inbox },
  ];

  const USER_NAV = [
    { id: "portal", label: t("myTickets"), icon: Inbox },
  ];

  if (isAdmin) return ADMIN_NAV;
  if (isRRHH) return RRHH_NAV;
  return USER_NAV;
}

export default function Sidebar({ active, onChange, collapsed, onToggle, isOpen, onClose }) {
  const { isAdmin, isRRHH, profile, signOut } = useAuth();
  const { t, language, toggleLanguage } = useApp();
  const navItems = getNavItems(isAdmin, isRRHH, t);

  const getAvatar = () => {
    if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />;
    const initials = profile?.full_name ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "??";
    return <span className="text-[10px] font-bold">{initials}</span>;
  };

  const handleNavClick = (id) => {
    onChange(id);
    if (onClose) onClose(); // Close drawer on mobile after selection
  };

  return (
    <aside className={`
      ${collapsed ? "w-[68px]" : "w-60"} 
      h-screen bg-[#0D1117] border-r border-slate-800/60 flex flex-col transition-all duration-300 shrink-0
      fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0
      ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
    `}>
      <div className="px-4 py-5 flex items-center justify-between border-b border-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
            <Monitor size={18} className="text-white" />
          </div>
          {(!collapsed || isOpen) && (
            <span className="text-base font-bold text-slate-100 tracking-tight">
              ITAM<span className="text-blue-400">desk</span>
            </span>
          )}
        </div>
        {/* Mobile close button could go here, but Backdrop usually handles it */}
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active === item.id
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} />
            {(!collapsed || isOpen) && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User info & logout */}
      <div className="px-2.5 pb-3 space-y-1">
        {(!collapsed || isOpen) && profile && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/20 border border-slate-700/20 mb-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isAdmin ? "bg-violet-500/20 text-violet-400" : isRRHH ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"}`}>
              {getAvatar()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{profile.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate">
                {isAdmin ? t("admin") : isRRHH ? t("rrhh") : t("user")}
              </p>
            </div>
          </div>
        )}
        
        <button
          onClick={toggleLanguage}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-blue-400 hover:bg-blue-500/5 transition-all"
          title={collapsed ? (language === "es" ? "English" : "Español") : undefined}
        >
          <Languages size={18} />
          {(!collapsed || isOpen) && (
            <div className="flex-1 flex items-center justify-between">
              <span>{language === "es" ? "Español" : "English"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700 uppercase">
                {language === "es" ? "es" : "en"}
              </span>
            </div>
          )}
        </button>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
          title={collapsed ? t("logout") : undefined}
        >
          <LogOut size={18} />
          {(!collapsed || isOpen) && <span>{t("logout")}</span>}
        </button>
        <button
          onClick={onToggle}
          className="hidden lg:flex w-full items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-600 hover:text-slate-400 transition-all"
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronDown size={16} /> <span className="text-xs">{t("collapse")}</span></>}
        </button>
      </div>
    </aside>
  );
}
