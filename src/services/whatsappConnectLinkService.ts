import crypto from "crypto";

/**
 * Tokens efemeros (memoria do processo, sem tabela nova) que permitem abrir
 * o QR Code de conexao do WhatsApp numa pagina publica, sem login - usado
 * quando a clinica so tem o celular em maos e precisa escanear o QR a
 * partir de outro aparelho. Vida curta e token imprevisivel (48 hex chars)
 * substituem a necessidade de autenticacao nessa rota.
 */

interface ConnectLinkToken {
  token: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 10 * 60 * 1000;
const tokens = new Map<string, ConnectLinkToken>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of tokens) {
    if (entry.expiresAt <= now) tokens.delete(key);
  }
}

export function createConnectLinkToken(): ConnectLinkToken {
  pruneExpired();
  const token = crypto.randomBytes(24).toString("hex");
  const entry = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  tokens.set(token, entry);
  return entry;
}

export function isConnectLinkTokenValid(token: string): boolean {
  const entry = tokens.get(token);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    tokens.delete(token);
    return false;
  }
  return true;
}
