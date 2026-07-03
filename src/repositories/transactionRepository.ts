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

export async function update(
  id: string,
  params: Partial<{
    description: string;
    category: string | null;
    amount: number;
    method: string | null;
    status: TransactionStatus;
    occurredOn: string;
  }>
): Promise<Transaction> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.description !== undefined) payload.description = params.description;
  if (params.category !== undefined) payload.category = params.category;
  if (params.amount !== undefined) payload.amount = params.amount;
  if (params.method !== undefined) payload.method = params.method;
  if (params.status !== undefined) payload.status = params.status;
  if (params.occurredOn !== undefined) payload.occurred_on = params.occurredOn;

  const { data, error } = await getSupabaseClient().from("transactions").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function remove(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from("transactions").delete().eq("id", id);
  if (error) throw error;
}
