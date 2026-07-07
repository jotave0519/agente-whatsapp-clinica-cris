import { ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * No desktop, o formulario continua embutido na pagina (comportamento atual,
 * intocado). No mobile, o mesmo conteudo passa a abrir como bottom sheet -
 * evita empurrar a tela toda para baixo com um formulario longo embutido.
 */
export function FormSheet({ open, onClose, children }: Props) {
  const isMobile = useIsMobile();

  if (!open) return null;
  if (!isMobile) return <>{children}</>;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
