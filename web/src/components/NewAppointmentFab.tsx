import { useIsMobile } from "../hooks/useIsMobile";
import { useAppointmentModal } from "../context/AppointmentModalContext";
import { PlusIcon } from "./icons";

interface Props {
  /** Opcional: encolhe o FAB (ex: durante o scroll da Agenda) pra nunca cobrir um agendamento. */
  hidden?: boolean;
}

/** FAB visivel apenas em mobile (no desktop o botao "Novo agendamento" ja vive no Topbar). */
export function NewAppointmentFab({ hidden }: Props) {
  const isMobile = useIsMobile();
  const { open } = useAppointmentModal();

  if (!isMobile) return null;

  return (
    <button
      className="fab"
      aria-label="Novo agendamento"
      onClick={open}
      style={hidden ? { transform: "scale(0.001)", opacity: 0 } : undefined}
    >
      <PlusIcon width={24} height={24} />
    </button>
  );
}
