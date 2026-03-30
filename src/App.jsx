import { useState, useEffect } from "react";
import { Bell, Loader2, AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppProvider, useApp } from "./context/AppContext";
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

const adminPages = {
  dashboard: Dashboard,
  inventory: InventoryView,
  models: ModelsView,
  assignments: AssignmentsView,
  relations: RelationsView,
  tickets: TicketsView,
  users: UsersView,
};

const rrhhPages = {
  lookup: RRHHPortal,
  portal: UserPortal,
};

const userPages = {
  portal: UserPortal,
};

function AppShell() {
  const { isAdmin, isRRHH, profile } = useAuth();
  const { toast, clearToast, t } = useApp();
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
    <div className="flex h-screen bg-[#0B0E14] text-slate-200 overflow-hidden">
      <Sidebar
        active={currentPage}
        onChange={(id) => {
          setPage(id);
          window.history.pushState(null, "", `/${id}`);
        }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 bg-[#0B0E14]/80 backdrop-blur-xl border-b border-slate-800/40">
          <h1 className="text-sm font-semibold text-slate-300">
            {currentNav?.label}
          </h1>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-slate-800/40 text-slate-400">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
            </button>
            <div className="w-px h-6 bg-slate-800" />
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
              <div className="hidden sm:block">
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
        <div className="p-6 lg:p-8">
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
