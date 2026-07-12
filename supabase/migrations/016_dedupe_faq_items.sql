-- Corrige duplicacao de perguntas no FAQ Inteligente.
--
-- Causa raiz: faq_items nunca teve nenhuma restricao de unicidade em
-- `question`, entao quando o INSERT de perguntas de exemplo (migration 012)
-- foi executado mais de uma vez, o "on conflict do nothing" (que so protege
-- contra colisao de `id`, a unica constraint unica que existia) nao impediu
-- nada - cada execucao criou 28 linhas novas com ids diferentes. Confirmado
-- ao vivo: 56 linhas no banco para 28 perguntas unicas, criadas em dois lotes
-- com ~7s de diferenca.
--
-- Ao deduplicar, mantem a linha com resposta preenchida quando so uma das
-- duas copias foi respondida pela clinica (2 dos 28 pares tinham isso -
-- nao pode perder essa edicao). Entre linhas empatadas (ambas vazias ou
-- ambas respondidas), mantem a mais antiga.

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(btrim(question))
      order by (case when btrim(coalesce(answer, '')) <> '' then 0 else 1 end), created_at asc
    ) as rn
  from faq_items
)
delete from faq_items
where id in (select id from ranked where rn > 1);

-- Impede que isso aconteca de novo: pergunta (normalizada, sem espacos nas
-- pontas e sem diferenciar maiusculas/minusculas) passa a ser unica.
create unique index if not exists idx_faq_items_question_unique on faq_items (lower(btrim(question)));
