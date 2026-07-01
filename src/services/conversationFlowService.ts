import * as schedulingService from "./schedulingService";
import * as conversationRepository from "../repositories/conversationRepository";
import { Conversation, ConversationFlowState, FlowStateData, User } from "../types";

const CLINIC_ADDRESS =
  "Estrada Santa Isabel, 965, Sala 23, Edifício Comercial Arujazinho, Arujá - SP";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[!.,;:]+$/g, "")
    .trim();
}

const AFFIRMATIVE_WORDS = [
  "sim",
  "pode",
  "podes",
  "confirmo",
  "confirmado",
  "confirma",
  "confirmar",
  "confirmando",
  "ok",
  "okay",
  "beleza",
  "certo",
  "isso",
  "claro",
  "positivo",
  "exato",
  "correto",
  "aceito",
  "fechado",
  "show",
  "perfeito",
  "isso mesmo",
  "com certeza",
];

const NEGATION_PATTERN = /\b(nao|não|espera|calma|errado|troca|mudar|corrig|na verdade|melhor nao|deixa)\b/;

const ABANDON_PATTERN =
  /^(cancela isso|esquece|esquece isso|deixa pra la|deixa para la|mudei de ideia|quero voltar ao menu|voltar ao menu|para|pausa isso|nao quero mais)$/;

/**
 * Deteccao deliberadamente tolerante: mensagens curtas (ate 6 palavras) sem
 * negacao, que contenham uma palavra afirmativa, contam como confirmacao.
 * Isso reduz a dependencia de o LLM sempre chamar a ferramenta de confirmacao
 * corretamente - a maioria das confirmacoes reais do WhatsApp e curta.
 */
export function isConfirmationText(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  if (NEGATION_PATTERN.test(norm)) return false;

  const wordCount = norm.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 6) return false;

  return AFFIRMATIVE_WORDS.some((phrase) => norm === phrase || norm.includes(phrase));
}

export function isAbandonText(text: string): boolean {
  return ABANDON_PATTERN.test(normalize(text));
}

function formatDateTime(startIso: string): { date: string; time: string } {
  const dt = new Date(startIso);
  return {
    date: dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    time: dt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
  };
}

function describeCandidates(candidates: { procedure: string; date: string; time: string }[]): string {
  return candidates.map((c, i) => `${i + 1}) ${c.procedure} em ${c.date} as ${c.time}`).join("  ");
}

export interface FlowResult {
  state: ConversationFlowState;
  stateData: FlowStateData;
  message: string;
}

async function persist(conversation: Conversation, result: FlowResult): Promise<FlowResult> {
  await conversationRepository.updateConversationFlow(conversation.id, result.state, result.stateData);
  return result;
}

export async function abandonFlow(conversation: Conversation): Promise<FlowResult> {
  return persist(conversation, {
    state: "MENU",
    stateData: {},
    message: "Sem problemas, deixei esse atendimento de lado. Posso ajudar com mais alguma coisa?",
  });
}

// ---------- Agendamento ----------

export async function beginScheduling(
  conversation: Conversation,
  input: { procedure?: string; name?: string; date?: string }
): Promise<FlowResult> {
  const stateData: FlowStateData = {};
  if (input.procedure) stateData.procedure = input.procedure;
  if (input.name) stateData.name = input.name;

  if (!stateData.procedure) {
    return persist(conversation, {
      state: "SCHEDULING_PROCEDURE",
      stateData,
      message: "Fluxo de agendamento iniciado. Peça (apenas) qual procedimento o cliente deseja agendar.",
    });
  }

  if (!stateData.name) {
    return persist(conversation, {
      state: "SCHEDULING_NAME",
      stateData,
      message: `Procedimento registrado: ${stateData.procedure}. Peça o nome completo do paciente.`,
    });
  }

  if (input.date) {
    return resolveDateStep(conversation, stateData, input.date, "scheduling");
  }

  return persist(conversation, {
    state: "SCHEDULING_DATE",
    stateData,
    message: "Nome ja registrado. Peça a data desejada.",
  });
}

export async function provideProcedure(conversation: Conversation, procedure: string): Promise<FlowResult> {
  const stateData: FlowStateData = { ...conversation.state_data, procedure };
  if (stateData.name) {
    return persist(conversation, {
      state: "SCHEDULING_DATE",
      stateData,
      message: `Procedimento registrado: ${procedure}. Nome ja conhecido. Peça a data desejada.`,
    });
  }
  return persist(conversation, {
    state: "SCHEDULING_NAME",
    stateData,
    message: `Procedimento registrado: ${procedure}. Peça o nome completo do paciente.`,
  });
}

export async function provideName(conversation: Conversation, name: string): Promise<FlowResult> {
  const stateData: FlowStateData = { ...conversation.state_data, name };
  return persist(conversation, {
    state: "SCHEDULING_DATE",
    stateData,
    message: `Nome registrado: ${name}. Peça a data desejada.`,
  });
}

