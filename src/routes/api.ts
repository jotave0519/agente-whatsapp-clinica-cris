import { Router } from "express";
import { createException, deleteException, listExceptions } from "../controllers/api/businessHourExceptionController";
import { createSlot, deleteSlot } from "../controllers/api/businessHourSlotController";
import {
  getOpportunity,
  listEvents as listCommercialEvents,
  listOpportunities,
  moveStage,
  pauseResume,
} from "../controllers/api/commercialController";
import { getConversation, listConversations, sendMessage, updatePriority, updateStatus } from "../controllers/api/conversationController";
import { getDashboard } from "../controllers/api/dashboardController";
import { createFaq, deleteFaq, listFaq, updateFaq } from "../controllers/api/faqController";
import { createTransaction, deleteTransaction, getFinanceOverview, updateTransaction } from "../controllers/api/financeController";
import {
  createItem,
  createMovement,
  deleteItem,
  listInventory,
  updateItem as updateInventoryItem,
  updateMovement,
} from "../controllers/api/inventoryController";
import { getMe } from "../controllers/api/meController";
import { listMessageTemplates, updateMessageTemplate } from "../controllers/api/messageTemplateController";
import {
  createPatient,
  createPatientDocument,
  createPatientGoal,
  createPatientMedia,
  createPatientNote,
  createPatientTimelineEvent,
  deletePatient,
  deletePatientDocument,
  deletePatientGoal,
  deletePatientMedia,
  deletePatientNote,
  getPatient,
  getPatientHistory,
  getPatientSuggestions,
  getPatientSummary,
  getPatientTimeline,
  listPatientDocuments,
  listPatientGoals,
  listPatientMedia,
  listPatientNotes,
  listPatients,
  listPatientTransactions,
  updatePatient,
  updatePatientGoal,
} from "../controllers/api/patientController";
import { createProcedure, deleteProcedure, listProcedures, updateProcedure } from "../controllers/api/procedureController";
import {
  createFlow as createPostAttendanceFlow,
  deleteFlow as deletePostAttendanceFlow,
  listEnrollments as listPostAttendanceEnrollments,
  listFlows as listPostAttendanceFlows,
  updateFlow as updatePostAttendanceFlow,
} from "../controllers/api/postAttendanceController";
import {
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignStats,
  listCampaigns,
  updateCampaign,
} from "../controllers/api/reactivationController";
import { cancelSchedule, createSchedule, listSchedules, updateOutcome, updateScheduleStaff } from "../controllers/api/scheduleController";
import { getSettings, updateSettings } from "../controllers/api/settingsController";
import { createStaff, deleteStaff, listStaff, updateStaff } from "../controllers/api/staffController";
import { disconnect, getQrCode, getStatus } from "../controllers/api/whatsappController";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const apiRouter = Router();

apiRouter.use(requireAuth);

// Perfis: admin (acesso total), recepcionista (atendimento do dia a dia -
// agenda/pacientes/conversas/whatsapp), profissional (so consulta agenda/
// pacientes). Nenhuma rota administrativa fica liberada so por estar
// autenticado - ver auditoria de seguranca.
const staffOrAbove = requireRole("admin", "recepcionista");

apiRouter.get("/me", getMe);

apiRouter.get("/dashboard", requireAdmin, getDashboard);

apiRouter.get("/patients", listPatients);
apiRouter.get("/patients/:id", getPatient);
apiRouter.get("/patients/:id/history", getPatientHistory);
apiRouter.post("/patients", staffOrAbove, createPatient);
apiRouter.patch("/patients/:id", staffOrAbove, updatePatient);
apiRouter.delete("/patients/:id", staffOrAbove, deletePatient);

apiRouter.get("/patients/:id/summary", getPatientSummary);
apiRouter.get("/patients/:id/transactions", listPatientTransactions);
apiRouter.get("/patients/:id/suggestions", getPatientSuggestions);
apiRouter.get("/patients/:id/timeline", getPatientTimeline);

apiRouter.get("/patients/:id/notes", listPatientNotes);
apiRouter.post("/patients/:id/notes", staffOrAbove, createPatientNote);
apiRouter.delete("/patients/:id/notes/:noteId", staffOrAbove, deletePatientNote);

apiRouter.get("/patients/:id/goals", listPatientGoals);
apiRouter.post("/patients/:id/goals", staffOrAbove, createPatientGoal);
apiRouter.patch("/patients/:id/goals/:goalId", staffOrAbove, updatePatientGoal);
apiRouter.delete("/patients/:id/goals/:goalId", staffOrAbove, deletePatientGoal);

apiRouter.get("/patients/:id/media", listPatientMedia);
apiRouter.post("/patients/:id/media", staffOrAbove, createPatientMedia);
apiRouter.delete("/patients/:id/media/:mediaId", staffOrAbove, deletePatientMedia);

apiRouter.get("/patients/:id/documents", listPatientDocuments);
apiRouter.post("/patients/:id/documents", staffOrAbove, createPatientDocument);
apiRouter.delete("/patients/:id/documents/:docId", staffOrAbove, deletePatientDocument);

apiRouter.post("/patients/:id/timeline-events", staffOrAbove, createPatientTimelineEvent);

