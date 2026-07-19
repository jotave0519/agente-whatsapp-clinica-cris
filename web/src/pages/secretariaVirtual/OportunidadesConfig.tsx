import { FormEvent, useEffect, useState } from "react";
import { BackHeader } from "../../components/BackHeader";
import { api } from "../../lib/api";

interface Settings {
  commercial_ai_enabled: boolean;
  commercial_max_attempts: number;
  commercial_nudge_interval_days: number;
  commercial_decision_grace_days: number;
}

export function OportunidadesConfig() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<{ clinic: Settings }>("/settings")
      .then((r) => setSettings(r.clinic))
      .catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch("/settings", { clinic: settings });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <BackHeader title="Oportunidades comerciais" subtitle="Ajustes finos do acompanhamento automático de pacientes que ainda não converteram" backTo="/secretaria-virtual" />

      {error && <div className="error-text">{error}</div>}
      {!settings ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 480, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>Oportunidades comerciais ativas</div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.commercial_ai_enabled}
                onChange={(e) => setSettings({ ...settings, commercial_ai_enabled: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>

          <div>
            <label className="field-label">Máximo de tentativas de contato por paciente</label>
            <input
              className="input"
              type="number"
              min={1}
              value={settings.commercial_max_attempts}
              onChange={(e) => setSettings({ ...settings, commercial_max_attempts: Math.max(1, Number(e.target.value)) })}
            />
          </div>

          <div>
            <label className="field-label">Intervalo entre mensagens (dias)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={settings.commercial_nudge_interval_days}
              onChange={(e) => setSettings({ ...settings, commercial_nudge_interval_days: Math.max(1, Number(e.target.value)) })}
            />
          </div>

          <div>
            <label className="field-label">Dias de carência após avaliação antes de retomar contato</label>
            <input
              className="input"
              type="number"
              min={0}
              value={settings.commercial_decision_grace_days}
              onChange={(e) => setSettings({ ...settings, commercial_decision_grace_days: Math.max(0, Number(e.target.value)) })}
            />
          </div>

          <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
            As mensagens só são enviadas dentro do horário de funcionamento já configurado da clínica, e param imediatamente assim que o
            paciente responder.
          </p>

          {saved && <div style={{ color: "var(--green)", fontSize: 12.5 }}>Configurações salvas.</div>}
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}
    </div>
  );
}
