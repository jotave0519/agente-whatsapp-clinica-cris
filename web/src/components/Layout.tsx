import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAppointmentModal } from "../context/AppointmentModalContext";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { canAccessPage } from "../lib/permissions";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";
import { Topbar } from "./Topbar";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Dashboard" },
      { to: "/agenda", label: "Agenda" },
      { to: "/pacientes", label: "Pacientes" },
      { to: "/conversas", label: "Conversas" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/procedimentos", label: "Procedimentos" },
      { to: "/financeiro", label: "Financeiro" },
      { to: "/estoque", label: "Estoque" },
      { to: "/usuarios", label: "Usuários" },
    ],
  },
  {
    label: "Integrações",
    items: [{ to: "/whatsapp", label: "WhatsApp" }],
  },
  {
    label: "Marketing",
    items: [
      { to: "/campanhas-reativacao", label: "Campanhas de Reativação" },
      { to: "/pos-atendimento", label: "Pós-atendimento" },
    ],
  },
  {
    label: "Inteligência Artificial",
    items: [{ to: "/inteligencia-ia", label: "Inteligência da IA" }],
  },
];

export function Layout() {
  const { session, staff, signOut } = useAuth();
  const { open: openNewAppointment } = useAppointmentModal();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const email = session?.user.email || "";
  const initials = email.slice(0, 2).toUpperCase();

  const visibleNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessPage(staff?.role, item.to)),
  })).filter((group) => group.items.length > 0);

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", width: "100%" }}>
        <MobileHeader />
        <main className="main">
          <Outlet />
        </main>
        <MobileTabBar />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">
            <span>Z</span>
          </div>
          <div>
            <div className="sidebar-brand-name">Dra. Zangelmi</div>
            <div className="sidebar-brand-sub">Estética Avançada</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: "auto" }}>
          {visibleNavGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 16 }}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button className="sidebar-footer" onClick={() => navigate("/configuracoes")}>
          <div className="sidebar-footer-avatar">{initials || "?"}</div>
          <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
            <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Configurações</div>
          </div>
        </button>
      </aside>

      <div className="main-column">
        <Topbar onNewAppointment={openNewAppointment} onSignOut={signOut} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
