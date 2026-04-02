import { useState, useEffect } from "react";
import { Bell, Menu, Loader2, AlertTriangle, RefreshCw, LogOut, AlertCircle, ExternalLink } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider, useApp } from "./context/AppContext";
import { supabase, isConfigured } from "./lib/supabase";
import { Toast } from "./components/ui";
import Sidebar, { getNavItems } from "./components/Sidebar";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import InventoryView from "./pages/Inventory";
import ModelsView from "./pages/Models";
import AssignmentsView from "./pages/Assignments";
import RelationsView from "./pages/Relations";
import TicketsView from "./pages/Tickets";
import UsersView from "./pages/UsersManagement";
import UserPortal from "./pages/UserPortal";
import RRHHPortal from "./pages/RRHHPortal";
import ApproveAccess from "./pages/ApproveAccess";
import AccessControl from "./pages/AccessControl";

const adminPages = {
  dashboard: Dashboard,
  inventory: InventoryView,
  models: ModelsView,
  assignments: AssignmentsView,
  relations: RelationsView,
  tickets: TicketsView,
  users: UsersView,
  access: AccessControl,
};

const rrhhPages = {
  lookup: RRHHPortal,
  portal: UserPortal,
  access: AccessControl,
};

const userPages = {
  portal: UserPortal,
};

function AppShell() {
  const { isAdmin, isRRHH, profile } = useAuth();
  const { toast, clearToast, t, unreadNotifications, clearNotifications, markNotificationRead } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [page, setPage] = useState(() => {
    const path = window.location.pathname.substring(1);
    if (path && (Object.keys(adminPages).includes(path) || Object.keys(userPages).includes(path) || Object.keys(rrhhPages).includes(path))) {
      return path;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("item")) return "inventory";
    return null;
  });
  const [collapsed, setCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // When role resolves or changes, set appropriate default page
  useEffect(() => {
    setPage((prev) => {
      const validPages = isAdmin 
        ? Object.keys(adminPages) 
        : isRRHH 
        ? Object.keys(rrhhPages) 
        : Object.keys(userPages);
        
      if (!prev || !validPages.includes(prev)) {
        return isAdmin ? "dashboard" : isRRHH ? "lookup" : "portal";
      }
      return prev;
    });
  }, [isAdmin, isRRHH]);

  const pages = isAdmin ? adminPages : isRRHH ? rrhhPages : userPages;
  const navItems = getNavItems(isAdmin, isRRHH, t);
  const currentPage = page || (isAdmin ? "dashboard" : isRRHH ? "lookup" : "portal");
  const Page = pages[currentPage] || (isAdmin ? Dashboard : isRRHH ? RRHHPortal : UserPortal);
  const currentNav = navItems.find((n) => n.id === currentPage) || navItems[0];

  const getInitials = () => {
    if (profile?.full_name)
      return profile.full_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
    return "??";
  };

  return (
    <div className="flex h-screen bg-[#0B0E14] text-slate-200 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <Sidebar
        active={currentPage}
        onChange={(id) => {
          setPage(id);
          window.history.pushState(null, "", `/${id}`);
        }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 overflow-y-auto w-full">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-8 py-4 bg-[#0B0E14]/80 backdrop-blur-xl border-b border-slate-800/40">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-800/40 text-slate-400"
            >
              <Bell size={20} className="rotate-90" /> {/* temporary hamburger substitute or use Menu if available */}
            </button>
            <h1 className="text-sm font-semibold text-slate-300">
              {currentNav?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-xl transition-all ${showNotifications ? "bg-blue-500/10 text-blue-400" : "hover:bg-slate-800/40 text-slate-400"}`}
            >
              <Bell size={18} />
              {unreadNotifications?.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-[#0B0E14]">
                  {unreadNotifications?.length || 0}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-[#151A24] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notificaciones</h3>
                  {unreadNotifications?.length > 0 && (
                    <button onClick={clearNotifications} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium">Limpiar todo</button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {unreadNotifications?.length > 0 ? (
                    unreadNotifications.map((n) => (
                      <button 
                        key={n.id} 
                        onClick={() => {
                          setPage("tickets");
                          markNotificationRead(n.id);
                          setShowNotifications(false);
                          window.history.pushState(null, "", "/tickets");
                        }}
                        className="w-full p-4 border-b border-slate-800/50 hover:bg-slate-800/30 text-left transition-colors flex gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <AlertCircle size={14} className="text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-blue-500">TK-{n.ticket_number}</span>
                            <span className="text-[10px] text-slate-500 truncate">· {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-200 truncate">{n.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">Por {n.user_name}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-12 h-12 bg-slate-800/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell size={20} className="text-slate-600" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Bandeja vacía</p>
                      <p className="text-xs text-slate-600 mt-1">No tienes avisos nuevos</p>
                    </div>
                  )}
                </div>
                {unreadNotifications?.length > 0 && (
                  <button 
                    onClick={() => { setPage("tickets"); setShowNotifications(false); window.history.pushState(null, "", "/tickets"); }}
                    className="w-full p-3 text-center text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors font-medium border-t border-slate-800"
                  >
                    Ver todos los tickets
                  </button>
                )}
              </div>
            )}
          </div>
            <div className="hidden sm:block w-px h-6 bg-slate-800" />
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white overflow-hidden ${
                  isAdmin
                    ? "bg-gradient-to-br from-blue-500 to-violet-600"
                    : isRRHH
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                    : "bg-gradient-to-br from-blue-500 to-cyan-500"
                }`}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials()
                )}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-slate-200">
                  {profile?.full_name || "..."}
                </p>
                <p className="text-[10px] text-slate-500">
                  {isAdmin ? t("admin") : isRRHH ? t("rrhh") : t("user")}
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8">
          <Page />
        </div>
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={clearToast}
        />
      )}
    </div>
  );
}

