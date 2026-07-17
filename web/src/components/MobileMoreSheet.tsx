import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessPage } from "../lib/permissions";
import { LogOutIcon, XIcon } from "./icons";

const ITEMS = [
  { to: "/procedimentos", label: "Procedimentos" },
  { to: "/financeiro", label: "Financeiro" },
  { to: "/estoque", label: "Estoque" },
  { to: "/usuarios", label: "Usuários" },
  { to: "/whatsapp", label: "WhatsApp" },
  { to: "/campanhas-reativacao", label: "Campanhas de Reativação" },
  { to: "/pos-atendimento", label: "Pós-atendimento" },
  { to: "/inteligencia-ia", label: "Inteligência da IA" },
  { to: "/configuracoes", label: "Configurações" },
];

interface Props {
  onClose: () => void;
}

export function MobileMoreSheet({ onClose }: Props) {
  const { session, staff, signOut } = useAuth();
  const visibleItems = ITEMS.filter((item) => canAccessPage(staff?.role, item.to));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Mais</div>
          <button className="mobile-icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
              style={{ padding: "13px 12px", fontSize: 15 }}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 10, padding: "0 12px" }}>{session?.user.email}</div>
          <button
            onClick={signOut}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 12px", width: "100%", color: "var(--red)", fontSize: 15, fontWeight: 500 }}
          >
            <LogOutIcon /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
