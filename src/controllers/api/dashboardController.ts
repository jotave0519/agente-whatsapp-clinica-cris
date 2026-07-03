import { Request, Response } from "express";
import * as conversationRepository from "../../repositories/conversationRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as transactionRepository from "../../repositories/transactionRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.dashboard";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const today = toDateStr(now);
    const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const twelveMonthsAgoStart = toDateStr(new Date(now.getFullYear(), now.getMonth() - 11, 1));

    const [activePatients, todayAppointments, monthAppointments, recentConversations, waitingConversations, monthTransactions, yearTransactions] =
      await Promise.all([
        userRepository.count(),
        scheduleRepository.findSchedulesByDate(today),
        scheduleRepository.findByDateRange(monthStart, monthEnd),
        conversationRepository.listRecent(5),
        conversationRepository.countByStatus("human"),
        transactionRepository.listByDateRange(monthStart, monthEnd),
        transactionRepository.listByDateRange(twelveMonthsAgoStart, monthEnd),
      ]);

    const revenueThisMonth = monthTransactions
      .filter((t) => t.type === "receita" && t.status === "pago")
      .reduce((acc, t) => acc + Number(t.amount), 0);

    const revenueChart: { label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = toDateStr(monthDate);
      const end = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      const value = yearTransactions
        .filter((t) => t.type === "receita" && t.status === "pago" && t.occurred_on >= start && t.occurred_on <= end)
        .reduce((acc, t) => acc + Number(t.amount), 0);
      revenueChart.push({ label: monthLabel(monthDate), value });
    }

    res.json({
      kpis: {
        activePatients,
        appointmentsThisMonth: monthAppointments.length,
        revenueThisMonth,
        conversationsWaiting: waitingConversations,
      },
      revenueChart,
      todayAppointments,
      recentConversations,
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao montar dashboard", err);
    res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
}
