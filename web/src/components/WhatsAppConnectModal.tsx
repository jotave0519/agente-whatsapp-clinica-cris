import { useEffect, useRef, useState } from "react";
import { useToast } from "../context/ToastContext";
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

interface ConnectLinkResponse {
  token: string;
  expiresAt: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

type QrState = "idle" | "loading" | "ready" | "error";
type LinkState = "idle" | "loading" | "ready" | "error";

const STATUS_POLL_MS = 3000;

/**
 * So QR Code - testado ao vivo contra a instancia real (Evolution API v2.3.7,
 * integracao WHATSAPP-BAILEYS): GET /instance/connect/{instance}?number=...
 * responde 200 mas `pairingCode` sempre volta null nessa versao/instancia,
 * mesmo com um numero valido. Mesmo sintoma relatado em issues abertas no
 * repositorio oficial da Evolution API pra essa faixa de versao. Por isso a
 * opcao de pareamento por codigo foi removida da interface (nao faz sentido
 * deixar um botao que so gera erro).
 *
 * O backend (evolutionApiClient.getConnectQrCode) ja aceita um numero de
 * telefone opcional e repassa via ?number= sem quebrar nada - se uma versao
 * futura da Evolution API corrigir isso, basta reintroduzir aqui a aba/form
 * de telefone chamando `/whatsapp/qrcode?number=...`, sem precisar mexer no
 * backend.
 */
export function WhatsAppConnectModal({ open, onClose, onConnected }: Props) {
  useBodyScrollLock(open);
  const showToast = useToast();

  const [qrState, setQrState] = useState<QrState>("idle");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const [linkState, setLinkState] = useState<LinkState>("idle");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const requestedQrOnce = useRef(false);

  async function generateLink() {
    setLinkState("loading");
    setLinkError(null);
    try {
      const r = await api.post<ConnectLinkResponse>("/whatsapp/connect-link", {});
      setLinkUrl(`${window.location.origin}/conectar-whatsapp/${r.token}`);
      setLinkState("ready");
    } catch (e: any) {
      setLinkError(e.message || "Não foi possível gerar o link.");
      setLinkState("error");
    }
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      showToast("✓ Link copiado.");
    } catch {
      showToast("Não foi possível copiar o link.");
    }
  }

  async function shareLink() {
    if (!linkUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Conectar WhatsApp da clínica", url: linkUrl });
      } catch {
        // usuario cancelou o compartilhamento - nada a fazer
      }
    } else {
      copyLink();
    }
  }

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

  // Gera o QR automaticamente ao abrir (o usuario ja clicou "Conectar WhatsApp"
  // pra chegar aqui, nao precisa de mais um clique pra ver o QR).
  useEffect(() => {
    if (open && !requestedQrOnce.current) {
      requestedQrOnce.current = true;
      generateQr();
    }
    if (!open) {
      requestedQrOnce.current = false;
      setQrState("idle");
      setQrBase64(null);
      setQrError(null);
      setLinkState("idle");
      setLinkUrl(null);
      setLinkError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Enquanto o modal estiver aberto, verifica a cada poucos segundos se a
  // sessao foi conectada (depois de escanear o QR) - detecta e fecha sozinho,
  // sem precisar atualizar a pagina.
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
      <div className="modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
        </div>

        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
            Só com o celular em mãos? Gere um link para abrir o QR Code em outro aparelho (computador, tablet ou outro celular).
          </p>

          {linkState !== "ready" && (
            <button className="btn btn-secondary" onClick={generateLink} disabled={linkState === "loading"}>
              {linkState === "loading" ? "Gerando link..." : "🔗 Gerar link para abrir em outro aparelho"}
            </button>
          )}

          {linkState === "error" && <p style={{ fontSize: 12.5, color: "var(--red)", marginTop: 10 }}>❌ {linkError}</p>}

          {linkState === "ready" && linkUrl && (
            <div>
              <p style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 8 }}>Link válido por 10 minutos:</p>
              <div
                style={{
                  fontSize: 12,
                  wordBreak: "break-all",
                  background: "var(--border-soft)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  marginBottom: 10,
                }}
              >
                {linkUrl}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={copyLink}>
                  Copiar link
                </button>
                <button className="btn btn-secondary" onClick={shareLink}>
                  Compartilhar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
