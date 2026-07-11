import * as businessHourExceptionRepository from "../repositories/businessHourExceptionRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import { BusinessHourException, BusinessHourRow } from "../types";

const CACHE_TTL_MS = 60_000;
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

let cachedRows: BusinessHourRow[] | null = null;
let cachedAt = 0;
let cachedExceptions: BusinessHourException[] | null = null;
let cachedExceptionsAt = 0;

async function loadRows(): Promise<BusinessHourRow[]> {
  if (cachedRows && Date.now() - cachedAt < CACHE_TTL_MS) return cachedRows;
  cachedRows = await settingsRepository.getBusinessHours();
  cachedAt = Date.now();
  return cachedRows;
}

async function loadExceptions(): Promise<BusinessHourException[]> {
  if (cachedExceptions && Date.now() - cachedExceptionsAt < CACHE_TTL_MS) return cachedExceptions;
  cachedExceptions = await businessHourExceptionRepository.listAll();
  cachedExceptionsAt = Date.now();
  return cachedExceptions;
}

/** Invalidado apos qualquer PATCH em /settings ou escrita em /business-hours/exceptions. */
export function invalidateCache(): void {
  cachedRows = null;
  cachedExceptions = null;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}

export interface DayHours {
  enabled: boolean;
  open: string;
  close: string;
  lunchStart: string | null;
  lunchEnd: string | null;
}

/**
 * Usado pelo googleCalendarClient para saber se/quando um dia especifico esta
 * aberto. Feriados/bloqueios/dias especiais cadastrados em
 * business_hour_exceptions tem prioridade sobre o horario padrao da semana.
 */
export async function getDayHours(date: string): Promise<DayHours> {
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const rows = await loadRows();
  const row = rows.find((r) => r.weekday === weekday);
  const lunchStart = row?.lunch_start ? shortTime(row.lunch_start) : null;
  const lunchEnd = row?.lunch_end ? shortTime(row.lunch_end) : null;

  const exceptions = await loadExceptions();
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    if (exception.closed) {
      return { enabled: false, open: "08:00", close: "18:00", lunchStart: null, lunchEnd: null };
    }
    return {
      enabled: true,
      open: exception.open_time ? shortTime(exception.open_time) : row?.open_time ? shortTime(row.open_time) : "08:00",
      close: exception.close_time ? shortTime(exception.close_time) : row?.close_time ? shortTime(row.close_time) : "18:00",
      lunchStart,
      lunchEnd,
    };
  }

  if (!row) return { enabled: false, open: "08:00", close: "18:00", lunchStart: null, lunchEnd: null };
  return { enabled: row.enabled, open: shortTime(row.open_time), close: shortTime(row.close_time), lunchStart, lunchEnd };
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
