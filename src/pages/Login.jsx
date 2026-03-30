import { useState } from "react";
import { Monitor, Loader2, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const { language, toggleLanguage, t } = useApp();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGoogle = async () => {
    setGLoading(true);
    setError("");
    await signInWithGoogle();
    setGLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "signup") {
      if (!fullName.trim()) { setError(t("fullName")); setLoading(false); return; }
      const { error: err } = await signUpWithEmail(email, password, fullName);
      if (err) { setError(err.message); } else { setSuccess(t("confirmEmail")); }
    } else {
      const { error: err } = await signInWithEmail(email, password);
      if (err) {
        console.error("Login error:", err);
        if (err.message?.includes("Email not confirmed")) {
          setError("Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada (y spam) para confirmar tu cuenta.");
        } else {
          setError(err.message || t("invalidCredentials"));
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center p-4">
      {/* Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={toggleLanguage}
          className="px-3 py-1.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-[10px] uppercase tracking-wider font-bold text-slate-300 hover:bg-slate-700/50 transition-all flex items-center gap-2"
        >
          {language === "es" ? "English" : "Español"}
        </button>
      </div>

      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-violet-600/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 mb-4 shadow-lg shadow-blue-600/20">
            <Monitor size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            ITAM<span className="text-blue-400">desk</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Prosper Manufacturing · IT Department</p>
        </div>

        {/* Card */}
        <div className="bg-[#151A24] border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={gLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-xl transition-all disabled:opacity-50 mb-6"
          >
            {gLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            {t("googleContinue")}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-700/50" />
            <span className="text-xs text-slate-500 uppercase">{t("orEmail")}</span>
            <div className="flex-1 h-px bg-slate-700/50" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder={t("fullName")}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder={t("email")} required
                className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={t("password")} required minLength={6}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}
            {success && (
              <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                {success}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {mode === "login" ? t("login") : t("signup")}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-xs text-slate-500 mt-5">
            {mode === "login" ? t("noAccount") : t("hasAccount")}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setSuccess(""); }}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              {mode === "login" ? t("registerNow") : t("loginNow")}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-slate-600 mt-6">
          Prosper Manufacturing · IT Department
        </p>
      </div>
    </div>
  );
}
