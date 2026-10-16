import { createClient, processLock } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// processLock em vez do navigator.locks padrao: no PWA (principalmente iOS),
// quando o app volta do segundo plano o lock do navegador pode ficar preso e
// getSession() nunca resolve -> app "carregando infinito". O lock em memoria
// nao depende do navegador. Storage/chave da sessao continuam os mesmos, entao
// quem ja esta logado continua logado.
export const supabase = createClient(url, anonKey, {
  auth: { lock: processLock },
});