function AuthGate() {
  const { session, profile, loading, signOut, refetchProfile } = useAuth();
  const { t } = useApp();
  const [resetting, setResetting] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin text-blue-400 mx-auto mb-4"
          />
          <p className="text-sm text-slate-500">{t("connecting")}</p>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  // Session exists but profile hasn't loaded yet — show brief loader with escape hatch
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-sm">
          <div className="relative inline-block">
            <Loader2 size={40} className="animate-spin text-blue-400 mx-auto" />
            <div className="absolute inset-0 bg-blue-400/20 blur-xl rounded-full" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-100">{t("loadingProfile")}</h1>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              {t("refreshNotice")}
            </p>
          </div>
          
          <div className="flex flex-col gap-3 pt-4">
            <button 
              disabled={resetting}
              onClick={async () => {
                console.log("AuthGate: Emergency Reset initiated");
                setResetting(true);
                // Nuclear reset
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = "/";
              }}
              className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {resetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t("resetApp")}
            </button>

            <button 
              disabled={logoutLoading}
              onClick={async () => {
                console.log("AuthGate: Instant Logout initiated");
                setLogoutLoading(true);
                signOut(); // Logic is synchronous for state updates
              }}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700/50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {logoutLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              {t("logout")}
            </button>

            <div className="pt-2">
              <button 
                onClick={() => refetchProfile?.()}
                className="text-[10px] text-slate-600 hover:text-slate-400 underline underline-offset-4 transition-all"
              >
                {t("tryAgain")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell />;
}

// Simple error boundary
function ErrorFallback() {
  return (
    <AppProvider>
      <ErrorContent />
    </AppProvider>
  );
}

function ErrorContent() {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <AlertTriangle size={40} className="text-amber-400 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-100">
          {t("errorBoundaryTitle")}
        </h2>
        <p className="text-sm text-slate-400">
          {t("errorBoundaryDesc")}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
        >
          <RefreshCw size={14} /> {t("reload")}
        </button>
      </div>
    </div>
  );
}

function ConfigError() {
  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#151A24] border border-red-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        
        <div className="mb-6 relative">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <div className="absolute inset-0 bg-red-400/20 blur-2xl rounded-full" />
        </div>

        <h1 className="text-xl font-bold text-slate-100 mb-2">Configuración Incompleta</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          No se detectaron las credenciales de Supabase necesarias para conectar la aplicación.
        </p>

        <div className="space-y-3 text-left bg-slate-900/50 rounded-2xl p-5 border border-slate-800 mb-8">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Variables faltantes:</p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-xs font-mono text-red-300">
              <span className="w-1 h-1 bg-red-400 rounded-full" /> VITE_SUPABASE_URL
            </li>
            <li className="flex items-center gap-2 text-xs font-mono text-red-300">
              <span className="w-1 h-1 bg-red-400 rounded-full" /> VITE_SUPABASE_ANON_KEY
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <a 
            href="https://vercel.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-3.5 px-4 bg-white text-black rounded-xl text-sm font-bold transition-all hover:bg-slate-100 flex items-center justify-center gap-2 shadow-lg"
          >
            Configurar en Vercel <ExternalLink size={14} />
          </a>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3.5 px-4 bg-slate-800 text-slate-300 rounded-xl text-sm font-bold transition-all hover:bg-slate-700 border border-slate-700/50"
          >
            Reintentar conexión
          </button>
        </div>

        <p className="mt-8 text-[10px] text-slate-600">
          Asegúrate de que las variables estén marcadas para el entorno de <span className="text-slate-400 font-bold">Preview</span> y <span className="text-slate-400 font-bold">Production</span>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      console.error("Uncaught error:", event.error || event.reason);
      setHasError(true);
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", handler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", handler);
    };
  }, []);

  if (!isConfigured) return <ConfigError />;

  const path = window.location.pathname.substring(1);

  // Support public routes outside of AuthGate
  if (path.startsWith("approve-access")) {
    return <ApproveAccess />;
  }

  return (
    <AuthProvider>
      {hasError ? (
        <ErrorFallback />
      ) : (
        <AppProvider>
          <AuthGate />
        </AppProvider>
      )}
    </AuthProvider>
  );
}
