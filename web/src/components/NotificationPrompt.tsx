import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  getPushPermissionState,
  iosNeedsHomeScreenInstall,
  isPushSupported,
  PUSH_PROMPT_DISMISSED_KEY,
  subscribeToPush,
} from "../lib/pushNotifications";

// Delay maior que o do InstallPrompt (2500ms) pra evitar os dois modais
// disputando a tela ao mesmo tempo no primeiro acesso.
const SHOW_DELAY_MS = 5000;

function wasDismissedBefore(): boolean {
  try {
    return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
  } catch {
    // localStorage indisponivel - o modal so volta a aparecer nessa sessao
  }
}

/**
 * Convite explicito pra ativar notificacoes push - so pede a permissao do
 * sistema depois que a usuaria clica em "Ativar notificacoes" (nunca
 * automaticamente). No iPhone, so oferece o botao se o PWA ja estiver
 * instalado na Tela de Inicio (pre-requisito do Web Push no iOS 16.4+);
 * caso contrario, orienta a instalar primeiro.
 */
export function NotificationPrompt() {
  const isMobile = useIsMobile();
  const showToast = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  useBodyScrollLock(visible);

  useEffect(() => {
    if (!isMobile || wasDismissedBefore()) return;
    const needsIosInstall = iosNeedsHomeScreenInstall();
    const canOffer = needsIosInstall || (isPushSupported() && getPushPermissionState() === "default");
    if (!canOffer) return;

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isMobile]);

  function dismiss() {
    setVisible(false);
    markDismissed();
  }

  async function handleActivateClick() {
    setLoading(true);
    try {
      const result = await subscribeToPush();
      if (result === "subscribed") {
        showToast("Notificações ativadas!");
      } else if (result === "denied") {
        showToast("Permissão de notificações não concedida.");
      }
    } catch {
      showToast("Não foi possível ativar as notificações agora.");
    } finally {
      setLoading(false);
      dismiss();
    }
  }

  if (!visible) return null;

  const needsIosInstall = iosNeedsHomeScreenInstall();

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal-card" style={{ maxWidth: 360, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔔</div>
        <div style={{ fontSize: 16.5, fontWeight: 600, marginBottom: 8 }}>Receba lembretes dos seus atendimentos</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: needsIosInstall ? 16 : 20 }}>
          Ative as notificações para receber um aviso no celular antes dos seus próximos atendimentos.
        </p>

        {needsIosInstall ? (
          <>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--text-muted)",
                lineHeight: 1.6,
                marginBottom: 16,
                textAlign: "left",
                background: "var(--border-soft)",
                padding: 12,
                borderRadius: 10,
              }}
            >
              No iPhone, as notificações só funcionam com o app adicionado à Tela de Início. Toque em{" "}
              <strong>Compartilhar</strong> (o ícone com a seta ↑) e depois em <strong>"Adicionar à Tela de Início"</strong>.
            </p>
            <button className="btn" style={{ width: "100%" }} onClick={dismiss}>
              Entendi
            </button>
          </>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={handleActivateClick} disabled={loading}>
              {loading ? "Ativando…" : "Ativar notificações"}
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={dismiss} disabled={loading}>
              Agora não
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
