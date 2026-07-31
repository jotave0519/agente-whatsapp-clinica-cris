import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

interface QrResponse {
  base64: string | null;
  pairingCode: string | null;
}

interface StatusResponse {
  connectionStatus: string;
}

type ViewState = "loading" | "ready" | "error" | "connected";

const STATUS_POLL_MS = 3000;

/**
 * Pagina publica (sem login) aberta a partir do link temporario gerado no
 * CRM - permite escanear o QR Code de conexao do WhatsApp a partir de
 * outro aparelho quando so o celular esta em maos. O token na URL expira
 * sozinho (10 min, ver whatsappConnectLinkService no backend).
 */
export function ConnectWhatsAppLink() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>("loading");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedOnce = useRef(false);

  async function generateQr() {
    if (!token) return;
    setState("loading");
    setError(null);
    try {
      const r = await api.get<QrResponse>(`/public/whatsapp/connect-link/${token}/qrcode`);
      if (r.base64) {
        setQrBase64(r.base64);
        setState("ready");
      } else {
        setError("Não foi possível gerar o QR Code.");
        setState("error");
      }
    } catch (e: any) {
      setError(e.message || "Não foi possível gerar o QR Code.");
      setState("error");
    }
  }

  useEffect(() => {
    if (!requestedOnce.current) {
      requestedOnce.current = true;
      generateQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token || state === "connected") return;
    const interval = setInterval(async () => {
      try {
        const r = await api.get<StatusResponse>(`/public/whatsapp/connect-link/${token}/status`);
        if (r.connectionStatus === "open") {
          setState("connected");
        }
      } catch {
        // silencioso - o proximo QR/tentativa resolve, ou o link so esta expirado
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [token, state]);

  return (
    <div className="login-shell">
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="sidebar-brand" style={{ marginBottom: 20, justifyContent: "center" }}>
          Clínica Zangelmi
        </div>

        {state === "connected" ? (
          <div>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🟢</div>
            <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>WhatsApp conectado!</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Pode fechar esta página e voltar para a plataforma.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo → Escaneie este QR Code.
            </p>

            {state === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 0" }}>
                <span className="spinner" />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Gerando QR Code...</span>
              </div>
            )}

            {state === "ready" && qrBase64 && (
              <>
                <img
                  src={qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`}
                  alt="QR code de conexão do WhatsApp"
                  style={{ width: 220, height: 220, borderRadius: 12, margin: "0 auto" }}
                />
                <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={generateQr}>
                  Atualizar QR
                </button>
              </>
            )}

            {state === "error" && (
              <div style={{ padding: "16px 0" }}>
                <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>❌ {error}</p>
                <button className="btn btn-secondary" onClick={generateQr}>
                  Tentar novamente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
