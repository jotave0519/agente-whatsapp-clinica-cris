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

export async function editMovement(
  movementId: string,
  params: { type: InventoryMovementType; quantity: number; note?: string | null }
): Promise<{ item: InventoryItem }> {
  if (params.quantity <= 0) {
    throw new Error("Quantidade da movimentacao precisa ser maior que zero.");
  }

  const movement = await inventoryRepository.findMovementById(movementId);
  if (!movement) throw new Error(`Movimentacao nao encontrada: ${movementId}`);

  const item = await inventoryRepository.findItemById(movement.item_id);
  if (!item) throw new Error(`Item de estoque nao encontrado: ${movement.item_id}`);

  // Reverte o efeito da movimentacao original e aplica o efeito da versao editada,
  // recalculando o saldo do item a partir do valor atual (nao do zero).
  const oldDelta = movement.type === "entrada" ? Number(movement.quantity) : -Number(movement.quantity);
  const newDelta = params.type === "entrada" ? params.quantity : -params.quantity;
  const newItemQuantity = Number(item.quantity) - oldDelta + newDelta;

  if (newItemQuantity < 0) {
    throw new Error(`Essa alteracao deixaria o estoque de "${item.name}" negativo (resultado: ${newItemQuantity}).`);
  }

  await inventoryRepository.updateMovement(movementId, params);
  const updatedItem = await inventoryRepository.updateItemQuantity(item.id, newItemQuantity);

  return { item: updatedItem };
}
