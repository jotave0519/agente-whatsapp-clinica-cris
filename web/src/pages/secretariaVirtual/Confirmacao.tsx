import { useEffect, useState } from "react";
import { BackHeader } from "../../components/BackHeader";
import { api } from "../../lib/api";

interface ClinicSettings {
  confirmation_enabled: boolean;
  confirmation_hours_before: number;
  confirmation_nudges_enabled: boolean;
  confirmation_nudge_count: number;
  confirmation_nudge_interval_hours: number;
  [key: string]: unknown;
}

const HOURS_SHORTCUTS = [24, 12, 6, 2];

export function Confirmacao() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ clinic: ClinicSettings }>("/settings")
      .then((r) => setSettings(r.clinic))
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

  return (
    <div>
      <BackHeader title="Confirmação de consultas" subtitle="Envia um pedido de confirmação pelo WhatsApp antes de cada consulta" backTo="/secretaria-virtual" />

      {error && <div className="error-text">{error}</div>}
      {!settings ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <div className="card" style={{ maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Confirmação automática</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Liga ou desliga o pedido de confirmação</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.confirmation_enabled}
                disabled={saving}
                onChange={() => saveSettings({ confirmation_enabled: !settings.confirmation_enabled })}
              />
              <span className="switch-track" />
            </label>
          </div>

          <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: "1px solid var(--border-soft)" }}>
            <label className="field-label">Enviar quantas horas antes da consulta?</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
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
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Se o paciente não responder, cutuca de novo</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.confirmation_nudges_enabled}
                disabled={saving}
                onChange={() => saveSettings({ confirmation_nudges_enabled: !settings.confirmation_nudges_enabled })}
              />
              <span className="switch-track" />
            </label>
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
      )}
    </div>
  );
}
