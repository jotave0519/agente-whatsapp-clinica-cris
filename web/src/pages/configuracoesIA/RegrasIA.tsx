import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";

interface ClinicSettings {
  context_expiry_minutes: number;
}

export function RegrasIA() {
  const [hours, setHours] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ clinic: ClinicSettings }>("/settings")
      .then((r) => setHours(String(r.clinic.context_expiry_minutes / 60)))
      .catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const minutes = Math.round(Number(hours) * 60);
      await api.patch("/settings", { clinic: { context_expiry_minutes: minutes } });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && hours === "") return <div className="empty-state">{error}</div>;
  if (hours === "") return <div className="empty-state">Carregando...</div>;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
      {error && <div className="error-text">{error}</div>}
      {saved && <div style={{ color: "var(--green)", fontSize: 12.5, marginBottom: 10 }}>Regra salva.</div>}

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Tempo máximo para manter contexto de um agendamento incompleto</div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
          Se o cliente abandonar um agendamento/remarcação/cancelamento no meio e voltar a falar com a clínica depois desse tempo, a IA esquece
          completamente o fluxo anterior e começa do zero. O histórico da conversa continua disponível no CRM, só o fluxo em andamento é reiniciado.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input className="input" style={{ width: 100 }} type="number" min={1} step="0.5" required value={hours} onChange={(e) => setHours(e.target.value)} />
          <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>horas</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
