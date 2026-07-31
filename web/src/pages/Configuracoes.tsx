import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { MoonIcon, SunIcon } from "../components/icons";
import { WhatsAppConnectModal } from "../components/WhatsAppConnectModal";
import { api } from "../lib/api";

interface StatusData {
  connectionStatus: string;
  phone: string | null;
  profileName: string | null;
  connectedSince: string | null;
}

export function Configuracoes() {
  const { theme, setTheme } = useTheme();
  const showToast = useToast();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const r = await api.get<StatusData>("/whatsapp/status");
      setStatus(r);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleDisconnect() {
    if (!window.confirm("Desconectar o WhatsApp da clínica? O atendimento automático para de funcionar até reconectar.")) return;
    setError(null);
    try {
      await api.post("/whatsapp/disconnect", {});
      await loadStatus();
      showToast("✓ WhatsApp desconectado.");
    } catch (e: any) {
      setError(e.message);
    }
  }

  const connected = status?.connectionStatus === "open";

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Dados da clínica e preferências da plataforma</p>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
        <Link to="/configuracoes/dados-clinica" className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Dados da Clínica</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Endereço, contato, redes sociais e informações usadas pela IA</div>
          </div>
          <span style={{ fontSize: 18, color: "var(--text-faint)" }}>›</span>
        </Link>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>WhatsApp da clínica</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                {connected && status?.phone ? `+${status.phone}` : "Conexão do canal de atendimento"}
              </div>
              {connected && status?.connectedSince && (
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                  Conectado desde {new Date(status.connectedSince).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </div>
              )}
            </div>
            <span className={`badge ${connected ? "badge-green" : "badge-red"}`}>
              {status === null ? "..." : connected ? "🟢 Conectado" : "🔴 Desconectado"}
            </span>
          </div>

          {connected ? (
            <button className="btn btn-secondary" onClick={handleDisconnect}>
              Desconectar
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => setShowConnectModal(true)}>
              Conectar WhatsApp
            </button>
          )}
        </div>

        <WhatsAppConnectModal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          onConnected={() => {
            loadStatus();
            showToast("✓ WhatsApp conectado.");
          }}
        />

        <div className="card">
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
    </div>
  );
}
