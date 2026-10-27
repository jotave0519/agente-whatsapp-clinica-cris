import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// Janela "segura" para atualizar sozinho: logo depois de abrir o app ou de
// voltar pra ele (vindo de outro app / tela bloqueada). Nesse momento a pessoa
// ainda nao comecou a digitar nada, entao recarregar nao perde trabalho.
const SAFE_WINDOW_MS = 20_000;
// Alem da checagem ao abrir/voltar, procura versao nova de tempos em tempos.
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Ha algo em andamento que um reload faria perder? (modal aberto ou campo em foco) */
function userIsBusy(): boolean {
  if (document.querySelector(".modal-overlay")) return true;
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);
}

/**
 * Atualizacao do app (PWA). Registra o service worker manualmente
 * (vite.config.ts usa injectRegister: null de proposito, pra nao registrar
 * duas vezes).
 *
 * Atualiza SOZINHO quando acha versao nova logo apos abrir/voltar pro app e
 * nada esta em andamento - a doutora nao precisa saber de botao nenhum. Se a
 * versao nova chegar no meio do uso (modal aberto, digitando), nao recarrega
 * debaixo dela: mostra o aviso "Atualizar agora" como antes.
 */
export function UpdatePrompt() {
  const resumedAt = useRef(Date.now());

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          resumedAt.current = Date.now();
          check();
        }
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const inSafeWindow = Date.now() - resumedAt.current < SAFE_WINDOW_MS;
    if (inSafeWindow && !userIsBusy()) {
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(var(--bottom-nav-height, 0px) + var(--safe-bottom, 0px) + 16px)",
        transform: "translateX(-50%)",
        zIndex: 85,
        width: "calc(100% - 32px)",
        maxWidth: 380,
      }}
    >
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          boxShadow: "0 10px 28px rgba(35, 32, 28, 0.18)",
        }}
      >
        <span style={{ fontSize: 13, flex: 1 }}>Nova versão disponível.</span>
        <button className="btn" style={{ height: 32, padding: "0 12px", fontSize: 12.5, flexShrink: 0 }} onClick={() => updateServiceWorker(true)}>
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
