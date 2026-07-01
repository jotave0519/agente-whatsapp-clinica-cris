/**
 * Logger simples e estruturado. O EasyPanel (e a maioria dos hosts Docker)
 * captura stdout/stderr diretamente, entao console.log/error ja aparecem
 * nos logs do servico - sem necessidade de dependencia externa.
 */
function serialize(data: unknown): string {
  if (data === undefined) return "";
  try {
    return JSON.stringify(data, (_key, value) => (value instanceof Error ? { message: value.message, stack: value.stack } : value));
  } catch {
    return String(data);
  }
}

export const logger = {
  info(scope: string, message: string, data?: unknown): void {
    console.log(`[INFO] [${scope}] ${message}${data !== undefined ? " " + serialize(data) : ""}`);
  },
  warn(scope: string, message: string, data?: unknown): void {
    console.warn(`[WARN] [${scope}] ${message}${data !== undefined ? " " + serialize(data) : ""}`);
  },
  error(scope: string, message: string, err?: unknown): void {
    const details = describeError(err);
    console.error(`[ERROR] [${scope}] ${message}`, details);
  },
};

/** Extrai mensagem, stack trace e corpo de resposta (para erros do axios) de forma legivel. */
export function describeError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { raw: err };

  const anyErr = err as any;
  const result: Record<string, unknown> = {
    message: anyErr.message,
    stack: anyErr.stack,
  };

  if (anyErr.response) {
    result.httpStatus = anyErr.response.status;
    result.httpData = anyErr.response.data;
  }
  if (anyErr.code) {
    result.code = anyErr.code;
  }

  return result;
}
