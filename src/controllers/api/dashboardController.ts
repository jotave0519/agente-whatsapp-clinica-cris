import { Request, Response } from "express";
import * as conversationRepository from "../../repositories/conversationRepository";
import * as scheduleEventRepository from "../../repositories/scheduleEventRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as transactionRepository from "../../repositories/transactionRepository";
import * as userRepository from "../../repositories/userRepository";
import * as financeService from "../../services/financeService";
import { logger } from "../../utils/logger";

const SCOPE = "api.dashboard";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monta os ultimos `days` dias (rotulados dd/mm) com contagem de confirmed/cancelled/rescheduled a partir de schedule_events. */
function buildConfirmationsChart(
  events: { event_type: string; created_at: string }[],
  days: number
): { label: string; confirmed: number; cancelled: number; rescheduled: number }[] {
  const buckets = new Map<string, { confirmed: number; cancelled: number; rescheduled: number }>();
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i += 1) {
    buckets.set(toDateStr(cursor), { confirmed: 0, cancelled: 0, rescheduled: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const ev of events) {
    const day = ev.created_at.slice(0, 10);
    const bucket = buckets.get(day);
    if (!bucket) continue;
    if (ev.event_type === "confirmed") bucket.confirmed += 1;
    else if (ev.event_type === "cancelled") bucket.cancelled += 1;
    else if (ev.event_type === "rescheduled") bucket.rescheduled += 1;
  }

  return [...buckets.entries()].map(([day, counts]) => {
    const [, month, d] = day.split("-");
    return { label: `${d}/${month}`, ...counts };
  });
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const today = toDateStr(now);
    const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      activePatients,
      todayAppointments,
      monthAppointments,
      recentConversations,
      waitingConversations,
      monthTransactions,
      monthlySeries,
      awaitingConfirmation,
      confirmationEvents,
    ] = await Promise.all([
      userRepository.count(),
      scheduleRepository.findSchedulesByDate(today),
      scheduleRepository.findByDateRange(monthStart, monthEnd),
      conversationRepository.listRecent(5),
      conversationRepository.countByStatus("human"),
      transactionRepository.listByDateRange(monthStart, monthEnd),
      financeService.getMonthlyFinanceSeries(12, now),
      scheduleRepository.countByConfirmationStatus("awaiting"),
      scheduleEventRepository.countByTypeSince(["confirmed", "cancelled", "rescheduled"], thirtyDaysAgo),
    ]);

    const revenueThisMonth = monthTransactions
      .filter((t) => t.type === "receita" && t.status === "pago")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const revenueChart = monthlySeries.map((m) => ({ label: m.label, value: m.in }));
    const confirmationsChart = buildConfirmationsChart(confirmationEvents, 30);

    res.json({
      kpis: {
        activePatients,
        appointmentsThisMonth: monthAppointments.length,
        revenueThisMonth,
        conversationsWaiting: waitingConversations,
        awaitingConfirmation,
      },
      revenueChart,
      confirmationsChart,
      todayAppointments,
      recentConversations,
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao montar dashboard", err);
    res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
}
