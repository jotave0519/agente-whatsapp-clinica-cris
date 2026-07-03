import { getSupabaseClient } from "../integrations/supabaseClient";
import { Transaction, TransactionStatus, TransactionType } from "../types";

export async function listByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
  const { data, error } = await getSupabaseClient()
    .from("transactions")
    .select("*")
    .gte("occurred_on", startDate)
    .lte("occurred_on", endDate)
    .order("occurred_on", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listRecentByType(type: TransactionType, limit = 10): Promise<Transaction[]> {
  const { data, error } = await getSupabaseClient()
    .from("transactions")
    .select("*")
    .eq("type", type)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function create(params: {
  type: TransactionType;
  description: string;
  category?: string | null;
  amount: number;
  method?: string | null;
  status?: TransactionStatus;
  patientId?: string | null;
  procedureId?: string | null;
  occurredOn?: string;
  createdBy?: string | null;
}): Promise<Transaction> {
  const { data, error } = await getSupabaseClient()
    .from("transactions")
    .insert({
      type: params.type,
      description: params.description,
      category: params.category ?? null,
      amount: params.amount,
      method: params.method ?? null,
      status: params.status ?? "pago",
      patient_id: params.patientId ?? null,
      procedure_id: params.procedureId ?? null,
      occurred_on: params.occurredOn ?? new Date().toISOString().slice(0, 10),
      created_by: params.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
