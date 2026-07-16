export interface ScheduleStatusFields {
  status: string;
  confirmation_status: "pending" | "awaiting" | "confirmed" | "cancelled";
  was_rescheduled: boolean;
}

export interface DisplayStatus {
  label: string;
  cls: string;
  /** Cor do indicador do calendario (dot) - só as 5 situações voltadas para agendamentos futuros têm cor definida no pedido. */
  dot: string | null;
}

/**
 * Unifica schedule.status + confirmation_status + was_rescheduled num dos 7
 * rótulos pedidos. Regras (nessa ordem de prioridade):
 * Cancelado > Faltou > Realizado > Confirmado > Aguardando confirmação > Remarcado > Agendado.
 */
export function getDisplayStatus(s: ScheduleStatusFields): DisplayStatus {
  if (s.status === "Cancelado") return { label: "🔴 Cancelado", cls: "badge-red", dot: "var(--red)" };
  if (s.status === "Faltou") return { label: "Faltou", cls: "badge-red", dot: null };
  if (s.status === "Concluido") return { label: "Realizado", cls: "badge-neutral", dot: null };
  if (s.confirmation_status === "confirmed") return { label: "🟢 Confirmado", cls: "badge-green", dot: "var(--green)" };
  if (s.confirmation_status === "awaiting") return { label: "🟡 Aguardando confirmação", cls: "badge-yellow", dot: "var(--yellow)" };
  if (s.was_rescheduled) return { label: "🔵 Remarcado", cls: "badge-blue", dot: "var(--blue)" };
  return { label: "⚪ Agendado", cls: "badge-neutral", dot: "var(--text-faint)" };
}
