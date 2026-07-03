import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { NewAppointmentModal } from "../components/NewAppointmentModal";

interface AppointmentModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  lastCreatedAt: number;
}

const AppointmentModalContext = createContext<AppointmentModalContextValue | undefined>(undefined);

export function AppointmentModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastCreatedAt, setLastCreatedAt] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const handleCreated = useCallback(() => {
    setLastCreatedAt(Date.now());
    setIsOpen(false);
  }, []);

  return (
    <AppointmentModalContext.Provider value={{ isOpen, open, close, lastCreatedAt }}>
      {children}
      {isOpen && <NewAppointmentModal onClose={close} onCreated={handleCreated} />}
    </AppointmentModalContext.Provider>
  );
}

export function useAppointmentModal(): AppointmentModalContextValue {
  const ctx = useContext(AppointmentModalContext);
  if (!ctx) throw new Error("useAppointmentModal deve ser usado dentro de AppointmentModalProvider");
  return ctx;
}
