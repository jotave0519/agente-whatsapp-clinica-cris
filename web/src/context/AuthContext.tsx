import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { api } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

export type StaffRole = "admin" | "recepcionista" | "profissional";

export interface StaffMe {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  staff: StaffMe | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [staff, setStaff] = useState<StaffMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // Perfil (role) do usuario logado - usado para ajustar a navegacao do CRM
  // conforme o que cada perfil pode acessar (a garantia real fica no backend,
  // isso e so para nao mostrar links que vao dar 403).
  useEffect(() => {
    if (!session) {
      setStaff(null);
      return;
    }
    api
      .get<StaffMe>("/me")
      .then(setStaff)
      .catch(() => setStaff(null));
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return <AuthContext.Provider value={{ session, staff, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
