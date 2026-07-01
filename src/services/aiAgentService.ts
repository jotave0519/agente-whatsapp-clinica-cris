import fs from "fs";
import path from "path";
import { createMessage } from "../integrations/anthropicClient";
import { env } from "../config/env";
import * as schedulingService from "./schedulingService";
import * as conversationRepository from "../repositories/conversationRepository";
import { Conversation, User } from "../types";

const WORKFLOWS_DIR = path.join(__dirname, "..", "..", "workflows");

function loadSystemPrompt(isFirstMessage: boolean): string {
  const files = ["atendimento_faq.md", "agendamento_consultas.md"];
  const parts = files.map((file) => fs.readFileSync(path.join(WORKFLOWS_DIR, file), "utf-8"));

  const today = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const header =
    `Voce e o assistente de WhatsApp da clinica da Dra. Cristiane Zangelmi. ` +
    `Data e hora atual: ${today} (America/Sao_Paulo).\n` +
    `Siga rigorosamente os workflows abaixo. Responda sempre em portugues do Brasil, ` +
    `em mensagens curtas e naturais de WhatsApp (evite paredes de texto). ` +
    `Use as ferramentas disponiveis para checar disponibilidade e criar/remarcar/cancelar ` +
    `agendamentos - nunca invente horarios ou confirme agendamentos sem chamar a ferramenta. ` +
    `Se o cliente pedir para falar com um atendente humano, ou voce nao conseguir ajudar, ` +
    `chame a ferramenta request_human_handoff.\n` +
    (isFirstMessage
      ? `Esta e a primeira mensagem deste cliente na conversa: cumprimente-o pelo nome (se souber) ` +
        `e apresente as opcoes principais (1. Agendar avaliacao, 2. Remarcar agendamento, ` +
        `3. Cancelar agendamento, 4. Conhecer nossos tratamentos, 5. Falar com um atendente), ` +
        `mas tambem entenda linguagem natural livremente.\n`
      : "");

  return header + "\n\n---\n\n" + parts.join("\n\n---\n\n");
}

const TOOLS: any[] = [
  {
    name: "check_availability",
    description:
      "Lista horarios livres em um dia especifico, dentro do horario de funcionamento (Seg-Sex, 08h-18h).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Data no formato YYYY-MM-DD" },
        duration_minutes: { type: "integer", description: "Duracao em minutos", default: 30 },
      },
      required: ["date"],
    },
  },
  {
    name: "create_appointment",
    description: "Cria um novo agendamento de consulta/procedimento.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome completo do paciente" },
        service: { type: "string", description: "Procedimento de interesse" },
        start: { type: "string", description: "Data/hora ISO, ex: 2026-07-02T10:00:00" },
        duration_minutes: { type: "integer", default: 30 },
      },
      required: ["name", "service", "start"],
    },
  },
  {
    name: "list_appointments",
    description: "Lista os agendamentos ativos do cliente atual.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "reschedule_appointment",
    description: "Remarca um agendamento existente do cliente atual para um novo horario.",
    input_schema: {
      type: "object",
      properties: {
        schedule_id: { type: "string", description: "ID do agendamento (obtido via list_appointments)" },
        start: { type: "string", description: "Novo horario em formato ISO" },
        duration_minutes: { type: "integer", default: 30 },
      },
      required: ["schedule_id", "start"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancela um agendamento existente do cliente atual.",
    input_schema: {
      type: "object",
      properties: { schedule_id: { type: "string" } },
      required: ["schedule_id"],
    },
  },
  {
    name: "confirm_appointment",
    description: "Marca um agendamento como confirmado pelo paciente (ex: apos lembrete de consulta).",
    input_schema: {
      type: "object",
      properties: { schedule_id: { type: "string" } },
      required: ["schedule_id"],
    },
  },
  {
    name: "request_human_handoff",
    description:
      "Encerra o atendimento automatico e sinaliza que um atendente humano deve continuar a conversa.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "Motivo do encaminhamento" } },
      required: ["reason"],
    },
  },
];

async function executeTool(name: string, input: any, user: User): Promise<string> {
  try {
    switch (name) {
      case "check_availability": {
        const slots = await schedulingService.checkAvailability(input.date, input.duration_minutes);
        return JSON.stringify(slots);
      }
      case "create_appointment": {
        const schedule = await schedulingService.createAppointment({
          userId: user.id,
          name: input.name,
          phone: user.phone,
          service: input.service,
          start: input.start,
          durationMinutes: input.duration_minutes,
        });
        return JSON.stringify(schedule);
      }
      case "list_appointments": {
        const schedules = await schedulingService.findAppointmentsForUser(user.id);
        return JSON.stringify(schedules);
      }
      case "reschedule_appointment": {
        const schedule = await schedulingService.rescheduleAppointment(
          input.schedule_id,
          input.start,
          input.duration_minutes
        );
        return JSON.stringify(schedule);
      }
      case "cancel_appointment": {
        const schedule = await schedulingService.cancelAppointment(input.schedule_id);
        return JSON.stringify(schedule);
      }
      case "confirm_appointment": {
        await schedulingService.confirmAppointment(input.schedule_id);
        return JSON.stringify({ status: "confirmed" });
      }
      case "request_human_handoff": {
        return JSON.stringify({ status: "handoff_requested", reason: input.reason });
      }
      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Erro ao executar ${name}: ${err.message}` });
  }
}

export interface AgentResult {
  reply: string;
  handoffRequested: boolean;
}

export async function handleMessage(
  user: User,
  conversation: Conversation,
  userMessage: string
): Promise<AgentResult> {
  const priorMessages = await conversationRepository.listMessages(conversation.id);
  const isFirstMessage = priorMessages.length === 0;

  await conversationRepository.addMessage(conversation.id, "user", userMessage);

  const history: any[] = priorMessages.map((m) => ({ role: m.role, content: m.content }));
  history.push({ role: "user", content: userMessage });

  const systemPrompt = loadSystemPrompt(isFirstMessage);
  let handoffRequested = false;

  while (true) {
    const response = await createMessage({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: history,
    });

    if (response.stop_reason === "tool_use") {
      history.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          if (block.name === "request_human_handoff") {
            handoffRequested = true;
          }
          const output = await executeTool(block.name!, block.input, user);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output });
        }
      }
      history.push({ role: "user", content: toolResults });
      continue;
    }

    const finalText = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("");

    await conversationRepository.addMessage(conversation.id, "assistant", finalText);

    if (handoffRequested) {
      await conversationRepository.updateConversationStatus(conversation.id, "human");
    }

    return { reply: finalText, handoffRequested };
  }
}
