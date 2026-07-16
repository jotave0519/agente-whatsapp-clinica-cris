import * as faqRepository from "../repositories/faqRepository";
import * as messageTemplateRepository from "../repositories/messageTemplateRepository";
import * as procedureRepository from "../repositories/procedureRepository";
import * as settingsRepository from "../repositories/settingsRepository";
import { logger } from "../utils/logger";
import * as businessHoursService from "./businessHoursService";

const SCOPE = "aiKnowledgeService";
const CACHE_TTL_MS = 60_000;

// Textos usados se a linha nao existir em message_templates ou a consulta ao
// banco falhar - a camada administrativa nunca pode deixar o atendimento sem
// resposta. Mantidos identicos ao que era hardcoded antes desta feature.
const DEFAULT_TEMPLATES: Record<string, string> = {
  confirm_scheduling_success:
    "Agendamento confirmado! 😊\n\n{{procedure}} em {{date}} às {{time}}.\nEndereço: {{address}}\n\nPosso ajudar com mais alguma coisa?",
  confirm_scheduling_failure:
    "Desculpe, tive um problema técnico ao confirmar o agendamento ({{error}}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.",
  confirm_rescheduling_success: "Remarcação confirmada! 😊\n\nSeu novo horário é {{date}} às {{time}}.\n\nPosso ajudar com mais alguma coisa?",
  confirm_rescheduling_failure:
    "Desculpe, tive um problema técnico ao remarcar ({{error}}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.",
  confirm_cancellation_success:
    "Cancelamento confirmado. 💛 Se quiser reagendar quando for melhor pra você, é só me chamar.\n\nPosso ajudar com mais alguma coisa?",
  confirm_cancellation_failure:
    "Desculpe, tive um problema técnico ao cancelar ({{error}}). Pode tentar novamente em instantes? Se preferir, posso chamar um atendente.",
  abandon_flow: "Sem problemas, deixei esse atendimento de lado. Posso ajudar com mais alguma coisa?",
  nudge_inactivity: "😊 Oi! Estou por aqui.\n\nSe ainda desejar continuar seu atendimento, é só responder esta mensagem.",
  close_inactivity:
    "Como não recebi nenhuma resposta, vou encerrar este atendimento por enquanto.\n\nQuando quiser continuar, basta enviar uma nova mensagem. Será um prazer ajudar! 💛",
  generic_error: "Desculpe, tive um problema para responder agora. Nossa equipe vai te retornar em breve.",
  welcome_message:
    "Cumprimente de forma calorosa e profissional, dando as boas-vindas a clinica e se apresentando brevemente como a assistente virtual. Pergunte como pode ajudar hoje. Nao liste opcoes numeradas nem mencione um menu - deixe a conversa fluir naturalmente a partir da resposta do cliente.",
  no_slot_found: "Informe educadamente que nao ha horarios livres na data pedida e peca outra data ao cliente.",
  clinic_initiated_cancellation:
    "Olá, {{patientName}}!\n\nInfelizmente precisaremos cancelar sua consulta que estava marcada para {{date}} às {{time}}.{{reasonBlock}}\n\nPedimos desculpas pelo transtorno.\n\n{{offerQuestion}}",
  clinic_cancellation_decline: "Tudo bem! 😊\n\nQuando desejar agendar novamente, será um prazer atendê-lo.",
  confirmation_request:
    "Olá, {{nome}}! 😊\n\nPassando para confirmar sua consulta na Clínica Dra. Cristiane Zangelmi.\n\n📅 {{dia_semana}}\n🕘 {{hora}}\n\nVocê confirma sua presença?\n\nResponda:\n✅ Confirmar\n❌ Cancelar\n🔄 Remarcar",
  confirmation_nudge: "Olá 😊\n\nSó passando para lembrar da confirmação da sua consulta.\n\nPode responder quando puder.",
  reminder_confirm_ack: "Perfeito! 😊\n\nSua consulta está confirmada. Até breve!",
};

let cachedTemplates: Map<string, string> | null = null;
let cachedTemplatesAt = 0;
let cachedContextExpiry: number | null = null;
let cachedContextExpiryAt = 0;

export function invalidateCache(): void {
  cachedTemplates = null;
  cachedContextExpiry = null;
}

async function loadTemplates(): Promise<Map<string, string>> {
  if (cachedTemplates && Date.now() - cachedTemplatesAt < CACHE_TTL_MS) return cachedTemplates;
  try {
    const rows = await messageTemplateRepository.listAll();
    cachedTemplates = new Map(rows.map((r) => [r.key, r.body]));
    cachedTemplatesAt = Date.now();
  } catch (err) {
    logger.error(SCOPE, "Falha ao carregar message_templates - usando defaults", err);
    cachedTemplates = new Map();
  }
  return cachedTemplates;
}