apiRouter.get("/schedules", listSchedules);
apiRouter.post("/schedules", staffOrAbove, createSchedule);
apiRouter.delete("/schedules/:id", staffOrAbove, cancelSchedule);
apiRouter.patch("/schedules/:id/outcome", staffOrAbove, updateOutcome);
apiRouter.patch("/schedules/:id/staff", staffOrAbove, updateScheduleStaff);

apiRouter.get("/conversations", staffOrAbove, listConversations);
apiRouter.get("/conversations/:id", staffOrAbove, getConversation);
apiRouter.post("/conversations/:id/messages", staffOrAbove, sendMessage);
apiRouter.patch("/conversations/:id/status", staffOrAbove, updateStatus);
apiRouter.patch("/conversations/:id/priority", staffOrAbove, updatePriority);

apiRouter.get("/procedures", listProcedures);
apiRouter.post("/procedures", requireAdmin, createProcedure);
apiRouter.patch("/procedures/:id", requireAdmin, updateProcedure);
apiRouter.delete("/procedures/:id", requireAdmin, deleteProcedure);

apiRouter.get("/finance", requireAdmin, getFinanceOverview);
apiRouter.post("/finance/transactions", requireAdmin, createTransaction);
apiRouter.patch("/finance/transactions/:id", requireAdmin, updateTransaction);
apiRouter.delete("/finance/transactions/:id", requireAdmin, deleteTransaction);

apiRouter.get("/inventory", requireAdmin, listInventory);
apiRouter.post("/inventory/items", requireAdmin, createItem);
apiRouter.patch("/inventory/items/:id", requireAdmin, updateInventoryItem);
apiRouter.delete("/inventory/items/:id", requireAdmin, deleteItem);
apiRouter.post("/inventory/movements", requireAdmin, createMovement);
apiRouter.patch("/inventory/movements/:id", requireAdmin, updateMovement);

// Listagem (so nome/role) liberada pra staffOrAbove - a recepcao precisa
// escolher o "profissional responsavel" ao marcar um procedimento como
// realizado. Gestao de contas (criar/editar/excluir) continua admin-only.
apiRouter.get("/staff", staffOrAbove, listStaff);
apiRouter.post("/staff", requireAdmin, createStaff);
apiRouter.patch("/staff/:id", requireAdmin, updateStaff);
apiRouter.delete("/staff/:id", requireAdmin, deleteStaff);

apiRouter.get("/settings", requireAdmin, getSettings);
apiRouter.patch("/settings", requireAdmin, updateSettings);

apiRouter.get("/faq", requireAdmin, listFaq);
apiRouter.post("/faq", requireAdmin, createFaq);
apiRouter.patch("/faq/:id", requireAdmin, updateFaq);
apiRouter.delete("/faq/:id", requireAdmin, deleteFaq);

apiRouter.get("/message-templates", requireAdmin, listMessageTemplates);
apiRouter.patch("/message-templates/:key", requireAdmin, updateMessageTemplate);

apiRouter.get("/business-hours/exceptions", requireAdmin, listExceptions);
apiRouter.post("/business-hours/exceptions", requireAdmin, createException);
apiRouter.delete("/business-hours/exceptions/:id", requireAdmin, deleteException);
apiRouter.post("/business-hours/slots", requireAdmin, createSlot);
apiRouter.delete("/business-hours/slots/:id", requireAdmin, deleteSlot);

apiRouter.get("/whatsapp/status", staffOrAbove, getStatus);
apiRouter.get("/whatsapp/qrcode", staffOrAbove, getQrCode);
apiRouter.post("/whatsapp/disconnect", requireAdmin, disconnect);

apiRouter.get("/reactivation-campaigns", requireAdmin, listCampaigns);
apiRouter.post("/reactivation-campaigns", requireAdmin, createCampaign);
apiRouter.patch("/reactivation-campaigns/:id", requireAdmin, updateCampaign);
apiRouter.delete("/reactivation-campaigns/:id", requireAdmin, deleteCampaign);
apiRouter.post("/reactivation-campaigns/:id/duplicate", requireAdmin, duplicateCampaign);
apiRouter.get("/reactivation-campaigns/:id/stats", requireAdmin, getCampaignStats);

apiRouter.get("/post-attendance-flows", requireAdmin, listPostAttendanceFlows);
apiRouter.post("/post-attendance-flows", requireAdmin, createPostAttendanceFlow);
apiRouter.patch("/post-attendance-flows/:id", requireAdmin, updatePostAttendanceFlow);
apiRouter.delete("/post-attendance-flows/:id", requireAdmin, deletePostAttendanceFlow);
apiRouter.get("/post-attendance-enrollments", requireAdmin, listPostAttendanceEnrollments);

apiRouter.get("/commercial-opportunities", requireAdmin, listOpportunities);
apiRouter.get("/commercial-opportunities/:id", requireAdmin, getOpportunity);
apiRouter.patch("/commercial-opportunities/:id/stage", requireAdmin, moveStage);
apiRouter.patch("/commercial-opportunities/:id/pause", requireAdmin, pauseResume);
apiRouter.get("/commercial-events", requireAdmin, listCommercialEvents);
