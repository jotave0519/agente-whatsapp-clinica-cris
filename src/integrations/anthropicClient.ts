import axios from "axios";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// Cliente REST feito com axios (em vez do SDK oficial @anthropic-ai/sdk) porque o
// fetch interno do SDK apresenta "Premature close" ao ler respostas gzip neste
// ambiente Windows (mesmo problema observado com gaxios/node-fetch no Google Calendar).

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const SCOPE = "anthropicClient";

export interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: any;
}

export interface AnthropicMessage {
  id: string;
  content: AnthropicContentBlock[];
  stop_reason: string;
  [key: string]: unknown;
}

export async function createMessage(params: {
  model: string;
  max_tokens: number;
  system?: string;
  tools?: any[];
  messages: any[];
}): Promise<AnthropicMessage> {
  if (!env.anthropicApiKey) {
    logger.error(SCOPE, "ANTHROPIC_API_KEY nao configurada");
    throw new Error("ANTHROPIC_API_KEY nao configurada no ambiente");
  }

  logger.info(SCOPE, "Chamando POST /v1/messages", {
    model: params.model,
    messageCount: params.messages.length,
    toolCount: params.tools?.length ?? 0,
  });

  try {
    const response = await axios.post<AnthropicMessage>(MESSAGES_URL, params, {
      headers: {
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      timeout: 60_000,
    });
    logger.info(SCOPE, "Resposta recebida de /v1/messages", { stopReason: response.data.stop_reason });
    return response.data;
  } catch (err) {
    logger.error(SCOPE, "Falha ao chamar a API da Anthropic", err);
    throw err;
  }
}
