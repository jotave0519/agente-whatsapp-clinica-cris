import { Router } from "express";
import { getConversation, listConversations, sendMessage, updateStatus } from "../controllers/api/conversationController";
import { getDashboard } from "../controllers/api/dashboardController";
import { createTransaction, deleteTransaction, getFinanceOverview, updateTransaction } from "../controllers/api/financeController";
import {
  createItem,
  createMovement,
  deleteItem,
  listInventory,
  updateItem as updateInventoryItem,
  updateMovement,
} from "../controllers/api/inventoryController";
import { createPatient, deletePatient, getPatient, listPatients, updatePatient } from "../controllers/api/patientController";
import { createProcedure, deleteProcedure, listProcedures, updateProcedure } from "../controllers/api/procedureController";
import { cancelSchedule, createSchedule, listSchedules, rescheduleSchedule } from "../controllers/api/scheduleController";
import { getSettings, updateSettings } from "../controllers/api/settingsController";
import { createStaff, deleteStaff, listStaff, updateStaff } from "../controllers/api/staffController";
import { disconnect, getQrCode, getStatus } from "../controllers/api/whatsappController";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get("/dashboard", getDashboard);

apiRouter.get("/patients", listPatients);
apiRouter.get("/patients/:id", getPatient);
apiRouter.post("/patients", createPatient);
apiRouter.patch("/patients/:id", updatePatient);
apiRouter.delete("/patients/:id", deletePatient);

apiRouter.get("/schedules", listSchedules);
apiRouter.post("/schedules", createSchedule);
apiRouter.patch("/schedules/:id", rescheduleSchedule);
apiRouter.delete("/schedules/:id", cancelSchedule);

apiRouter.get("/conversations", listConversations);
apiRouter.get("/conversations/:id", getConversation);
apiRouter.post("/conversations/:id/messages", sendMessage);
apiRouter.patch("/conversations/:id/status", updateStatus);

apiRouter.get("/procedures", listProcedures);
apiRouter.post("/procedures", createProcedure);
apiRouter.patch("/procedures/:id", updateProcedure);
apiRouter.delete("/procedures/:id", deleteProcedure);

apiRouter.get("/finance", getFinanceOverview);
apiRouter.post("/finance/transactions", createTransaction);
apiRouter.patch("/finance/transactions/:id", updateTransaction);
apiRouter.delete("/finance/transactions/:id", deleteTransaction);

apiRouter.get("/inventory", listInventory);
apiRouter.post("/inventory/items", createItem);
apiRouter.patch("/inventory/items/:id", updateInventoryItem);
apiRouter.delete("/inventory/items/:id", deleteItem);
apiRouter.post("/inventory/movements", createMovement);
apiRouter.patch("/inventory/movements/:id", updateMovement);

apiRouter.get("/staff", requireAdmin, listStaff);
apiRouter.post("/staff", requireAdmin, createStaff);
apiRouter.patch("/staff/:id", requireAdmin, updateStaff);
apiRouter.delete("/staff/:id", requireAdmin, deleteStaff);

apiRouter.get("/settings", getSettings);
apiRouter.patch("/settings", updateSettings);

apiRouter.get("/whatsapp/status", getStatus);
apiRouter.get("/whatsapp/qrcode", getQrCode);
apiRouter.post("/whatsapp/disconnect", requireAdmin, disconnect);
