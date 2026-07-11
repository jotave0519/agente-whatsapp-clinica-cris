/**
 * Tenta novamente uma vez (por padrao) apos uma falha transitoria, antes de
 * desistir e deixar o erro subir. Usado em chamadas de rede propensas a
 * instabilidade momentanea (ex: Google Calendar), para que uma falha passageira
 * nao vire "erro tecnico" visivel na conversa.
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastErr;
}
