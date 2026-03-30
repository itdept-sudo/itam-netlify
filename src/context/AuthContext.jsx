import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (data) {
          setProfile(data);
          return data;
        }
        if (error) {
          console.warn(`Profile fetch attempt ${i + 1}/${retries}:`, error.message);
          // Profile might not exist yet (trigger delay), wait and retry
          if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000));
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    // Safety timeout - never stay loading forever
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => {
          clearTimeout(safetyTimer);
          setLoading(false);
        });
      } else {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    }).catch((err) => {
      console.error("getSession error:", err);
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error("Google sign-in error:", error);
  };

  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithEmail = async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error };
  };

  const signOut = async () => {
    console.log("AuthProvider: Synchronous signOut initiated...");
    
    // 1. Instant local reset
    setSession(null);
    setProfile(null);
    
    // 2. Immediate local storage clearing
    console.log("AuthProvider: Force clearing local storage...");
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase.auth.token') || key.includes('sb-'))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) { console.error("Sync storage clear failed", e); }

    // 3. Background network call (do NOT await)
    supabase.auth.signOut().catch(err => {
      console.warn("Background signOut (not critical since states are reset):", err.message);
    });
    
    // 4. Force navigation fallback
    if (window.location.pathname !== "/") {
      window.location.href = "/";
    }
  };

  const isAdmin = profile?.role === "admin";
  const isRRHH = profile?.role === "rrhh";

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        loading,
        isAdmin,
        isRRHH,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refetchProfile: () => session?.user && fetchProfile(session.user.id),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
