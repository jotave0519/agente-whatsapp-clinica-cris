import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface StatusData {
  connectionStatus: string;
  phone: string | null;
  profileName: string | null;
  connectedSince: string | null;
  stats: { messages: number; contacts: number; chats: number; activeConversations: number };
}

interface SettingsData {
  clinic: { reminders_enabled: boolean; inactivity_nudge_enabled: boolean };
}

function daysSince(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return days <= 0 ? "hoje" : `${days} dia${days > 1 ? "s" : ""}`;
}

export function WhatsApp() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [settings, setSettings] = useState<SettingsData["clinic"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ base64: string | null; pairingCode: string | null } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const r = await api.get<StatusData>("/whatsapp/status");
      setStatus(r);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadSettings() {
    try {
      const r = await api.get<SettingsData>("/settings");
      setSettings(r.clinic);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadStatus();
    loadSettings();
    const interval = setInterval(loadStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleGenerateQr() {
    setLoadingQr(true);
    setError(null);
    try {
      const r = await api.get<{ base64: string | null; pairingCode: string | null }>("/whatsapp/qrcode");
      setQr(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingQr(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Desconectar o WhatsApp da clínica? O atendimento automático para de funcionar até reconectar via QR code.")) return;
    setError(null);
    try {
      await api.post("/whatsapp/disconnect", {});
      await loadStatus();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleFlag(key: "reminders_enabled" | "inactivity_nudge_enabled") {
    if (!settings) return;
    setSavingFlag(key);
    setError(null);
    try {
      const next = { ...settings, [key]: !settings[key] };
      await api.patch("/settings", { clinic: next });
      setSettings(next);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingFlag(null);
    }
  }

  const connected = status?.connectionStatus === "open";

  return (
    <div>
      <h1 className="page-title">WhatsApp</h1>
      <p className="page-subtitle">Conexão e automações do canal de atendimento</p>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ background: "#2A2521", color: "#F3ECE4", display: "flex", gap: 20, alignItems: "center" }}>
          {!status ? (
            <div style={{ color: "#C7BBAF" }}>Carregando status...</div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <span className={`badge ${connected ? "badge-green" : "badge-red"}`}>{connected ? "Conectado" : status.connectionStatus}</span>
                <div style={{ fontSize: 19, fontWeight: 600, marginTop: 8 }}>{status.profileName || "Instância WhatsApp"}</div>
                <div style={{ fontSize: 13.5, color: "#C7BBAF", marginTop: 2 }}>{status.phone ? `+${status.phone}` : "—"} · Evolution API</div>
                <div style={{ display: "flex", gap: 22, marginTop: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#9E948A" }}>Online há</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{daysSince(status.connectedSince)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#9E948A" }}>Conversas ativas</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{status.stats.activeConversations}</div>
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={handleDisconnect}>
                Desconectar
              </button>
            </>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Reconectar dispositivo</div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>Gere um QR code para vincular um novo número.</p>
          {qr?.base64 ? (
            <img src={qr.base64.startsWith("data:") ? qr.base64 : `data:image/png;base64,${qr.base64}`} alt="QR code" style={{ width: 140, height: 140, borderRadius: 12 }} />
          ) : (
            <button className="btn btn-secondary" onClick={handleGenerateQr} disabled={loadingQr}>
              {loadingQr ? "Gerando..." : "Gerar QR code"}
            </button>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Mensagens</div>
          <div className="kpi-value">{status?.stats.messages ?? "—"}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Contatos</div>
          <div className="kpi-value">{status?.stats.contacts ?? "—"}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Conversas (todas)</div>
          <div className="kpi-value">{status?.stats.chats ?? "—"}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Conversas ativas</div>
          <div className="kpi-value">{status?.stats.activeConversations ?? "—"}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ fontWeight: 600 }}>Automações</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Ações executadas automaticamente pelo agente de IA</div>
        </div>
        {!settings ? (
          <div className="empty-state">Carregando...</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Lembretes automáticos de consulta</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Envia lembrete no WhatsApp no dia útil anterior, às 08:00</div>
              </div>
              <input
                type="checkbox"
                checked={settings.reminders_enabled}
                disabled={savingFlag === "reminders_enabled"}
                onChange={() => toggleFlag("reminders_enabled")}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Mensagem de inatividade</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Pergunta se o cliente ainda está por aqui após 5 min sem resposta, encerra após 10 min</div>
              </div>
              <input
                type="checkbox"
                checked={settings.inactivity_nudge_enabled}
                disabled={savingFlag === "inactivity_nudge_enabled"}
                onChange={() => toggleFlag("inactivity_nudge_enabled")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
