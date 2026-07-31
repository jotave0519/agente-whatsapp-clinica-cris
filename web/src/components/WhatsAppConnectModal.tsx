import { FormEvent, useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { api } from "../lib/api";
import { XIcon } from "./icons";

interface QrResponse {
  base64: string | null;
  pairingCode: string | null;
}

interface StatusResponse {
  connectionStatus: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

type QrState = "idle" | "loading" | "ready" | "error";
type CodeState = "idle" | "loading" | "ready" | "error";

const STATUS_POLL_MS = 3000;

/** "WZYEH1YY" -> "WZYE-H1YY", so pra ficar no formato que o proprio WhatsApp mostra. */
function formatPairingCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, "");
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
}

export function WhatsAppConnectModal({ open, onClose, onConnected }: Props) {
  useBodyScrollLock(open);
  const [tab, setTab] = useState<"qr" | "code">("qr");

  const [qrState, setQrState] = useState<QrState>("idle");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  const requestedQrOnce = useRef(false);

  async function generateQr() {
    setQrState("loading");
    setQrError(null);
    try {
      const r = await api.get<QrResponse>("/whatsapp/qrcode");
      if (r.base64) {
        setQrBase64(r.base64);
        setQrState("ready");
      } else {
        setQrError("Não foi possível gerar o QR Code.");
        setQrState("error");
      }
    } catch {
      setQrError("Não foi possível gerar o QR Code.");
      setQrState("error");
    }
  }

  async function generateCode(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setCodeState("loading");
    setCodeError(null);
    try {
      const r = await api.get<QrResponse>(`/whatsapp/qrcode?number=${encodeURIComponent(phone.trim())}`);
      if (r.pairingCode) {
        setPairingCode(r.pairingCode);
        setCodeState("ready");
      } else {
        setCodeError("Não foi possível gerar o código de pareamento. Tente escanear o QR Code.");
        setCodeState("error");
      }
    } catch {
      setCodeError("Não foi possível gerar o código de pareamento. Tente escanear o QR Code.");
      setCodeState("error");
    }
  }

  // Gera o QR automaticamente ao abrir (o usuario ja clicou "Conectar WhatsApp"
  // pra chegar aqui, nao precisa de mais um clique pra ver o QR).
  useEffect(() => {
    if (open && tab === "qr" && !requestedQrOnce.current) {
      requestedQrOnce.current = true;
      generateQr();
    }
    if (!open) {
      requestedQrOnce.current = false;
      setQrState("idle");
      setQrBase64(null);
      setQrError(null);
      setTab("qr");
      setPhone("");
      setCodeState("idle");
      setPairingCode(null);
      setCodeError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  // Enquanto o modal estiver aberto, verifica a cada poucos segundos se a
  // sessao foi conectada (depois de escanear o QR ou digitar o codigo no
  // celular) - detecta e fecha sozinho, sem precisar atualizar a pagina.
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      try {
        const r = await api.get<StatusResponse>("/whatsapp/status");
        if (r.connectionStatus === "open") {
          onConnected();
          onClose();
        }
      } catch {
        // silencioso - tentativa seguinte resolve
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Conectar WhatsApp</div>
          <button className="mobile-icon-btn" style={{ marginTop: -6, marginRight: -8, flexShrink: 0 }} onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
          Conecte o WhatsApp oficial da clínica para que a IA possa responder mensagens, agendar consultas e enviar lembretes
          automaticamente.
        </p>

        <div className="segmented" style={{ marginBottom: 18 }}>
          <span className={`segmented-item${tab === "qr" ? " active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setTab("qr")}>
            Escanear QR Code
          </span>
          <span className={`segmented-item${tab === "code" ? " active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setTab("code")}>
            Conectar com código
          </span>
        </div>

        {tab === "qr" && (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>
              Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo → Escaneie este QR Code.
            </p>

            {qrState === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 0" }}>
                <span className="spinner" />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Gerando QR Code...</span>
              </div>
            )}

            {qrState === "ready" && qrBase64 && (
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

            {qrState === "error" && (
              <div style={{ padding: "16px 0" }}>
                <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>❌ {qrError}</p>
                <button className="btn btn-secondary" onClick={generateQr}>
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "code" && (
          <div>
            {codeState !== "ready" && (
              <form onSubmit={generateCode} style={{ display: "grid", gap: 12 }}>
                <div>
                  <label className="field-label">Telefone da clínica</label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="tel"
                    placeholder="+55 11 99999-9999"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {codeState === "error" && <p style={{ fontSize: 12.5, color: "var(--red)" }}>❌ {codeError}</p>}
                <button className="btn" type="submit" disabled={codeState === "loading"}>
                  {codeState === "loading" ? "Gerando..." : "Gerar código"}
                </button>
              </form>
            )}

            {codeState === "ready" && pairingCode && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>Código:</div>
                <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 16 }}>{formatPairingCode(pairingCode)}</div>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.7, textAlign: "left" }}>
                  No WhatsApp:
                  <br />
                  Configurações → Dispositivos conectados → Conectar dispositivo → Conectar usando código
                  <br />
                  Digite o código acima.
                </p>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setCodeState("idle");
                    setPairingCode(null);
                  }}
                >
                  Gerar novo código
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
