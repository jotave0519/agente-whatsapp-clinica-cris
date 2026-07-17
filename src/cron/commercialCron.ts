import cron from "node-cron";
import * as commercialEngine from "../services/commercialEngine";

/**
 * Dois estagios, mesmo padrao de src/cron/postAttendanceCron.ts /
 * reactivationCron.ts: varredura diaria (rede de seguranca pra sinais
 * perdidos, ex: avaliacao sem procedimento depois) + processamento por
 * minuto (envio da fila + progressao/reversao de estagio via
 * checkOpportunityProgress, sem hook em schedulingService/scheduleController).
 */
export function scheduleCommercialScanCron(): void {
  cron.schedule(
    "0 9 * * *",
    async () => {
      try {
        const result = await commercialEngine.scanForMissedSignals();
        if (result.created > 0) {
          console.log(`IA Comercial: ${result.created} nova(s) oportunidade(s) detectada(s) na varredura diaria`);
        }
      } catch (err) {
        console.error("Erro na varredura diaria de oportunidades comerciais:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}

export function scheduleCommercialSendCron(): void {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const result = await commercialEngine.processDueMessages();
        if (result.sent > 0 || result.skipped > 0 || result.failed > 0) {
          console.log(`IA Comercial: enviados=${result.sent} pulados=${result.skipped} falhas=${result.failed}`);
        }
      } catch (err) {
        console.error("Erro no processamento de oportunidades comerciais:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}
