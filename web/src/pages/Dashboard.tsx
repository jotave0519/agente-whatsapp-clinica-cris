import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { ArrowRightIcon, TrendingUpIcon } from "../components/icons";
import { NewAppointmentFab } from "../components/NewAppointmentFab";
import { RevenueChart } from "../components/RevenueChart";

interface DashboardData {
  kpis: { activePatients: number; appointmentsThisMonth: number; revenueThisMonth: number; conversationsWaiting: number };
  revenueChart: { label: string; value: number }[];
  todayAppointments: { id: string; patient_name: string; procedure: string; time: string; status: string }[];
  recentConversations: { id: string; userName: string | null; userPhone: string; lastMessage: string | null; status: string }[];
}

interface FinanceOverview {
  kpis: { receita: number; despesa: number; lucro: number; pendentes: number };
}

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatMoneyShort(v: number): string {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return formatMoney(v);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function Dashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [data, setData] = useState<DashboardData | null>(null);
  const [finance, setFinance] = useState<FinanceOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
    api
      .get<FinanceOverview>("/finance")
      .then(setFinance)
      .catch(() => {});
  }, []);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const name = session?.user.email?.split("@")[0] || "";
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const chartData = isMobile ? data.revenueChart.slice(-6) : data.revenueChart;

  const kpiCards = [
    { label: "Pacientes ativos", value: String(data.kpis.activePatients) },
    { label: "Agendamentos (mês)", value: String(data.kpis.appointmentsThisMonth) },
    { label: "Faturamento (mês)", value: formatMoneyShort(data.kpis.revenueThisMonth) },
    { label: "Conversas aguardando", value: String(data.kpis.conversationsWaiting) },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--text-faint)", letterSpacing: ".04em", marginBottom: 6, textTransform: "capitalize" }}>{today}</div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: isMobile ? 26 : 34, fontWeight: 400, letterSpacing: "-.01em" }}>
            {greeting()}, <span style={{ fontStyle: "italic" }}>{name}</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 9 }}>
            Você tem <strong style={{ color: "var(--text)", fontWeight: 600 }}>{data.todayAppointments.length} atendimento(s)</strong> hoje e{" "}
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>{data.kpis.conversationsWaiting} conversa(s)</strong> aguardando retorno.
          </p>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {kpiCards.map((k) => (
          <div key={k.label} className="card">
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label" style={{ marginTop: 6, marginBottom: 0 }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.55fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>Faturamento</div>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>Últimos 12 meses</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 16px" }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.02em" }}>{formatMoney(data.kpis.revenueThisMonth)}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600, color: "var(--green)" }}>
              <TrendingUpIcon width={13} height={13} />
              este mês
            </span>
          </div>
          <RevenueChart data={chartData} />
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Agenda de hoje</div>
            <button style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }} onClick={() => navigate("/agenda")}>
              Ver agenda
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data.todayAppointments.length === 0 && <div className="empty-state">Nenhum agendamento para hoje.</div>}
            {data.todayAppointments.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 13, padding: "9px 6px", alignItems: "center" }}>
                <div style={{ textAlign: "right", width: 46, flex: "0 0 46px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.time}</div>
                </div>
                <div style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: "var(--accent)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.patient_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.procedure}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Conversas recentes</div>
            <button style={{ fontSize: 12.5, fontWeight: 500, color: "var(--accent)" }} onClick={() => navigate("/conversas")}>
              Abrir inbox
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.recentConversations.length === 0 && <div className="empty-state">Nenhuma conversa ainda.</div>}
            {data.recentConversations.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 12, padding: "11px 4px", alignItems: "center", borderTop: "1px solid var(--border-soft)" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: "var(--accent-bg)",
                    color: "var(--accent-dark)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 600,
                    flex: "0 0 38px",
                  }}
                >
                  {(c.userName || c.userPhone).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.userName || c.userPhone}</span>
                    <span className={`badge ${c.status === "human" ? "badge-blue" : c.status === "closed" ? "badge-neutral" : "badge-green"}`}>
                      {c.status === "human" ? "Humano" : c.status === "closed" ? "Encerrado" : "IA"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
                    {c.lastMessage || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "linear-gradient(160deg,#2A2521,#3A322C)", border: "1px solid #3A322C", borderRadius: 16, padding: 22, color: "#F3ECE4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Resumo financeiro</div>
          </div>
          {finance ? (
            <>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "#E4DACF" }}>
                A clínica registra <strong style={{ color: "#fff" }}>{formatMoney(finance.kpis.receita)}</strong> de faturamento e{" "}
                <strong style={{ color: "#fff" }}>{formatMoney(finance.kpis.lucro)}</strong> de lucro líquido no mês.{" "}
                {finance.kpis.pendentes > 0 && (
                  <>
                    Há <strong style={{ color: "#E9B7AE" }}>{formatMoney(finance.kpis.pendentes)}</strong> em contas a receber.
                  </>
                )}
              </p>
              <div style={{ display: "flex", gap: 20, marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.1)" }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{formatMoneyShort(finance.kpis.receita)}</div>
                  <div style={{ fontSize: 11.5, color: "#B7ABA0", marginTop: 2 }}>Faturamento</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{formatMoneyShort(finance.kpis.despesa)}</div>
                  <div style={{ fontSize: 11.5, color: "#B7ABA0", marginTop: 2 }}>Despesas</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{formatMoneyShort(finance.kpis.lucro)}</div>
                  <div style={{ fontSize: 11.5, color: "#B7ABA0", marginTop: 2 }}>Lucro</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: "#C7BBAF", fontSize: 13 }}>Carregando...</div>
          )}
          <button
            onClick={() => navigate("/financeiro")}
            style={{
              marginTop: 18,
              width: "100%",
              height: 38,
              borderRadius: 11,
              background: "rgba(255,255,255,.1)",
              color: "#F3ECE4",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
            }}
          >
            Abrir financeiro <ArrowRightIcon width={15} height={15} />
          </button>
        </div>
      </div>
      <NewAppointmentFab />
    </div>
  );
}
