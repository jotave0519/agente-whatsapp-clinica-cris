import cron from "node-cron";
import * as reminderEngine from "../services/reminderEngine";

/**
 * Roda a cada minuto processando o lote de lembretes vencidos (mesma cadencia
 * de src/cron/inactivityCron.ts). O controle fino de ligar/desligar cada
 * camada (48h/24h/3h) fica dentro de reminderEngine.processDueReminders(),
 * checado por lembrete contra clinic_settings - nao precisa de uma flag unica
 * aqui.
 */
export function scheduleReminderEngineCron(): void {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const result = await reminderEngine.processDueReminders();
        if (result.sent > 0 || result.skipped > 0 || result.failed > 0) {
          console.log(`Lembretes de consulta: enviados=${result.sent} pulados=${result.skipped} falhas=${result.failed}`);
        }
      } catch (err) {
        console.error("Erro na rotina de lembretes de consulta:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}
