import { getSupabaseClient } from "../integrations/supabaseClient";
import { InventoryItem, InventoryMovement, InventoryMovementType } from "../types";

export async function listItems(): Promise<InventoryItem[]> {
  const { data, error } = await getSupabaseClient().from("inventory_items").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function findItemById(id: string): Promise<InventoryItem | null> {
  const { data, error } = await getSupabaseClient().from("inventory_items").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createItem(params: {
  name: string;
  category?: string | null;
  unit?: string;
  quantity?: number;
  minQuantity?: number;
  expiryDate?: string | null;
  active?: boolean;
}): Promise<InventoryItem> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_items")
    .insert({
      name: params.name,
      category: params.category ?? null,
      unit: params.unit ?? "un",
      quantity: params.quantity ?? 0,
      min_quantity: params.minQuantity ?? 0,
      expiry_date: params.expiryDate ?? null,
      active: params.active ?? true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateItem(
  id: string,
  params: Partial<{
    name: string;
    category: string | null;
    unit: string;
    minQuantity: number;
    expiryDate: string | null;
    active: boolean;
  }>
): Promise<InventoryItem> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.name !== undefined) payload.name = params.name;
  if (params.category !== undefined) payload.category = params.category;
  if (params.unit !== undefined) payload.unit = params.unit;
  if (params.minQuantity !== undefined) payload.min_quantity = params.minQuantity;
  if (params.expiryDate !== undefined) payload.expiry_date = params.expiryDate;
  if (params.active !== undefined) payload.active = params.active;

  const { data, error } = await getSupabaseClient().from("inventory_items").update(payload).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateItemQuantity(id: string, quantity: number): Promise<InventoryItem> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_items")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listRecentMovements(limit = 10): Promise<(InventoryMovement & { item_name: string })[]> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_movements")
    .select("*, inventory_items(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row, item_name: row.inventory_items?.name || "" }));
}

export async function createMovement(params: {
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  note?: string | null;
  createdBy?: string | null;
}): Promise<InventoryMovement> {
  const { data, error } = await getSupabaseClient()
    .from("inventory_movements")
    .insert({
      item_id: params.itemId,
      type: params.type,
      quantity: params.quantity,
      note: params.note ?? null,
      created_by: params.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function countMovementsSince(sinceIso: string): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from("inventory_movements")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);

  if (error) throw error;
  return count ?? 0;
}
