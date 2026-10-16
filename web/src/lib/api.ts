import { supabase } from "./supabaseClient";

// Tempo maximo de espera para LEITURAS (GET). Escritas (POST/PATCH/DELETE) nao
// tem timeout de proposito: cortar uma escrita que o servidor ja gravou faria a
// pessoa tentar de novo e duplicar o registro (ex.: lancamento no Financeiro).
const READ_TIMEOUT_MS = 20_000;
// Pegar a sessao e local (ou um refresh rapido); se travar, nao segura a tela.
const SESSION_TIMEOUT_MS = 8_000;

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Endereco reserva do mesmo servidor (mesmo backend, mesmo banco). Algumas redes
// moveis/Wi-Fi ou DNS privado no Android bloqueiam o dominio *.easypanel.host;
// se uma leitura falhar por rede, tentamos por aqui e passamos a usar esse
// endereco ate o app ser fechado. Enquanto o dominio nao existir, a tentativa
// so falha e o erro original aparece - sem efeito colateral.
const FALLBACK_BASE = (import.meta.env.VITE_API_FALLBACK_URL || "https://zangelmi.nortic.digital").replace(/\/$/, "");
let apiBase = "";

class NetworkError extends Error {
  constructor(public readonly timedOut: boolean) {
    super(
      timedOut
        ? "O servidor demorou para responder. Verifique a internet e tente novamente."
        : "Sem conexao com o servidor. Verifique a internet e tente novamente."
    );
  }
}

async function send(base: string, path: string, options: RequestInit, token: string | undefined, isRead: boolean): Promise<Response> {
  const controller = isRead ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), READ_TIMEOUT_MS) : null;
  try {
    return await fetch(`${base}/api/v1${path}`, {
      ...options,
      signal: controller?.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new NetworkError(!!controller?.signal.aborted);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await withTimeout(
    supabase.auth.getSession(),
    SESSION_TIMEOUT_MS,
    "Nao foi possivel validar sua sessao. Tente novamente."
  );
  const token = data.session?.access_token;

  const isRead = !options.method || options.method === "GET";

  let response: Response;
  try {
    response = await send(apiBase, path, options, token, isRead);
  } catch (err) {
    // So leituras tentam o reserva automaticamente (repetir uma escrita
    // poderia duplicar registro). Depois que o reserva funciona, as escritas
    // ja vao direto por ele, porque apiBase muda.
    const canFallback = isRead && apiBase === "" && FALLBACK_BASE !== window.location.origin;
    if (!(err instanceof NetworkError) || !canFallback) throw err;
    try {
      response = await send(FALLBACK_BASE, path, options, token, isRead);
      apiBase = FALLBACK_BASE;
    } catch {
      throw err;
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined }),
};
