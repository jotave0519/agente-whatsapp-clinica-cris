import * as scheduleRepository from "../repositories/scheduleRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";
import * as aiKnowledgeService from "./aiKnowledgeService";

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function sendDailyReminders(): Promise<{ sent: number; skipped: number; failed: number }> {
  const date = tomorrowDate();
  const schedules = await scheduleRepository.findSchedulesNeedingReminder(date);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  if (schedules.length === 0) return { sent, skipped, failed };

  const settings = await settingsRepository.getClinicSettings();
  const [, month, day] = date.split("-");

  for (const schedule of schedules) {
    if (!schedule.phone) {
      skipped += 1;
      continue;
    }

    const text = await aiKnowledgeService.getMessageTemplate("appointment_reminder", {
      patientName: schedule.patient_name,
      procedure: schedule.procedure,
      date: `${day}/${month}`,
      time: schedule.time,
      address: settings.address || "",
    });

    try {
      await sendWhatsAppMessage(schedule.phone, text);
      await scheduleRepository.markReminderSent(schedule.id);
      sent += 1;
    } catch (err) {
      console.error(`Falha ao enviar lembrete para ${schedule.phone}:`, err);
      failed += 1;
    }
  }

  return { sent, skipped, failed };
}
