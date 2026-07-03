import cron from "node-cron";
import * as settingsRepository from "../repositories/settingsRepository";
import { checkInactivity } from "../services/inactivityService";

/**
 * Roda a cada minuto verificando conversas paradas: envia um lembrete amigavel
 * apos 5 minutos sem resposta do cliente e encerra apos mais 5 (10 min total).
 * Ver workflows/atendimento_faq.md, secao de controle de inatividade.
 * Pode ser desligado pela tela WhatsApp do CRM (clinic_settings.inactivity_nudge_enabled).
 */
export function scheduleInactivityCron(): void {
  cron.schedule("* * * * *", async () => {
    try {
      const settings = await settingsRepository.getClinicSettings();
      if (!settings.inactivity_nudge_enabled) return;
    } catch (err) {
      console.error("Erro ao checar clinic_settings.inactivity_nudge_enabled (seguindo com nudge ligado):", err);
    }

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
