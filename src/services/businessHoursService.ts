import * as businessHourExceptionRepository from "../repositories/businessHourExceptionRepository";
import * as businessHourSlotRepository from "../repositories/businessHourSlotRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import { BusinessHourException, BusinessHourRow, BusinessHourSlot } from "../types";

const CACHE_TTL_MS = 60_000;
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

let cachedRows: BusinessHourRow[] | null = null;
let cachedAt = 0;
let cachedExceptions: BusinessHourException[] | null = null;
let cachedExceptionsAt = 0;
let cachedSlots: BusinessHourSlot[] | null = null;
let cachedSlotsAt = 0;

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

async function loadSlots(): Promise<BusinessHourSlot[]> {
  if (cachedSlots && Date.now() - cachedSlotsAt < CACHE_TTL_MS) return cachedSlots;
  cachedSlots = await businessHourSlotRepository.listAll();
  cachedSlotsAt = Date.now();
  return cachedSlots;
}

/** Invalidado apos qualquer PATCH em /settings ou escrita em /business-hours/exceptions ou /business-hours/slots. */
export function invalidateCache(): void {
  cachedRows = null;
  cachedExceptions = null;
  cachedSlots = null;
}

function shortTime(time: string): string {
  return time.slice(0, 5);
}

export interface DaySlots {
  enabled: boolean;
  slots: string[]; // "HH:MM", ordenados
}

/**
 * Usado pelo googleCalendarClient para saber exatamente quais horarios
 * oferecer num dia especifico - nunca gera horarios automaticamente, so
 * devolve a lista cadastrada (business_hour_slots) pro dia da semana
 * correspondente, com excecoes (business_hour_exceptions) tendo prioridade
 * total: fechado cancela o dia inteiro; um array de horarios customizado
 * substitui os slots normais da semana; sem excecao ou sem personalizacao,
 * usa os slots normais.
 */
export async function getDaySlots(date: string): Promise<DaySlots> {
  const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
  const rows = await loadRows();
  const row = rows.find((r) => r.weekday === weekday);
  const allSlots = await loadSlots();
  const weekdaySlots = allSlots.filter((s) => s.weekday === weekday).map((s) => shortTime(s.time));

  let enabled = row?.enabled ?? false;
  let slots = weekdaySlots;

  const exceptions = await loadExceptions();
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    if (exception.closed) {
      enabled = false;
      slots = [];
    } else if (exception.slots && exception.slots.length > 0) {
      enabled = true;
      slots = exception.slots.map(shortTime);
    } else {
      enabled = true; // sem personalizacao - usa os slots normais da semana
    }
  }

  // Normalizacao: nenhum horario cadastrado = fechado, independente do toggle -
  // protege automaticamente qualquer consumidor do caso "dia marcado como
  // aberto mas sem nenhum horario cadastrado ainda".
  if (slots.length === 0) enabled = false;

  return { enabled, slots: [...slots].sort() };
}

/** Usado no prompt de FAQ para descrever o horario de funcionamento real. */
export async function describeWeeklyHoursLabel(): Promise<string> {
  const rows = await loadRows();
  const allSlots = await loadSlots();
  const sorted = [...rows].sort((a, b) => a.weekday - b.weekday);

  const groups: { label: string; days: number[] }[] = [];
  for (const row of sorted) {
    const weekdaySlots = allSlots.filter((s) => s.weekday === row.weekday).map((s) => shortTime(s.time)).sort();
    const label = row.enabled && weekdaySlots.length > 0 ? weekdaySlots.join(", ") : "fechado";
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
    return g.label === "fechado" ? `fechado ${dayNames}` : `${dayNames}: ${g.label}`;
  });

  return parts.join(" — ");
}
