import cron from "node-cron";
import { sendDailyReminders } from "../services/reminderService";

/**
 * Roda todo dia util as 08:00 (America/Sao_Paulo) e dispara os lembretes
 * de consulta do dia seguinte (ver workflows/lembretes_confirmacoes.md).
 */
export function scheduleReminderCron(): void {
  cron.schedule(
    "0 8 * * 1-5",
    async () => {
      console.log("Executando rotina diaria de lembretes...");
      try {
        const result = await sendDailyReminders();
        console.log(
          `Lembretes: enviados=${result.sent} pulados=${result.skipped} falhas=${result.failed}`
        );
      } catch (err) {
        console.error("Erro na rotina de lembretes:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}
