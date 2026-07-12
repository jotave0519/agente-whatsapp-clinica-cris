import * as transactionRepository from "../repositories/transactionRepository";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export interface MonthlyFinanceEntry {
  label: string;
  in: number;
  out: number;
}

/**
 * Serie mensal de receitas pagas ("in") e despesas ("out"), dos ultimos
 * `monthsBack` meses (incluindo o mes de referencia). Fonte unica de calculo
 * usada tanto pelo Financeiro (grafico de 6 meses) quanto pelo Dashboard
 * (grafico de faturamento de 12 meses) - nao deve existir logica de
 * agrupamento por mes duplicada em outro lugar do backend.
 */
export async function getMonthlyFinanceSeries(monthsBack: number, referenceDate: Date = new Date()): Promise<MonthlyFinanceEntry[]> {
  const rangeStart = toDateStr(new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1), 1));
  const rangeEnd = toDateStr(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0));
  const transactions = await transactionRepository.listByDateRange(rangeStart, rangeEnd);

  const series: MonthlyFinanceEntry[] = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const monthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const start = toDateStr(monthDate);
    const end = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    const monthTx = transactions.filter((t) => t.occurred_on >= start && t.occurred_on <= end);
    series.push({
      label: monthLabel(monthDate),
      in: monthTx.filter((t) => t.type === "receita" && t.status === "pago").reduce((acc, t) => acc + Number(t.amount), 0),
      out: monthTx.filter((t) => t.type === "despesa").reduce((acc, t) => acc + Number(t.amount), 0),
    });
  }
  return series;
}
