import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileIdRef = useRef(null);
  const fetchingProfileRef = useRef(null);



  const fetchProfile = useCallback(async (userId, retries = 3) => {
    // Avoid redundant parallel fetches for the same user
    if (fetchingProfileRef.current === userId) {
      console.log("AuthContext: Profile fetch already in progress for", userId);
      return;
    }
    
    fetchingProfileRef.current = userId;
    console.log("AuthContext: Fetching profile for", userId);

    try {
      for (let i = 0; i < retries; i++) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("auth_id", userId)
            .single();

          // Fallback: Si no lo encontramos por auth_id, buscar por id directamente
          if (!data) {
            const { data: fallbackData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userId)
              .single();
            
            if (fallbackData) {
              setProfile(fallbackData);
              profileIdRef.current = userId;
              return fallbackData;
            }
          }

          if (data) {
            console.log("AuthContext: Profile loaded successfully");
            setProfile(data);
            profileIdRef.current = userId;
            return data;
          }
          if (error) {
            console.warn(`Profile fetch attempt ${i + 1}/${retries}:`, error.message);
            // Profile might not exist yet (trigger delay), wait and retry
            if (i < retries - 1) await new Promise((r) => setTimeout(r, 1500));
          }
        } catch (err) {
          console.error("Profile fetch iteration error:", err);
        }
      }
    } finally {
      fetchingProfileRef.current = null;
    }
    
    console.warn("AuthContext: Profile fetch failed after retries");
    return null;
  }, []);
  
  useEffect(() => {
    let isMounted = true;
    console.log("AuthContext: Starting unified initialization (Listener only)...");

    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        console.warn("AuthContext: Global safety timeout reached");
        setLoading(false);
      }
    }, 10000); 

    // Listen for auth changes (v2 fires INITIAL_SESSION on subscribe)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!isMounted) return;
        
        console.log(`AuthContext: Auth event: ${event} for ${s?.user?.id || 'none'}`);
        setSession(s);
        
        if (s?.user) {
          // Security: Early check for domain
          if (!s.user.email.endsWith("@prosper-mfg.com")) {
            console.error("AuthContext: Unauthorized domain:", s.user.email);
            // Sign out immediately if domain is not allowed
            supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          // Wrapped in a timeout to prevent hanging the entire loading state
          const fetchPromise = fetchProfile(s.user.id);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout")), 5000)
          );

          try {
            await Promise.race([fetchPromise, timeoutPromise]);
            console.log("AuthContext: Profile fetch resolved");
          } catch (err) {
            console.error("AuthContext: Profile fetch timed out or critical error:", err.message);
          }
        } else {
          setProfile(null);
          profileIdRef.current = null;
        }
        
        if (isMounted) {
          console.log("AuthContext: Setting loading: false");
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    );

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: 'prosper-mfg.com' // Suggests the domain in the Google picker
        }
      },
    });
    if (error) console.error("Google sign-in error:", error);
  };

  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUpWithEmail = async (email, password, fullName) => {
    if (!email.endsWith("@prosper-mfg.com")) {
      return { error: { message: "Solo se permiten correos con el dominio @prosper-mfg.com" } };
    }
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
