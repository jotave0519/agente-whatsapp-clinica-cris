import cron from "node-cron";
import { checkInactivity } from "../services/inactivityService";

/**
 * Roda a cada minuto verificando conversas paradas: envia um lembrete amigavel
 * apos 5 minutos sem resposta do cliente e encerra apos mais 5 (10 min total).
 * Ver workflows/atendimento_faq.md, secao de controle de inatividade.
 */
export function scheduleInactivityCron(): void {
  cron.schedule("* * * * *", async () => {
    try {
      const result = await checkInactivity();
      if (result.nudged > 0 || result.closed > 0) {
        console.log(`Inatividade: lembretes=${result.nudged} encerramentos=${result.closed}`);
      }
    } catch (err) {
      console.error("Erro na verificacao de inatividade:", err);
    }
  });
}
