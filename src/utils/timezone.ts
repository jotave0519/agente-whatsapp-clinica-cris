const SAO_PAULO_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Extrai a data/hora "de parede" de America/Sao_Paulo (UTC-3, sem horario de
 * verao desde 2019 - por isso o offset fixo) a partir de um instante absoluto.
 *
 * Usado para preencher schedules.date/schedules.time: essas colunas sao
 * exibidas diretamente como horario local em toda a aplicacao (Agenda,
 * Dashboard, etc.), entao precisam representar a hora local, nao UTC.
 * Usar `date.toISOString()` aqui e o bug classico que fazia um agendamento
 * as 17:15 local ser salvo como 20:15 (a hora em UTC).
 */
export function toSaoPauloDateTimeParts(date: Date): { date: string; time: string } {
  const local = new Date(date.getTime() - SAO_PAULO_OFFSET_MS);
  return {
    date: local.toISOString().slice(0, 10),
    time: local.toISOString().slice(11, 16),
  };
}
