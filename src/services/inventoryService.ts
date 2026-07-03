import * as inventoryRepository from "../repositories/inventoryRepository";
import { InventoryItem, InventoryMovementType } from "../types";

export async function registerMovement(params: {
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  note?: string | null;
  createdBy?: string | null;
}): Promise<{ item: InventoryItem }> {
  if (params.quantity <= 0) {
    throw new Error("Quantidade da movimentacao precisa ser maior que zero.");
  }

  const item = await inventoryRepository.findItemById(params.itemId);
  if (!item) throw new Error(`Item de estoque nao encontrado: ${params.itemId}`);

  const delta = params.type === "entrada" ? params.quantity : -params.quantity;
  const newQuantity = Number(item.quantity) + delta;
  if (newQuantity < 0) {
    throw new Error(`Estoque insuficiente para "${item.name}" (disponivel: ${item.quantity}).`);
  }

  await inventoryRepository.createMovement(params);
  const updatedItem = await inventoryRepository.updateItemQuantity(params.itemId, newQuantity);

  return { item: updatedItem };
}
