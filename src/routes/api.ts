import { Router } from "express";
import { getConversation, listConversations, sendMessage, updateStatus } from "../controllers/api/conversationController";
import { getDashboard } from "../controllers/api/dashboardController";
import { createTransaction, getFinanceOverview } from "../controllers/api/financeController";
import { createItem, createMovement, listInventory, updateItem as updateInventoryItem } from "../controllers/api/inventoryController";
import { getPatient, listPatients } from "../controllers/api/patientController";
import { createProcedure, listProcedures, updateProcedure } from "../controllers/api/procedureController";
import { cancelSchedule, createSchedule, listSchedules, rescheduleSchedule } from "../controllers/api/scheduleController";
import { getSettings, updateSettings } from "../controllers/api/settingsController";
import { listStaff, updateStaff } from "../controllers/api/staffController";
import { disconnect, getQrCode, getStatus } from "../controllers/api/whatsappController";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";

export const apiRouter = Router();

apiRouter.use(requireAuth);

apiRouter.get("/dashboard", getDashboard);

apiRouter.get("/patients", listPatients);
apiRouter.get("/patients/:id", getPatient);

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

apiRouter.get("/finance", getFinanceOverview);
apiRouter.post("/finance/transactions", createTransaction);

apiRouter.get("/inventory", listInventory);
apiRouter.post("/inventory/items", createItem);
apiRouter.patch("/inventory/items/:id", updateInventoryItem);
apiRouter.post("/inventory/movements", createMovement);

apiRouter.get("/staff", requireAdmin, listStaff);
apiRouter.patch("/staff/:id", requireAdmin, updateStaff);

apiRouter.get("/settings", getSettings);
apiRouter.patch("/settings", updateSettings);

apiRouter.get("/whatsapp/status", getStatus);
apiRouter.get("/whatsapp/qrcode", getQrCode);
apiRouter.post("/whatsapp/disconnect", requireAdmin, disconnect);
