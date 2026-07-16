import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface MessageTemplate {
  key: string;
  label: string;
  body: string;
}

// Estas duas nao sao enviadas literalmente ao cliente - a IA usa como
// orientacao de tom, porque precisam ser dinamicas (nome do cliente, data
// especifica etc). As outras sao enviadas exatamente como cadastradas.
const GUIDANCE_KEYS = new Set(["welcome_message", "no_slot_found"]);

export function MensagensAutomaticas() {
  const [items, setItems] = useState<MessageTemplate[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: MessageTemplate[] }>("/message-templates")
      .then((r) => {
        setItems(r.items);
        setDrafts(Object.fromEntries(r.items.map((t) => [t.key, t.body])));
      })
      .catch((e) => setError(e.message));
  }, []);

  async function handleSave(key: string) {
    setSavingKey(key);
    setSavedKey(null);
    setError(null);
    try {
      await api.patch(`/message-templates/${key}`, { body: drafts[key] });
      setSavedKey(key);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  if (error && !items) return <div className="empty-state">{error}</div>;
  if (!items) return <div className="empty-state">Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      {error && <div className="error-text">{error}</div>}
      <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Use <code>{"{{placeholder}}"}</code> para inserir dados dinâmicos (ex: <code>{"{{procedure}}"}</code>, <code>{"{{date}}"}</code>,{" "}
        <code>{"{{time}}"}</code>, <code>{"{{address}}"}</code>, <code>{"{{patientName}}"}</code>, <code>{"{{error}}"}</code>). Nos lembretes de consulta,
        use <code>{"{{nome}}"}</code>, <code>{"{{procedimento}}"}</code>, <code>{"{{data}}"}</code>, <code>{"{{hora}}"}</code> e{" "}
        <code>{"{{dia_semana}}"}</code>.
      </p>

      {items.map((t) => (
        <div key={t.key} className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{t.label}</div>
            <span className={`badge ${GUIDANCE_KEYS.has(t.key) ? "badge-yellow" : "badge-blue"}`}>
              {GUIDANCE_KEYS.has(t.key) ? "orientação de tom" : "enviado exatamente como está"}
            </span>
          </div>
          <textarea
            className="input"
            rows={GUIDANCE_KEYS.has(t.key) ? 2 : 4}
            style={{ marginTop: 10 }}
            value={drafts[t.key] ?? t.body}
            onChange={(e) => setDrafts({ ...drafts, [t.key]: e.target.value })}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button className="btn btn-secondary" type="button" disabled={savingKey === t.key} onClick={() => handleSave(t.key)}>
              {savingKey === t.key ? "Salvando..." : "Salvar"}
            </button>
            {savedKey === t.key && <span style={{ color: "var(--green)", fontSize: 12.5 }}>Salvo.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
