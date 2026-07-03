import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
    label: "Sistema",
    items: [{ to: "/configuracoes", label: "Configurações" }],
  },
];

export function Layout() {
  const { signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">Clínica Zangelmi</div>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
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
        <button className="sidebar-item" style={{ marginTop: "auto" }} onClick={signOut}>
          Sair
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
