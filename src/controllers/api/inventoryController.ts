import { Request, Response } from "express";
import * as inventoryRepository from "../../repositories/inventoryRepository";
import * as inventoryService from "../../services/inventoryService";
import { InventoryItem } from "../../types";
import { AppError } from "../../utils/appError";
import { logger } from "../../utils/logger";

const SCOPE = "api.inventory";

function itemStatus(item: InventoryItem): "ok" | "baixo" | "vencimento" {
  if (item.expiry_date) {
    const days = (new Date(item.expiry_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (days <= 30) return "vencimento";
  }
  if (Number(item.quantity) < Number(item.min_quantity)) return "baixo";
  return "ok";
}

export async function listInventory(_req: Request, res: Response): Promise<void> {
  try {
    const [items, movements] = await Promise.all([inventoryRepository.listItems(), inventoryRepository.listRecentMovements(10)]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const movementsThisMonth = await inventoryRepository.countMovementsSince(monthStart.toISOString());

    const itemsWithStatus = items.map((item) => ({ ...item, status: itemStatus(item) }));
    const lowStock = itemsWithStatus.filter((i) => i.status === "baixo").length;
    const expiringSoon = itemsWithStatus.filter((i) => i.status === "vencimento").length;

    res.json({
      items: itemsWithStatus,
      movements,
      kpis: {
        totalItems: items.length,
        lowStock,
        expiringSoon,
        movementsThisMonth,
      },
    });
  } catch (err) {
    logger.error(SCOPE, "Erro ao listar estoque", err);
    res.status(500).json({ error: "Erro ao carregar estoque." });
  }
}

export async function createItem(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, unit, quantity, min_quantity, expiry_date, active } = req.body;
    if (!name) {
      res.status(400).json({ error: "name e obrigatorio." });
      return;
    }

    logger.info(SCOPE, "Criando item de estoque via CRM", { staffId: req.staff?.id, name });
    const item = await inventoryRepository.createItem({
      name,
      category,
      unit,
      quantity,
      minQuantity: min_quantity,
      expiryDate: expiry_date,
      active,
    });
    res.status(201).json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao criar item de estoque", err);
    res.status(500).json({ error: "Erro ao criar item de estoque." });
  }
}

export async function updateItem(req: Request, res: Response): Promise<void> {
  try {
    const { name, category, unit, min_quantity, expiry_date, active } = req.body;
    logger.info(SCOPE, "Atualizando item de estoque via CRM", { staffId: req.staff?.id, id: req.params.id });
    const item = await inventoryRepository.updateItem(req.params.id, {
      name,
      category,
      unit,
      minQuantity: min_quantity,
      expiryDate: expiry_date,
      active,
    });
    res.json(item);
  } catch (err) {
    logger.error(SCOPE, "Erro ao atualizar item de estoque", err);
    res.status(500).json({ error: "Erro ao atualizar item de estoque." });
  }
}

export async function deleteItem(req: Request, res: Response): Promise<void> {
  try {
    logger.info(SCOPE, "Excluindo item de estoque via CRM", { staffId: req.staff?.id, id: req.params.id });
    await inventoryRepository.removeItem(req.params.id);
    res.json({ status: "deleted" });
  } catch (err) {
    logger.error(SCOPE, "Erro ao excluir item de estoque", err);
    res.status(500).json({ error: "Erro ao excluir item de estoque." });
  }
}

export async function createMovement(req: Request, res: Response): Promise<void> {
  try {
    const { item_id, type, quantity, note } = req.body;
    if (!item_id || !type || !quantity) {
      res.status(400).json({ error: "item_id, type e quantity sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Registrando movimentacao de estoque via CRM", { staffId: req.staff?.id, item_id, type, quantity });
    const result = await inventoryService.registerMovement({
      itemId: item_id,
      type,
      quantity: Number(quantity),
      note,
      createdBy: req.staff?.id,
    });
    res.status(201).json(result);
  } catch (err) {
    logger.error(SCOPE, "Erro ao registrar movimentacao de estoque", err);
    if (err instanceof AppError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Erro ao registrar movimentacao." });
  }
}

export async function updateMovement(req: Request, res: Response): Promise<void> {
  try {
    const { type, quantity, note } = req.body;
    if (!type || !quantity) {
      res.status(400).json({ error: "type e quantity sao obrigatorios." });
      return;
    }

    logger.info(SCOPE, "Editando movimentacao de estoque via CRM", { staffId: req.staff?.id, id: req.params.id, type, quantity });
    const result = await inventoryService.editMovement(req.params.id, { type, quantity: Number(quantity), note });
    res.json(result);
  } catch (err) {
    logger.error(SCOPE, "Erro ao editar movimentacao de estoque", err);
    if (err instanceof AppError) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Erro ao editar movimentacao." });
  }
}
