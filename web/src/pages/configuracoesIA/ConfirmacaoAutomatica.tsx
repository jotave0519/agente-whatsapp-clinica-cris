import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface ClinicSettings {
  confirmation_enabled: boolean;
  confirmation_hours_before: number;
  confirmation_nudges_enabled: boolean;
  confirmation_nudge_count: number;
  confirmation_nudge_interval_hours: number;
  [key: string]: unknown;
}

interface MessageTemplate {
  key: string;
  label: string;
  body: string;
}

const TEMPLATE_KEYS = ["confirmation_request", "confirmation_nudge"];
const HOURS_SHORTCUTS = [24, 12, 6, 2];

export function ConfirmacaoAutomatica() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ clinic: ClinicSettings }>("/settings")
      .then((r) => setSettings(r.clinic))
      .catch((e) => setError(e.message));
    api
      .get<{ items: MessageTemplate[] }>("/message-templates")
      .then((r) => {
        const items = r.items.filter((t) => TEMPLATE_KEYS.includes(t.key));
        setTemplates(items);
        setDrafts(Object.fromEntries(items.map((t) => [t.key, t.body])));
      })
      .catch((e) => setError(e.message));
  }, []);

  async function saveSettings(patch: Partial<ClinicSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setError(null);
    try {
      await api.patch("/settings", { clinic: patch });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTemplate(key: string) {
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

  if (error && !settings) return <div className="empty-state">{error}</div>;
  if (!settings || !templates) return <div className="empty-state">Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Confirmação automática de consultas</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Envia um pedido de confirmação pelo WhatsApp antes de cada consulta</div>
          </div>
          <input
            type="checkbox"
            checked={settings.confirmation_enabled}
            disabled={saving}
            onChange={() => saveSettings({ confirmation_enabled: !settings.confirmation_enabled })}
          />
        </div>

        <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
          <label className="field-label">Enviar confirmação quantas horas antes da consulta?</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input
              type="number"
              className="input"
              style={{ maxWidth: 100 }}
              min={1}
              value={settings.confirmation_hours_before}
              onChange={(e) => setSettings({ ...settings, confirmation_hours_before: Number(e.target.value) })}
              onBlur={(e) => saveSettings({ confirmation_hours_before: Number(e.target.value) })}
            />
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>horas</span>
            {HOURS_SHORTCUTS.map((h) => (
              <button
                key={h}
                type="button"
                className={`segmented-item${settings.confirmation_hours_before === h ? " active" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => saveSettings({ confirmation_hours_before: h })}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Lembretes de não-resposta</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Se o paciente não responder, cutuca de novo até a quantidade configurada</div>
          </div>
          <input
            type="checkbox"
            checked={settings.confirmation_nudges_enabled}
            disabled={saving}
            onChange={() => saveSettings({ confirmation_nudges_enabled: !settings.confirmation_nudges_enabled })}
          />
        </div>

        <div style={{ display: "flex", gap: 20, paddingTop: 14, flexWrap: "wrap" }}>
          <div>
            <label className="field-label">Quantidade de lembretes</label>
            <input
              type="number"
              className="input"
              style={{ maxWidth: 100, marginTop: 6 }}
              min={0}
              value={settings.confirmation_nudge_count}
              onChange={(e) => setSettings({ ...settings, confirmation_nudge_count: Number(e.target.value) })}
              onBlur={(e) => saveSettings({ confirmation_nudge_count: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="field-label">Intervalo entre lembretes (horas)</label>
            <input
              type="number"
              className="input"
              style={{ maxWidth: 100, marginTop: 6 }}
              min={1}
              value={settings.confirmation_nudge_interval_hours}
              onChange={(e) => setSettings({ ...settings, confirmation_nudge_interval_hours: Number(e.target.value) })}
              onBlur={(e) => saveSettings({ confirmation_nudge_interval_hours: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        Use <code>{"{{placeholder}}"}</code> para inserir dados dinâmicos: <code>{"{{nome}}"}</code>, <code>{"{{procedimento}}"}</code>,{" "}
        <code>{"{{data}}"}</code>, <code>{"{{hora}}"}</code>, <code>{"{{dia_semana}}"}</code>.
      </p>

      {templates.map((t) => (
        <div key={t.key} className="card">
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
          <textarea
            className="input"
            rows={5}
            style={{ marginTop: 10 }}
            value={drafts[t.key] ?? t.body}
            onChange={(e) => setDrafts({ ...drafts, [t.key]: e.target.value })}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button className="btn btn-secondary" type="button" disabled={savingKey === t.key} onClick={() => handleSaveTemplate(t.key)}>
              {savingKey === t.key ? "Salvando..." : "Salvar"}
            </button>
            {savedKey === t.key && <span style={{ color: "var(--green)", fontSize: 12.5 }}>Salvo.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
