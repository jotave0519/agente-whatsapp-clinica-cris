import { Request, Response } from "express";
import * as conversationRepository from "../../repositories/conversationRepository";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as userRepository from "../../repositories/userRepository";
import { logger } from "../../utils/logger";

const SCOPE = "api.dashboard";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const today = toDateStr(now);
    const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    const [activePatients, todayAppointments, monthAppointments, recentConversations] = await Promise.all([
      userRepository.count(),
      scheduleRepository.findSchedulesByDate(today),
      scheduleRepository.findByDateRange(monthStart, monthEnd),
      conversationRepository.listRecent(5),
    ]);

    res.json({
      kpis: {
        activePatients,
        appointmentsThisMonth: monthAppointments.length,
      },
      todayAppointments,
      recentConversations,
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao montar dashboard", err);
    res.status(500).json({ error: "Erro ao carregar dashboard." });
  }
}
