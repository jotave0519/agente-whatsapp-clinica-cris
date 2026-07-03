import express from "express";
import path from "path";
import { env } from "./config/env";
import { handleWhatsAppWebhook } from "./controllers/webhookController";
import { handleHealthCheck } from "./controllers/healthController";
import { apiRouter } from "./routes/api";
import { scheduleReminderCron } from "./cron/reminderCron";
import { scheduleInactivityCron } from "./cron/inactivityCron";

const WEB_DIST_DIR = path.join(__dirname, "..", "web-dist");

const app = express();
app.use(express.json());

app.post("/webhook", handleWhatsAppWebhook);
app.get("/health", handleHealthCheck);
app.use("/api/v1", apiRouter);

// CRM web (build do Vite) servido como estatico pelo mesmo servico.
app.use(express.static(WEB_DIST_DIR));
app.get("*", (_req, res) => {
  res.sendFile(path.join(WEB_DIST_DIR, "index.html"));
});

app.listen(env.port, () => {
  console.log(`Agente rodando na porta ${env.port}`);
  scheduleReminderCron();
  scheduleInactivityCron();
});