async function resolveDateStep(
  conversation: Conversation,
  baseStateData: FlowStateData,
  date: string,
  flowKind: "scheduling" | "rescheduling"
): Promise<FlowResult> {
  const durationMinutes = baseStateData.durationMinutes ?? 30;
  const slots = await schedulingService.checkAvailability(date, durationMinutes);

  const noSlotsState: ConversationFlowState = flowKind === "scheduling" ? "SCHEDULING_DATE" : "RESCHEDULING_DATE";
  const nextState: ConversationFlowState = flowKind === "scheduling" ? "SCHEDULING_TIME" : "RESCHEDULING_TIME";

  if (slots.length === 0) {
    return persist(conversation, {
      state: noSlotsState,
      stateData: baseStateData,
      message: `Nenhum horario livre em ${date}. Peça outra data ao cliente.`,
    });
  }

  const stateData: FlowStateData = { ...baseStateData, date, availableSlots: slots.slice(0, 6) };
  const labeledSlots = stateData.availableSlots!.map((s, i) => `${i + 1}) ${formatDateTime(s).time}`).join("  ");
  return persist(conversation, {
    state: nextState,
    stateData,
    message: `Horarios disponiveis em ${date}: ${labeledSlots}. Apresente essas opcoes numeradas (formato HH:MM) e pergunte qual o cliente prefere.`,
  });
}

export async function provideDate(conversation: Conversation, date: string): Promise<FlowResult> {
  return resolveDateStep(conversation, conversation.state_data, date, "scheduling");
}

export async function provideRescheduleDate(conversation: Conversation, date: string): Promise<FlowResult> {
  return resolveDateStep(conversation, conversation.state_data, date, "rescheduling");
}

export async function selectTime(conversation: Conversation, index: number): Promise<FlowResult> {
  const stateData = conversation.state_data;
  const slots = stateData.availableSlots || [];
  const start = slots[index - 1];

  if (!start) {
    const labeledSlots = slots.map((s, i) => `${i + 1}) ${formatDateTime(s).time}`).join("  ");
    return persist(conversation, {
      state: conversation.state,
      stateData,
      message: `Opcao invalida. As opcoes validas sao: ${labeledSlots}. Peça ao cliente para escolher um desses numeros.`,
    });
  }

  const newStateData: FlowStateData = { ...stateData, selectedStart: start };
  const nextState: ConversationFlowState =
    conversation.state === "RESCHEDULING_TIME" ? "RESCHEDULING_CONFIRM" : "SCHEDULING_CONFIRM";

  const { date, time } = formatDateTime(start);
  return persist(conversation, {
    state: nextState,
    stateData: newStateData,
    message: `Horario selecionado: ${date} as ${time}. Repita os dados (nome, procedimento, data, horario) e peça confirmação explícita ao cliente.`,
  });
}

export async function confirmScheduling(user: User, conversation: Conversation): Promise<FlowResult> {
  const { name, procedure, selectedStart, durationMinutes } = conversation.state_data;

  if (!name || !procedure || !selectedStart) {
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: "Faltaram informações para concluir o agendamento. Peça desculpas e pergunte se o cliente quer tentar novamente.",
    });
  }

  try {
    await schedulingService.createAppointment({
      userId: user.id,
      name,
      phone: user.phone,
      service: procedure,
      start: selectedStart,
      durationMinutes,
    });

    const { date, time } = formatDateTime(selectedStart);
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: `Agendamento confirmado! 😊\n\n${procedure} em ${date} às ${time}.\nEndereço: ${CLINIC_ADDRESS}\n\nPosso ajudar com mais alguma coisa?`,
    });
  } catch (err: any) {
    return persist(conversation, {
      state: "SCHEDULING_CONFIRM",
      stateData: conversation.state_data,
      message: `Desculpe, tive um problema técnico ao confirmar o agendamento (${err.message}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.`,
    });
  }
}

// ---------- Remarcação ----------

export async function beginRescheduling(user: User, conversation: Conversation): Promise<FlowResult> {
  const appointments = await schedulingService.findAppointmentsForUser(user.id);

  if (appointments.length === 0) {
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: "O cliente não possui agendamentos ativos. Informe isso e pergunte se pode ajudar em outra coisa.",
    });
  }

  if (appointments.length === 1) {
    const appt = appointments[0];
    return persist(conversation, {
      state: "RESCHEDULING_DATE",
      stateData: { scheduleId: appt.id, name: appt.patient_name, procedure: appt.procedure },
      message: `Agendamento encontrado: ${appt.procedure} em ${appt.date} às ${appt.time}. Informe isso ao cliente e pergunte para qual nova data ele quer remarcar.`,
    });
  }

  const candidates = appointments.map((a) => ({ scheduleId: a.id, procedure: a.procedure, date: a.date, time: a.time }));
  return persist(conversation, {
    state: "RESCHEDULING_SELECT",
    stateData: { candidates },
    message: `Varios agendamentos ativos encontrados: ${describeCandidates(candidates)}. Liste-os numerados ao cliente e pergunte qual ele quer remarcar.`,
  });
}

