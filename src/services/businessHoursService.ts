import * as settingsRepository from "../repositories/settingsRepository";
import { BusinessHourRow } from "../types";

const CACHE_TTL_MS = 60_000;
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

let cachedRows: BusinessHourRow[] | null = null;
let cachedAt = 0;

async function loadRows(): Promise<BusinessHourRow[]> {
  if (cachedRows && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRows;
  cachedRows = await settingsRepository.getBusinessHours();
  cachedAt = Date.now();
  return cachedRows;
}

/** Invalidado apos qualquer PATCH em /settings, para refletir a mudanca no proximo turno/consulta. */
export function invalidateCache(): void {
  cachedRows = null;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}

/** Usado pelo googleCalendarClient para saber se/quando um dia especifico esta aberto. */
export async function getDayHours(date: string): Promise<{ enabled: boolean; open: string; close: string }> {
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const rows = await loadRows();
  const row = rows.find((r) => r.weekday === weekday);
  if (!row) return { enabled: false, open: "08:00", close: "18:00" };
  return { enabled: row.enabled, open: shortTime(row.open_time), close: shortTime(row.close_time) };
}

/** Usado no prompt de FAQ para descrever o horario de funcionamento real. */
export async function describeWeeklyHoursLabel(): Promise<string> {
  const rows = await loadRows();
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday);

  const groups: { label: string; days: number[] }[] = [];
  for (const row of sorted) {
    const label = row.enabled ? `${shortTime(row.open_time)} às ${shortTime(row.close_time)}` : "fechado";
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.days.push(row.weekday);
    } else {
      groups.push({ label, days: [row.weekday] });
    }
  }

  const parts = groups.map((g) => {
    const dayNames =
      g.days.length > 1
        ? `${WEEKDAY_LABELS[g.days[0]]} a ${WEEKDAY_LABELS[g.days[g.days.length - 1]]}`
        : WEEKDAY_LABELS[g.days[0]];
    return g.label === "fechado" ? `fechado ${dayNames}` : `${dayNames}, ${g.label}`;
  });

  return parts.join(" — ");
}
