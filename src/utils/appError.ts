/**
 * Erro esperado de regra de negocio (estoque insuficiente, registro nao
 * encontrado, etc). A mensagem nunca contem detalhe de SQL/stack/erro
 * interno, entao e segura para repassar direto ao cliente da API - ao
 * contrario de um erro generico capturado em catch, que deve virar uma
 * mensagem generica (ver controllers/api/*).
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}
