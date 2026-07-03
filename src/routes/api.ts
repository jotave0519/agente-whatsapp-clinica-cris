import { Router } from "express";
import { getDashboard } from "../controllers/api/dashboardController";
import { getPatient, listPatients } from "../controllers/api/patientController";
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
