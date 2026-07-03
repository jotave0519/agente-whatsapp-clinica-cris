import { Request, Response } from "express";
import * as scheduleRepository from "../../repositories/scheduleRepository";
import * as transactionRepository from "../../repositories/transactionRepository";
import { Transaction } from "../../types";
import { logger } from "../../utils/logger";

const SCOPE = "api.finance";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sum(transactions: Transaction[]): number {
  return transactions.reduce((acc, t) => acc + Number(t.amount), 0);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export async function getFinanceOverview(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const monthStart = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const sixMonthsAgoStart = toDateStr(new Date(now.getFullYear(), now.getMonth() - 5, 1));
    const ninetyDaysAgo = toDateStr(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));

    const [monthTransactions, sixMonthTransactions, recentSchedules] = await Promise.all([
      transactionRepository.listByDateRange(monthStart, monthEnd),
      transactionRepository.listByDateRange(sixMonthsAgoStart, monthEnd),
      scheduleRepository.findByDateRange(ninetyDaysAgo, toDateStr(now)),
    ]);

    const receitasMes = monthTransactions.filter((t) => t.type === "receita");
    const despesasMes = monthTransactions.filter((t) => t.type === "despesa");
    const receitaTotal = sum(receitasMes.filter((t) => t.status === "pago"));
    const despesaTotal = sum(despesasMes);
    const pendentes = sum(receitasMes.filter((t) => t.status === "pendente"));

    const bars: { label: string; in: number; out: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = toDateStr(monthDate);
      const end = toDateStr(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
      const monthTx = sixMonthTransactions.filter((t) => t.occurred_on >= start && t.occurred_on <= end);
      bars.push({
        label: monthLabel(monthDate),
        in: sum(monthTx.filter((t) => t.type === "receita" && t.status === "pago")),
        out: sum(monthTx.filter((t) => t.type === "despesa")),
      });
    }

    const procCounts = new Map<string, number>();
    const patientCounts = new Map<string, number>();
    for (const s of recentSchedules) {
      procCounts.set(s.procedure, (procCounts.get(s.procedure) || 0) + 1);
      patientCounts.set(s.patient_name, (patientCounts.get(s.patient_name) || 0) + 1);
    }
    const reportProcs = [...procCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    const reportPatients = [...patientCounts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, visits]) => ({ name, visits }));

    const [receitas, despesas] = await Promise.all([
      transactionRepository.listRecentByType("receita", 10),
      transactionRepository.listRecentByType("despesa", 10),
    ]);

    res.json({
      kpis: {
        receita: receitaTotal,
        despesa: despesaTotal,
        lucro: receitaTotal - despesaTotal,
        pendentes,
      },
      chart: bars,
      receitas,
      despesas,
      reportProcs,
      reportPatients,
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao montar visao financeira", err);
    res.status(500).json({ error: "Erro ao carregar financeiro." });
  }
}

export async function createTransaction(req: Request, res: Response): Promise<void> {
  try {
    const { type, description, category, amount, method, status, patient_id, procedure_id, occurred_on } = req.body;

    if (!type || !description || amount == null) {
      res.status(400).json({ error: "type, description e amount sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Criando transacao via CRM", { staffId: req.staff?.id, type, amount });
    const transaction = await transactionRepository.create({
      type,
      description,
      category,
      amount: Number(amount),
      method,
      status,
      patientId: patient_id,
      procedureId: procedure_id,
      occurredOn: occurred_on,
      createdBy: req.staff?.id,
    });
    res.status(201).json(transaction);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar transacao", err);
    res.status(500).json({ error: "Erro ao criar transacao." });
  }
}

export async function updateTransaction(req: Request, res: Response): Promise<void> {
  try {
    const { description, category, amount, method, status, occurred_on } = req.body;
    logger.info(SCOPE, "Atualizando transacao via CRM", { staffId: req.staff?.id, id: req.params.id });
    const transaction = await transactionRepository.update(req.params.id, {
      description,
      category,
      amount: amount != null ? Number(amount) : undefined,
      method,
      status,
      occurredOn: occurred_on,
    });
    res.json(transaction);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar transacao", err);
    res.status(500).json({ error: "Erro ao atualizar transacao." });
  }
}

export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo transacao via CRM", { staffId: req.staff?.id, id: req.params.id });
    await transactionRepository.remove(req.params.id);
    res.status(204).send();
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir transacao", err);
    res.status(500).json({ error: "Erro ao excluir transacao." });
  }
}
