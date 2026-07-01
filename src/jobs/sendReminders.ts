/**
 * Execucao manual/externa da rotina de lembretes (alternativa ao cron in-process
 * do server.ts, util se preferir agendar via Task Scheduler / cron do sistema).
 *
 * Uso: npm run reminders
 */
import { sendDailyReminders } from "../services/reminderService";

sendDailyReminders()
  .then((result) => {
    console.log(
      `Lembretes: enviados=${result.sent} pulados=${result.skipped} falhas=${result.failed}`
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("Erro na rotina de lembretes:", err);
    process.exit(1);
  });
