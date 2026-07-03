import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

interface ClinicSettings {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface BusinessHourRow {
  weekday: number;
  enabled: boolean;
  open_time: string;
  close_time: string;
}

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function Configuracoes() {
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [hours, setHours] = useState<BusinessHourRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ clinic: ClinicSettings; businessHours: BusinessHourRow[] }>("/settings")
      .then((r) => {
        setClinic(r.clinic);
        setHours([...r.businessHours].sort((a, b) => a.weekday - b.weekday));
      })
      .catch((e) => setError(e.message));
  }, []);

  function updateHour(weekday: number, patch: Partial<BusinessHourRow>) {
    setHours((prev) => (prev ? prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)) : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clinic || !hours) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.patch("/settings", { clinic, businessHours: hours });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !clinic) return <div className="empty-state">{error}</div>;
  if (!clinic || !hours) return <div className="empty-state">Carregando...</div>;

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Gerencie as preferências da clínica e da plataforma</p>

      {error && <div className="error-text">{error}</div>}
      {saved && <div style={{ color: "var(--green)", fontSize: 12.5, marginBottom: 10 }}>Configurações salvas.</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 620 }}>
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Dados da clínica</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>Informações exibidas para pacientes e no agente de IA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label className="field-label">Nome</label>
              <input className="input" value={clinic.name} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Telefone</label>
              <input className="input" value={clinic.phone || ""} onChange={(e) => setClinic({ ...clinic, phone: e.target.value })} />
            </div>
            <div>
              <label className="field-label">E-mail</label>
              <input className="input" value={clinic.email || ""} onChange={(e) => setClinic({ ...clinic, email: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Endereço</label>
              <input className="input" value={clinic.address || ""} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Horário de atendimento</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>Usado pela IA para oferecer horários disponíveis no WhatsApp</div>
          {hours.map((h) => (
            <div key={h.weekday} style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 0", borderTop: "1px solid var(--border-soft)" }}>
              <input type="checkbox" checked={h.enabled} onChange={(e) => updateHour(h.weekday, { enabled: e.target.checked })} />
              <span style={{ fontSize: 13.5, fontWeight: 500, width: 100 }}>{WEEKDAY_LABELS[h.weekday]}</span>
              {h.enabled ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="input"
                    style={{ width: 110 }}
                    type="time"
                    value={h.open_time.slice(0, 5)}
                    onChange={(e) => updateHour(h.weekday, { open_time: e.target.value })}
                  />
                  <span style={{ color: "var(--text-muted)" }}>às</span>
                  <input
                    className="input"
                    style={{ width: 110 }}
                    type="time"
                    value={h.close_time.slice(0, 5)}
                    onChange={(e) => updateHour(h.weekday, { close_time: e.target.value })}
                  />
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Fechado</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
