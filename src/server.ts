import express from "express";
import { env } from "./config/env";
import { handleWhatsAppWebhook } from "./controllers/webhookController";
import { handleHealthCheck } from "./controllers/healthController";
import { scheduleReminderCron } from "./cron/reminderCron";
import { scheduleInactivityCron } from "./cron/inactivityCron";

const app = express();
app.use(express.json());

app.post("/webhook", handleWhatsAppWebhook);
app.get("/health", handleHealthCheck);

app.listen(env.port, () => {
  console.log(`Agente rodando na porta ${env.port}`);
  scheduleReminderCron();
  scheduleInactivityCron();
});
