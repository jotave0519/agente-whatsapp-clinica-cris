import axios from "axios";
import { env } from "../config/env";

// Cliente REST feito com axios (em vez do SDK oficial @anthropic-ai/sdk) porque o
// fetch interno do SDK apresenta "Premature close" ao ler respostas gzip neste
// ambiente Windows (mesmo problema observado com gaxios/node-fetch no Google Calendar).

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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
  const response = await axios.post<AnthropicMessage>(MESSAGES_URL, params, {
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
  });
  return response.data;
}