export async function selectAppointmentToReschedule(conversation: Conversation, index: number): Promise<FlowResult> {
  const candidates = conversation.state_data.candidates || [];
  const candidate = candidates[index - 1];
  if (!candidate) {
    return persist(conversation, {
      state: "RESCHEDULING_SELECT",
      stateData: conversation.state_data,
      message: `Opcao invalida. Opcoes validas: ${describeCandidates(candidates)}. Peça ao cliente para escolher um desses numeros.`,
    });
  }

  return persist(conversation, {
    state: "RESCHEDULING_DATE",
    stateData: { scheduleId: candidate.scheduleId, procedure: candidate.procedure },
    message: "Agendamento selecionado. Pergunte para qual nova data o cliente quer remarcar.",
  });
}

export async function confirmRescheduling(conversation: Conversation): Promise<FlowResult> {
  const { scheduleId, selectedStart, durationMinutes } = conversation.state_data;

  if (!scheduleId || !selectedStart) {
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: "Faltaram informações para concluir a remarcação. Peça desculpas e pergunte se o cliente quer tentar novamente.",
    });
  }

  try {
    await schedulingService.rescheduleAppointment(scheduleId, selectedStart, durationMinutes);
    const { date, time } = formatDateTime(selectedStart);
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: `Remarcação confirmada! 😊\n\nSeu novo horário é ${date} às ${time}.\n\nPosso ajudar com mais alguma coisa?`,
    });
  } catch (err: any) {
    return persist(conversation, {
      state: "RESCHEDULING_CONFIRM",
      stateData: conversation.state_data,
      message: `Desculpe, tive um problema técnico ao remarcar (${err.message}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.`,
    });
  }
}

// ---------- Cancelamento ----------

export async function beginCancellation(user: User, conversation: Conversation): Promise<FlowResult> {
  const appointments = await schedulingService.findAppointmentsForUser(user.id);

  if (appointments.length === 0) {
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: "O cliente não possui agendamentos ativos. Informe isso e pergunte se pode ajudar em outra coisa.",
    });
  }

  if (appointments.length === 1) {
    const appt = appointments[0];
    return persist(conversation, {
      state: "CANCELING_CONFIRM",
      stateData: { scheduleId: appt.id, procedure: appt.procedure, date: appt.date },
      message: `Agendamento encontrado: ${appt.procedure} em ${appt.date} às ${appt.time}. Confirme com o cliente se ele realmente deseja cancelar.`,
    });
  }

  const candidates = appointments.map((a) => ({ scheduleId: a.id, procedure: a.procedure, date: a.date, time: a.time }));
  return persist(conversation, {
    state: "CANCELING_SELECT",
    stateData: { candidates },
    message: `Varios agendamentos ativos encontrados: ${describeCandidates(candidates)}. Liste-os numerados ao cliente e pergunte qual ele quer cancelar.`,
  });
}

export async function selectAppointmentToCancel(conversation: Conversation, index: number): Promise<FlowResult> {
  const candidates = conversation.state_data.candidates || [];
  const candidate = candidates[index - 1];
  if (!candidate) {
    return persist(conversation, {
      state: "CANCELING_SELECT",
      stateData: conversation.state_data,
      message: `Opcao invalida. Opcoes validas: ${describeCandidates(candidates)}. Peça ao cliente para escolher um desses numeros.`,
    });
  }

  return persist(conversation, {
    state: "CANCELING_CONFIRM",
    stateData: { scheduleId: candidate.scheduleId, procedure: candidate.procedure, date: candidate.date },
    message: `Confirme com o cliente se ele realmente deseja cancelar ${candidate.procedure} em ${candidate.date}.`,
  });
}

export async function confirmCancellation(conversation: Conversation): Promise<FlowResult> {
  const { scheduleId } = conversation.state_data;

  if (!scheduleId) {
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message: "Faltaram informações para concluir o cancelamento. Peça desculpas e pergunte se o cliente quer tentar novamente.",
    });
  }

  try {
    await schedulingService.cancelAppointment(scheduleId);
    return persist(conversation, {
      state: "MENU",
      stateData: {},
      message:
        "Cancelamento confirmado. 💛 Se quiser reagendar quando for melhor pra você, é só me chamar.\n\nPosso ajudar com mais alguma coisa?",
    });
  } catch (err: any) {
    return persist(conversation, {
      state: "CANCELING_CONFIRM",
      stateData: conversation.state_data,
      message: `Desculpe, tive um problema técnico ao cancelar (${err.message}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.`,
    });
  }
}

/** Executa a acao pendente do estado *_CONFIRM atual, sem passar pelo LLM. */
export async function executePendingConfirmation(user: User, conversation: Conversation): Promise<FlowResult> {
  switch (conversation.state) {
    case "SCHEDULING_CONFIRM":
      return confirmScheduling(user, conversation);
    case "RESCHEDULING_CONFIRM":
      return confirmRescheduling(conversation);
    case "CANCELING_CONFIRM":
      return confirmCancellation(conversation);
    default:
      throw new Error(`Estado sem confirmacao pendente: ${conversation.state}`);
  }
}

export function isConfirmState(state: ConversationFlowState): boolean {
  return state === "SCHEDULING_CONFIRM" || state === "RESCHEDULING_CONFIRM" || state === "CANCELING_CONFIRM";
}
