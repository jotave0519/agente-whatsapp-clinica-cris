import * as scheduleRepository from "../repositories/scheduleRepository";
import { sendWhatsAppMessage } from "../integrations/evolutionApiClient";

const ADDRESS =
  "Estrada Santa Isabel, 965, Sala 23, Edificio Comercial Arujazinho, Aruja - SP";

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildReminderText(patientName: string, procedure: string, date: string, time: string): string {
  const [, month, day] = date.split("-");
  return (
    `Oi, ${patientName}! Passando para lembrar da sua consulta de ${procedure} ` +
    `amanha, dia ${day}/${month} as ${time}, aqui na clinica (${ADDRESS}).\n\n` +
    `Pode confirmar sua presenca respondendo *SIM*? Se precisar remarcar, e so avisar por aqui.`
  );
}

export async function sendDailyReminders(): Promise<{ sent: number; skipped: number; failed: number }> {
  const date = tomorrowDate();
  const schedules = await scheduleRepository.findSchedulesNeedingReminder(date);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const schedule of schedules) {
    if (!schedule.phone) {
      skipped += 1;
      continue;
    }

    const text = buildReminderText(schedule.patient_name, schedule.procedure, schedule.date, schedule.time);

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
