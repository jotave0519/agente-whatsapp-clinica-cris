import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface DashboardData {
  kpis: { activePatients: number; appointmentsThisMonth: number };
  todayAppointments: { id: string; patient_name: string; procedure: string; time: string; status: string }[];
  recentConversations: { id: string; userName: string | null; userPhone: string; lastMessage: string | null; status: string }[];
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Visão geral da clínica</p>

      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Pacientes ativos</div>
          <div className="kpi-value">{data.kpis.activePatients}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Agendamentos (mês)</div>
          <div className="kpi-value">{data.kpis.appointmentsThisMonth}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Agendamentos de hoje</h2>
          {data.todayAppointments.length === 0 && <div className="empty-state">Nenhum agendamento para hoje.</div>}
          {data.todayAppointments.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a.patient_name}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{a.procedure}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.time}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Conversas recentes</h2>
          {data.recentConversations.length === 0 && <div className="empty-state">Nenhuma conversa ainda.</div>}
          {data.recentConversations.map((c) => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.userName || c.userPhone}</span>
                <span className={`badge ${c.status === "human" ? "badge-blue" : c.status === "closed" ? "badge-neutral" : "badge-green"}`}>
                  {c.status === "human" ? "Humano" : c.status === "closed" ? "Encerrado" : "IA"}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{c.lastMessage || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
