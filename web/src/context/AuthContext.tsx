import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { api, withTimeout } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

const SESSION_TIMEOUT_MS = 8_000;

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
    // Sem timeout/catch aqui, uma falha ao ler/renovar a sessao deixava o app
    // em "Carregando..." para sempre. Se nao resolver a tempo, libera a tela
    // (vai para o login); se a sessao chegar depois, onAuthStateChange atualiza.
    withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, "getSession timeout")
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

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
    try {
      await withTimeout(supabase.auth.signOut(), SESSION_TIMEOUT_MS, "signOut timeout");
    } catch {
      // Sem resposta do servidor: ao menos desloga este aparelho.
      clearLocalSession();
      setSession(null);
    }
  }

  return <AuthContext.Provider value={{ session, staff, loading, signOut }}>{children}</AuthContext.Provider>;
}

/**
 * Apaga so a sessao salva neste aparelho (chaves "sb-*" do Supabase no
 * localStorage). Nao toca em nenhum dado da clinica - so obriga a logar de novo.
 */
export function clearLocalSession(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage indisponivel (modo privado etc.) - nada a limpar.
  }
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
