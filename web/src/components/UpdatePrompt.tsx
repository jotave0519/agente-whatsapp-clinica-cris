import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Aviso discreto de nova versao (nunca atualiza sozinho, so quando o
 * usuario clicar) - registra o service worker manualmente (vite.config.ts
 * usa injectRegister: null de proposito, pra nao registrar duas vezes).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

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
