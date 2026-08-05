import { useEffect, useState } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useIsMobile } from "../hooks/useIsMobile";
import { INSTALL_PROMPT_SEEN_KEY, isIos, promptInstall, useInstallState } from "../lib/pwaInstall";

const SHOW_DELAY_MS = 2500;

function wasDismissedBefore(): boolean {
  try {
    return localStorage.getItem(INSTALL_PROMPT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(INSTALL_PROMPT_SEEN_KEY, "1");
  } catch {
    // localStorage indisponivel - o modal so volta a aparecer nessa sessao
  }
}

/**
 * Modal de instalacao personalizado (substitui o popup padrao do navegador).
 * So aparece no celular, uma vez, quando o navegador sinaliza que a
 * instalacao e possivel (Android/Chrome/Edge/Samsung Internet via
 * beforeinstallprompt) ou no Safari do iPhone (que nunca dispara esse
 * evento - mostra instrucoes manuais em vez de um botao).
 */
export function InstallPrompt() {
  const isMobile = useIsMobile();
  const { deferredPrompt, installed } = useInstallState();
  const [visible, setVisible] = useState(false);
  useBodyScrollLock(visible);

  useEffect(() => {
    if (!isMobile || installed || wasDismissedBefore()) return;
    const canShow = !!deferredPrompt || isIos();
    if (!canShow) return;

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isMobile, installed, deferredPrompt]);

  function dismiss() {
    setVisible(false);
    markDismissed();
  }

  async function handleInstallClick() {
    const outcome = await promptInstall();
    if (outcome !== "unavailable") {
      setVisible(false);
      markDismissed();
    }
  }

  if (!visible) return null;

  const ios = isIos();

  return (
    <div className="modal-overlay" onClick={dismiss}>
      <div className="modal-card" style={{ maxWidth: 360, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
        <div style={{ fontSize: 16.5, fontWeight: 600, marginBottom: 8 }}>Instale o aplicativo</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
          Tenha acesso mais rápido ao CRM diretamente pela tela inicial do celular.
        </p>
        <div style={{ textAlign: "left", display: "grid", gap: 7, marginBottom: 20, fontSize: 13 }}>
          <div>✔ Abre como um aplicativo</div>
          <div>✔ Muito mais rápido</div>
          <div>✔ Sem precisar abrir o navegador</div>
        </div>

        {ios ? (
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
              Toque em <strong>Compartilhar</strong> (o ícone com a seta ↑) e depois em <strong>"Adicionar à Tela de Início"</strong>.
            </p>
            <button className="btn" style={{ width: "100%" }} onClick={dismiss}>
              Entendi
            </button>
          </>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" style={{ flex: 1 }} onClick={handleInstallClick}>
              Instalar aplicativo
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={dismiss}>
              Agora não
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
