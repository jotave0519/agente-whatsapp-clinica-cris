import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { CalendarIcon, HomeIcon, MessageCircleIcon, MoreIcon, UsersIcon } from "./icons";
import { MobileMoreSheet } from "./MobileMoreSheet";

const SECONDARY_PATHS = ["/procedimentos", "/financeiro", "/estoque", "/usuarios", "/whatsapp", "/inteligencia-ia", "/configuracoes"];

const TABS = [
  { to: "/", label: "Início", icon: HomeIcon, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarIcon, end: false },
  { to: "/pacientes", label: "Pacientes", icon: UsersIcon, end: false },
  { to: "/conversas", label: "Conversas", icon: MessageCircleIcon, end: false },
];

export function MobileTabBar() {
  const [showMore, setShowMore] = useState(false);
  const location = useLocation();
  const isSecondaryActive = SECONDARY_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <>
      <nav className="mobile-tabbar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `mobile-tabbar-item${isActive ? " active" : ""}`}
          >
            <tab.icon width={21} height={21} />
            {tab.label}
          </NavLink>
        ))}
        <button className={`mobile-tabbar-item${isSecondaryActive ? " active" : ""}`} onClick={() => setShowMore(true)}>
          <MoreIcon width={21} height={21} />
          Mais
        </button>
      </nav>
      {showMore && <MobileMoreSheet onClose={() => setShowMore(false)} />}
    </>
  );
}
