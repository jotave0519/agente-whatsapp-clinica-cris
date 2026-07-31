import { useState } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { InfoIcon, XIcon } from "./icons";

interface Props {
  title: string;
  text: string;
}

/**
 * Icone (i) que abre um popover explicando a funcionalidade com mais
 * detalhes. Implementado como modal centralizado (nao bolha ancorada) de
 * proposito: uma bolha flutuante perto do icone precisaria de logica de
 * colisao com a borda da tela pra nao cortar em telas pequenas, e isso nao
 * da pra validar sem ferramenta de navegador nesta sessao. Modal centralizado
 * funciona em qualquer tamanho de tela sem risco de corte.
 */
export function InfoTooltip({ title, text }: Props) {
  const [open, setOpen] = useState(false);
  useBodyScrollLock(open);

  return (
    <>
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Mais informações sobre ${title}`}
      >
        <InfoIcon width={14} height={14} />
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</div>
              <button className="mobile-icon-btn" style={{ marginTop: -6, marginRight: -8, flexShrink: 0 }} onClick={() => setOpen(false)}>
                <XIcon />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{text}</p>
          </div>
        </div>
      )}
    </>
  );
}
