import { useIsMobile } from "../hooks/useIsMobile";
import { useAppointmentModal } from "../context/AppointmentModalContext";
import { PlusIcon } from "./icons";

/** FAB visivel apenas em mobile (no desktop o botao "Novo agendamento" ja vive no Topbar). */
export function NewAppointmentFab() {
  const isMobile = useIsMobile();
  const { open } = useAppointmentModal();

  if (!isMobile) return null;

  return (
    <button className="fab" aria-label="Novo agendamento" onClick={open}>
      <PlusIcon width={24} height={24} />
    </button>
  );
}
