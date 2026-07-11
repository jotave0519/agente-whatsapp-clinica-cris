/**
 * Amostra ate `max` horarios espalhados ao longo de toda a lista (nao so os
 * primeiros cronologicamente) - evita o vies de so mostrar o inicio da manha
 * quando o dia tem muitos horarios livres (ex: sempre 08:00-10:30 num dia com
 * vagas ate as 18h). Se a lista ja cabe dentro do limite, retorna ela inteira.
 */
export function sampleSlotsAcrossDay(slots: string[], max = 8): string[] {
  if (slots.length <= max) return slots;
  const step = slots.length / max;
  const picked: string[] = [];
  for (let i = 0; i < max; i += 1) {
    picked.push(slots[Math.floor(i * step)]);
  }
  return picked;
}
