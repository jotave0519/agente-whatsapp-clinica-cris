import { Router } from "express";
import { getConversation, listConversations, sendMessage, updateStatus } from "../controllers/api/conversationController";
import { getDashboard } from "../controllers/api/dashboardController";
import { getPatient, listPatients } from "../controllers/api/patientController";
import { createProcedure, listProcedures, updateProcedure } from "../controllers/api/procedureController";
import { cancelSchedule, createSchedule, listSchedules, rescheduleSchedule } from "../controllers/api/scheduleController";
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
