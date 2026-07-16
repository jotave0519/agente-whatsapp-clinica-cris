import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { getDisplayStatus } from "../lib/scheduleStatus";
import { ArrowLeftIcon } from "../components/icons";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  do_not_contact: boolean;
  created_at: string;
}

interface ScheduleItem {
  id: string;
  procedure: string;
  date: string;
  time: string;
  status: string;
  confirmation_status: "pending" | "awaiting" | "confirmed" | "cancelled";
  was_rescheduled: boolean;
  confirmed_at: string | null;
}

interface ScheduleEventItem {
  id: string;
  event_type: string;
  detail: string | null;
  created_at: string;
  schedule_procedure: string;
  schedule_date: string;
  schedule_time: string;
}

interface HistoryResponse {
  patient: Patient;
  schedules: ScheduleItem[];
  events: ScheduleEventItem[];
}

const EVENT_LABELS: Record<string, string> = {
  created: "Consulta criada",
  confirmation_sent: "Pedido de confirmação enviado",
  nudge_sent: "Lembrete de confirmação enviado",
  confirmed: "Paciente confirmou",
  cancelled: "Consulta cancelada",
  rescheduled: "Consulta remarcada",
  completed: "Consulta realizada",
  no_show: "Paciente faltou",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  function load() {
    if (!id) return;
    api
      .get<HistoryResponse>(`/patients/${id}/history`)
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id]);

  async function toggleDoNotContact() {
    if (!data) return;
    setSavingContact(true);
    try {
      await api.patch(`/patients/${id}`, { do_not_contact: !data.patient.do_not_contact });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingContact(false);
    }
  }

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const { patient, schedules, events } = data;

  return (
    <div>
      <button className="mobile-icon-btn" style={{ marginBottom: 10, marginLeft: -8 }} onClick={() => navigate("/pacientes")}>
        <ArrowLeftIcon />
      </button>

      <h1 className="page-title">{patient.name || "Contato sem nome"}</h1>
      <p className="page-subtitle">
        {patient.phone}
        {patient.email ? ` · ${patient.email}` : ""} · paciente desde {new Date(patient.created_at).toLocaleDateString("pt-BR")}
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 18 }}>
        <input type="checkbox" checked={patient.do_not_contact} disabled={savingContact} onChange={toggleDoNotContact} />
        Não enviar mensagens de reativação/marketing para este paciente
      </label>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>Agendamentos</div>
          {schedules.length === 0 && <div className="empty-state">Nenhum agendamento ainda.</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {schedules.map((s) => {
              const display = getDisplayStatus(s);
              return (
                <div key={s.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.procedure}</span>
                    <span className={`badge ${display.cls}`}>{display.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {new Date(`${s.date}T00:00:00`).toLocaleDateString("pt-BR")} às {s.time.slice(0, 5)}
                    {s.confirmed_at ? ` · confirmado em ${formatDateTime(s.confirmed_at)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>Histórico</div>
          {events.length === 0 && <div className="empty-state">Nenhum evento registrado ainda.</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ padding: "10px 0", borderTop: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{EVENT_LABELS[ev.event_type] || ev.event_type}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {ev.schedule_procedure} — {new Date(`${ev.schedule_date}T00:00:00`).toLocaleDateString("pt-BR")} {ev.schedule_time?.slice(0, 5)}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{formatDateTime(ev.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
