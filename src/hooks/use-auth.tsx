import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export type AuthStatus = "loading" | "unauthenticated" | "unauthorized" | "authorized";

const AARAV_AUTH_CACHE_KEY = "aarav_traders_verified_member_id";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedMemberId = localStorage.getItem(AARAV_AUTH_CACHE_KEY);
        if (cachedMemberId) return "authorized";
      } catch {
        // ignore
      }
    }
    return "loading";
  });
  const [isFirmMember, setIsFirmMember] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return Boolean(localStorage.getItem(AARAV_AUTH_CACHE_KEY));
      } catch {
        // ignore
      }
    }
    return false;
  });

  useEffect(() => {
    let mounted = true;

    async function checkUserMembership(currentUser: User | null) {
      if (!currentUser) {
        if (mounted) {
          try {
            localStorage.removeItem(AARAV_AUTH_CACHE_KEY);
          } catch {
            // ignore storage errors
          }
          setSession(null);
          setUser(null);
          setIsFirmMember(false);
          setAuthStatus("unauthenticated");
        }
        return;
      }

      // Check for locally cached authorized partner status for instant, permanent session resume
      let hasCachedAuth = false;
      try {
        hasCachedAuth = localStorage.getItem(AARAV_AUTH_CACHE_KEY) === currentUser.id;
      } catch {
        // ignore storage errors
      }

      if (hasCachedAuth && mounted) {
        setUser(currentUser);
        setIsFirmMember(true);
        setAuthStatus("authorized");
      }

      try {
        // Query firm_members to check if user's ID is whitelisted
        const { data, error } = await supabase
          .from("firm_members")
          .select("id, role")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (error) {
          // Network issue or offline: if user was previously authorized, keep them authorized
          if (hasCachedAuth && mounted) {
            setUser(currentUser);
            setIsFirmMember(true);
            setAuthStatus("authorized");
            return;
          }
          if (mounted) {
            setUser(currentUser);
            setIsFirmMember(false);
            setAuthStatus("unauthorized");
          }
          return;
        }

        if (!data) {
          // Explicitly not a firm member in database
          try {
            localStorage.removeItem(AARAV_AUTH_CACHE_KEY);
          } catch {
            // ignore
          }
          if (mounted) {
            setUser(currentUser);
            setIsFirmMember(false);
            setAuthStatus("unauthorized");
          }
        } else {
          // User is verified authorized partner
          try {
            localStorage.setItem(AARAV_AUTH_CACHE_KEY, currentUser.id);
          } catch {
            // ignore
          }
          if (mounted) {
            setUser(currentUser);
            setIsFirmMember(true);
            setAuthStatus("authorized");
          }
        }
      } catch (err) {
        console.error("Failed to verify firm membership from database:", err);
        if (hasCachedAuth && mounted) {
          setUser(currentUser);
          setIsFirmMember(true);
          setAuthStatus("authorized");
        } else if (mounted) {
          setUser(currentUser);
          setIsFirmMember(false);
          setAuthStatus("unauthorized");
        }
      }
    }

    // 1. Initial Session Check (stays signed in via persistent session)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      checkUserMembership(session?.user ?? null);
    });

    // 2. Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      checkUserMembership(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Shared Email + Password Sign In (no signup/create account)
  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("invalid login credentials") ||
          msg.includes("invalid_grant") ||
          msg.includes("email not confirmed") ||
          msg.includes("user not found") ||
          msg.includes("wrong")
        ) {
          throw new Error("Wrong email or password");
        }
        if (
          msg.includes("fetch") ||
          msg.includes("network") ||
          msg.includes("connection") ||
          msg.includes("failed to fetch")
        ) {
          throw new Error("Can't reach the server");
        }
        throw new Error(error.message);
      }

      toast.success("Signed in successfully!");
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes("failed to fetch") ||
        message.toLowerCase().includes("network")
      ) {
        throw new Error("Can't reach the server");
      }
      throw err;
    }
  };

  // Sign Out
  const signOut = async () => {
    try {
      localStorage.removeItem(AARAV_AUTH_CACHE_KEY);
    } catch {
      // ignore
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setIsFirmMember(false);
    setAuthStatus("unauthenticated");
    toast.info("Signed out successfully.");
  };

  return {
    session,
    user,
    authStatus,
    isFirmMember,
    signInWithPassword,
    signOut,
  };
}
