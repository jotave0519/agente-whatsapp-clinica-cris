import cron from "node-cron";
import * as settingsRepository from "../repositories/settingsRepository";
import { sendDailyReminders } from "../services/reminderService";

/**
 * Roda todo dia util as 08:00 (America/Sao_Paulo) e dispara os lembretes
 * de consulta do dia seguinte (ver workflows/lembretes_confirmacoes.md).
 * Pode ser desligado pela tela WhatsApp do CRM (clinic_settings.reminders_enabled).
 */
export function scheduleReminderCron(): void {
  cron.schedule(
    "0 8 * * 1-5",
    async () => {
      try {
        const settings = await settingsRepository.getClinicSettings();
        if (!settings.reminders_enabled) {
          console.log("Rotina de lembretes desativada em Configuracoes - pulando.");
          return;
        }
      } catch (err) {
        console.error("Erro ao checar clinic_settings.reminders_enabled (seguindo com lembretes ligados):", err);
      }

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
