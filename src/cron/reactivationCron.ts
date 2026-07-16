import cron from "node-cron";
import * as reactivationEngine from "../services/reactivationEngine";

/**
 * Dois estagios, mesmo padrao de src/cron/reminderEngineCron.ts coexistindo
 * com src/cron/inactivityCron.ts: um scan pesado 1x/dia (classifica pacientes
 * inativos por campanha) e um envio leve a cada minuto (processa a fila de
 * mensagens vencidas, respeitando dia/horario permitido de cada campanha).
 */
export function scheduleReactivationScanCron(): void {
  cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        const result = await reactivationEngine.scanEligiblePatients();
        if (result.created > 0) {
          console.log(`Reativacao de pacientes: ${result.created} novo(s) paciente(s) elegivel(is) hoje`);
        }
      } catch (err) {
        console.error("Erro no scan diario de reativacao de pacientes:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}

export function scheduleReactivationSendCron(): void {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const result = await reactivationEngine.processDueMessages();
        if (result.sent > 0 || result.skipped > 0 || result.failed > 0) {
          console.log(`Reativacao de pacientes: enviados=${result.sent} pulados=${result.skipped} falhas=${result.failed}`);
        }
      } catch (err) {
        console.error("Erro no envio de mensagens de reativacao:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}