/** Busca o template pelo key, aplica {{placeholders}} e cai no default hardcoded se faltar. */
export async function getMessageTemplate(key: string, vars: Record<string, string> = {}): Promise<string> {
  const templates = await loadTemplates();
  let body = templates.get(key) || DEFAULT_TEMPLATES[key] || "";
  for (const [varName, value] of Object.entries(vars)) {
    body = body.split(`{{${varName}}}`).join(value);
  }
  return body;
}

export async function getContextExpiryMinutes(): Promise<number> {
  if (cachedContextExpiry !== null && Date.now() - cachedContextExpiryAt < CACHE_TTL_MS) return cachedContextExpiry;
  try {
    const settings = await settingsRepository.getClinicSettings();
    cachedContextExpiry = settings.context_expiry_minutes ?? 1440;
  } catch (err) {
    logger.error(SCOPE, "Falha ao carregar context_expiry_minutes - usando default 1440", err);
    cachedContextExpiry = 1440;
  }
  cachedContextExpiryAt = Date.now();
  return cachedContextExpiry;
}

/** Casamento simples (case-insensitive) do nome do procedimento informado pelo cliente contra o cadastro. */
export async function findProcedureDuration(procedureName: string): Promise<number | null> {
  try {
    const procedures = await procedureRepository.listAll();
    const needle = procedureName.trim().toLowerCase();
    const match = procedures.find((p) => p.active && p.name.trim().toLowerCase() === needle) ||
      procedures.find((p) => p.active && (needle.includes(p.name.trim().toLowerCase()) || p.name.trim().toLowerCase().includes(needle)));
    return match?.duration_minutes ?? null;
  } catch (err) {
    logger.error(SCOPE, "Falha ao buscar duracao do procedimento", err);
    return null;
  }
}

/**
 * Monta o bloco de conhecimento da clinica usado no prompt (substitui o antigo
 * arquivo estatico workflows/atendimento_faq.md): dados da clinica, sobre a
 * clinica, procedimentos (sem valores), horario de funcionamento e FAQ.
 */
export async function getClinicInfoText(): Promise<string> {
  const [settings, procedures, faqs, hoursLabel] = await Promise.all([
    settingsRepository.getClinicSettings(),
    procedureRepository.listAll(),
    faqRepository.listActiveAnswered(),
    businessHoursService.describeWeeklyHoursLabel(),
  ]);

  const lines: string[] = [];
  lines.push(`## Dados da clínica`);
  lines.push(`Nome: ${settings.name}`);
  if (settings.responsible_name) lines.push(`Responsável: ${settings.responsible_name}`);
  if (settings.specialty) lines.push(`Especialidade: ${settings.specialty}`);
  if (settings.address) {
    const location = [settings.address, settings.city, settings.state, settings.zip_code].filter(Boolean).join(", ");
    lines.push(`Endereço: ${location}`);
  }
  if (settings.phone) lines.push(`Telefone: ${settings.phone}`);
  if (settings.whatsapp) lines.push(`WhatsApp: ${settings.whatsapp}`);
  if (settings.email) lines.push(`E-mail: ${settings.email}`);
  if (settings.instagram) lines.push(`Instagram: ${settings.instagram}`);
  if (settings.website) lines.push(`Site: ${settings.website}`);
  lines.push(`Horário de funcionamento: ${hoursLabel}`);
  if (settings.general_notes) lines.push(`Observações gerais: ${settings.general_notes}`);

  if (settings.about_text) {
    lines.push(`\n## Sobre a clínica`);
    lines.push(settings.about_text);
  }

  const activeProcedures = procedures.filter((p) => p.active);
  if (activeProcedures.length > 0) {
    lines.push(`\n## Procedimentos realizados`);
    for (const p of activeProcedures) {
      const duration = p.duration_minutes ? `${p.duration_minutes} minutos` : "duração não informada";
      lines.push(`- ${p.name} (${duration})${p.description ? `: ${p.description}` : ""}`);
      if (p.pre_instructions) lines.push(`  Orientações pré-procedimento: ${p.pre_instructions}`);
      if (p.post_instructions) lines.push(`  Orientações pós-procedimento: ${p.post_instructions}`);
      if (p.notes) lines.push(`  Observações: ${p.notes}`);
    }
    lines.push(`NUNCA informe valores/preços - eles variam por paciente e são definidos apenas na avaliação presencial.`);
  }

  if (faqs.length > 0) {
    lines.push(`\n## Perguntas frequentes`);
    lines.push(
      `Se a pergunta do cliente corresponder a uma destas, responda usando EXATAMENTE a resposta cadastrada abaixo (pode adaptar o tom, mas não o conteúdo):`
    );
    for (const faq of faqs) {
      lines.push(`P: ${faq.question}\nR: ${faq.answer}`);
    }
  }

  return lines.join("\n");
}
