import { useTheme } from "../context/ThemeContext";
import { MoonIcon, SunIcon } from "../components/icons";

export function Configuracoes() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Preferências da plataforma</p>

      <div className="card" style={{ maxWidth: 620 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Preferências</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>Preferência salva neste dispositivo, aplicada instantaneamente</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>Tema da plataforma</span>
          <div className="segmented">
            <span
              className={`segmented-item${theme === "light" ? " active" : ""}`}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setTheme("light")}
            >
              <SunIcon width={14} height={14} /> Light
            </span>
            <span
              className={`segmented-item${theme === "dark" ? " active" : ""}`}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setTheme("dark")}
            >
              <MoonIcon width={14} height={14} /> Dark
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
