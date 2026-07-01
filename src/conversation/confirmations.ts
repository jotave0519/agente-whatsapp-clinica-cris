/**
 * Deteccao deterministica de confirmacao/desistencia, usada como fast-path
 * antes de envolver o modelo. Isso existe porque depender do modelo para
 * decidir "o cliente confirmou, devo chamar a ferramenta" e menos confiavel
 * do que apenas reconhecer os padroes mais comuns direto no codigo.
 */

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[!.,;:]+$/g, "")
    .trim();
}

const AFFIRMATIVE_PHRASES = [
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

const ABANDON_PHRASES = [
  "cancela isso",
  "esquece",
  "esquece isso",
  "deixa pra la",
  "deixa para la",
  "mudei de ideia",
  "quero voltar ao menu",
  "voltar ao menu",
  "para",
  "pausa isso",
  "nao quero mais",
];

/**
 * Mensagens curtas (ate 6 palavras), sem negacao, contendo uma palavra/frase
 * afirmativa, contam como confirmacao. Tolerante o suficiente para cobrir a
 * maioria das respostas reais de WhatsApp ("sim", "pode confirmar", "beleza
 * pode ser"), mas exige negacao explicita para nao confirmar por engano.
 */
export function isConfirmation(text: string): boolean {
  const norm = normalize(text);
  if (!norm) return false;
  if (NEGATION_PATTERN.test(norm)) return false;

  const wordCount = norm.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 6) return false;

  return AFFIRMATIVE_PHRASES.some((phrase) => norm === phrase || norm.includes(phrase));
}

export function isAbandon(text: string): boolean {
  const norm = normalize(text);
  return ABANDON_PHRASES.some((phrase) => norm === phrase);
}
