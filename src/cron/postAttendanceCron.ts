import cron from "node-cron";
import * as postAttendanceEngine from "../services/postAttendanceEngine";

/**
 * Dois estagios, mesmo padrao de src/cron/reactivationCron.ts: uma varredura
 * a cada 15 min (detecta consultas cujo horario passou sem ninguem marcar o
 * desfecho manualmente) e um envio leve a cada minuto (processa a fila de
 * mensagens vencidas, revalidando seguranca no momento do envio).
 */
export function schedulePostAttendanceScanCron(): void {
  cron.schedule(
    "*/15 * * * *",
    async () => {
      try {
        const result = await postAttendanceEngine.scanTimeElapsedSchedules();
        if (result.enrolled > 0) {
          console.log(`Pos-atendimento: ${result.enrolled} agendamento(s) matriculado(s) por horario decorrido`);
        }
      } catch (err) {
        console.error("Erro na varredura de pos-atendimento por horario decorrido:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}

export function schedulePostAttendanceSendCron(): void {
  cron.schedule(
    "* * * * *",
    async () => {
      try {
        const result = await postAttendanceEngine.processDueMessages();
        if (result.sent > 0 || result.skipped > 0 || result.failed > 0) {
          console.log(`Pos-atendimento: enviados=${result.sent} pulados=${result.skipped} falhas=${result.failed}`);
        }
      } catch (err) {
        console.error("Erro no envio de mensagens de pos-atendimento:", err);
      }
    },
    { timezone: "America/Sao_Paulo" }
  );
}
