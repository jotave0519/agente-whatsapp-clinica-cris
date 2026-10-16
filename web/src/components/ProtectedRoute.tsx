import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { clearLocalSession, useAuth } from "../context/AuthContext";

// Depois desse tempo carregando, oferece saida manual em vez de girar pra sempre.
const STUCK_AFTER_MS = 10_000;

export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    if (!stuck) return <div className="empty-state">Carregando...</div>;
    return (
      <div className="empty-state">
        <p>O sistema está demorando para abrir.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearLocalSession();
              window.location.replace("/login");
            }}
          >
            Sair e entrar de novo
          </button>
        </div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}
