import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

type Stage =
  | "new_interest"
  | "evaluation_scheduled"
  | "evaluation_done"
  | "awaiting_decision"
  | "follow_up_active"
  | "procedure_scheduled"
  | "converted"
  | "lost";

type Signal =
  | "price_question"
  | "general_interest"
  | "abandoned_scheduling"
  | "post_evaluation_no_procedure"
  | "will_think"
  | "no_money"
  | "traveling"
  | "needs_to_talk"
  | "come_back_later"
  | "other";

interface Opportunity {
  id: string;
  user_id: string;
  procedure_interest: string;
  stage: Stage;
  source_signal: Signal;
  signal_note: string | null;
  paused: boolean;
  first_contact_at: string;
  evaluation_at: string | null;
  last_message_sent_at: string | null;
  last_message_body: string | null;
  last_response_at: string | null;
  last_response_body: string | null;
  attempts_used: number;
  estimated_value: number | null;
  patientName: string;
  patientPhone: string;
  conversationId: string | null;
  conversationStatus: "ai" | "human" | "closed" | null;
}

interface CommercialEvent {
  id: string;
  event_type: string;
  detail: string | null;
  created_at: string;
  patientName: string;
  procedureInterest: string;
}

const STAGES: { key: Stage; label: string }[] = [
  { key: "new_interest", label: "Novo interesse" },
  { key: "evaluation_scheduled", label: "Avaliação agendada" },
  { key: "evaluation_done", label: "Avaliação realizada" },
  { key: "awaiting_decision", label: "Aguardando decisão" },
  { key: "follow_up_active", label: "Follow-up em andamento" },
  { key: "procedure_scheduled", label: "Procedimento agendado" },
  { key: "converted", label: "Convertido" },
  { key: "lost", label: "Perdido" },
];

const SIGNAL_LABELS: Record<Signal, string> = {
  price_question: "Perguntou preço",
  general_interest: "Interesse geral",
  abandoned_scheduling: "Abandonou agendamento",
  post_evaluation_no_procedure: "Avaliação sem retorno",
  will_think: "Vai pensar",
  no_money: "Sem dinheiro no momento",
  traveling: "Vai viajar",
  needs_to_talk: "Precisa conversar",
  come_back_later: "Volta depois",
  other: "Outro",
};

const EVENT_LABELS: Record<string, string> = {
  created: "Oportunidade criada",
  signal_detected: "Novo sinal detectado",
  stage_changed: "Mudou de etapa",
  message_sent: "Mensagem de follow-up enviada",
  responded: "Paciente respondeu",
  moved_manually: "Ajustado manualmente",
  schedule_cancelled_or_noshow: "Agendamento cancelado/faltou",
  converted: "Convertido",
  lost: "Perdido",
  escalated_human: "Encaminhado a humano",
};

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (24 * 3600_000));
  if (days >= 1) return `há ${days} dia${days === 1 ? "" : "s"}`;
  const hours = Math.floor(diffMs / 3600_000);
  if (hours >= 1) return `há ${hours}h`;
  return "agora há pouco";
}

export function Oportunidades() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"kanban" | "historico">("kanban");

  const [items, setItems] = useState<Opportunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileStage, setMobileStage] = useState<Stage>("new_interest");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [events, setEvents] = useState<CommercialEvent[] | null>(null);

  function loadOpportunities() {
    api
      .get<{ items: Opportunity[] }>("/commercial-opportunities")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }

  function loadEvents() {
    api
      .get<{ items: CommercialEvent[] }>("/commercial-events?limit=80")
      .then((r) => setEvents(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadOpportunities();
  }, []);

  useEffect(() => {
    if (tab === "historico" && events === null) loadEvents();
  }, [tab]);

  async function handleMove(opp: Opportunity, stage: Stage) {
    setOpenMenuId(null);
    try {
      await api.patch(`/commercial-opportunities/${opp.id}/stage`, { stage });
      loadOpportunities();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handlePauseToggle(opp: Opportunity) {
    setOpenMenuId(null);
    try {
      await api.patch(`/commercial-opportunities/${opp.id}/pause`, { paused: !opp.paused });
      loadOpportunities();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleOpenConversation(opp: Opportunity) {
    setOpenMenuId(null);
    if (opp.conversationId) navigate(`/conversas?open=${opp.conversationId}`);
  }

  const grouped = new Map<Stage, Opportunity[]>();
  for (const stage of STAGES) grouped.set(stage.key, []);
  for (const item of items || []) grouped.get(item.stage)?.push(item);

  function renderCard(opp: Opportunity) {
    return (
      <div key={opp.id} className="card" style={{ position: "relative", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <button style={{ fontSize: 13.5, fontWeight: 600, textAlign: "left" }} onClick={() => handleOpenConversation(opp)} disabled={!opp.conversationId}>
            {opp.patientName || opp.patientPhone || "Contato sem nome"}
          </button>
          <button className="mobile-icon-btn" style={{ width: 32, height: 32, flex: "0 0 32px" }} onClick={() => setOpenMenuId(openMenuId === opp.id ? null : opp.id)}>
            ⋮
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{opp.patientPhone}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 6 }}>{opp.procedure_interest}</div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          <span className="badge badge-blue">{SIGNAL_LABELS[opp.source_signal]}</span>
          {opp.conversationStatus === "human" && <span className="badge badge-neutral">Em atendimento humano</span>}
          {opp.paused && <span className="badge badge-yellow">Pausado</span>}
        </div>

        {opp.signal_note && (
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 8, fontStyle: "italic" }}>"{opp.signal_note.slice(0, 90)}"</div>
        )}

        <div style={{ display: "grid", gap: 2, marginTop: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          {opp.last_message_body && <div>Última mensagem: {timeAgo(opp.last_message_sent_at)}</div>}
          {opp.last_response_body && <div>Última resposta: {timeAgo(opp.last_response_at)}</div>}
          <div>
            Tentativas: {opp.attempts_used} · Contato inicial: {timeAgo(opp.first_contact_at)}
          </div>
          {opp.estimated_value != null && <div style={{ color: "var(--green)", fontWeight: 600 }}>{formatMoney(opp.estimated_value)}</div>}
        </div>

        {openMenuId === opp.id && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 10,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "var(--shadow-card)",
              zIndex: 5,
              minWidth: 200,
              overflow: "hidden",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            <button
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, color: opp.conversationId ? "var(--text)" : "var(--text-faint)" }}
              onClick={() => handleOpenConversation(opp)}
              disabled={!opp.conversationId}
            >
              Abrir conversa
            </button>
            <button style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", fontSize: 13, color: "var(--text)" }} onClick={() => handlePauseToggle(opp)}>
              {opp.paused ? "Retomar automação" : "Pausar automação"}
            </button>
            <div style={{ padding: "8px 14px 4px", fontSize: 11, color: "var(--text-faint)", borderTop: "1px solid var(--border-soft)" }}>Mover para:</div>
            {STAGES.filter((s) => s.key !== opp.stage).map((s) => (
              <button key={s.key} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 14px", fontSize: 13, color: "var(--text)" }} onClick={() => handleMove(opp, s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Oportunidades</h1>
      <p className="page-subtitle">Pacientes que demonstraram interesse mas ainda não fecharam</p>

      <div className="tab-nav">
        <button className={`tab-nav-item${tab === "kanban" ? " active" : ""}`} onClick={() => setTab("kanban")}>
          Kanban
        </button>
        <button className={`tab-nav-item${tab === "historico" ? " active" : ""}`} onClick={() => setTab("historico")}>
          Histórico
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {tab === "kanban" && (
        <>
          {items === null && <div className="empty-state">Carregando...</div>}
          {items !== null && items.length === 0 && <div className="empty-state">Nenhuma oportunidade no momento. A IA cria cards automaticamente conforme os pacientes conversam.</div>}

          {items !== null && items.length > 0 && !isMobile && (
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
              {STAGES.map((stage) => (
                <div key={stage.key} style={{ flex: "0 0 270px", width: 270 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 4px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{stage.label}</div>
                    <span className="badge badge-neutral">{grouped.get(stage.key)?.length ?? 0}</span>
                  </div>
                  <div>{(grouped.get(stage.key) || []).map(renderCard)}</div>
                </div>
              ))}
            </div>
          )}

          {items !== null && items.length > 0 && isMobile && (
            <>
              <div className="day-strip" style={{ padding: "2px 2px 14px" }}>
                {STAGES.map((stage) => (
                  <button
                    key={stage.key}
                    className={`chip${mobileStage === stage.key ? " active" : ""}`}
                    style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}
                    onClick={() => setMobileStage(stage.key)}
                  >
                    {stage.label} ({grouped.get(stage.key)?.length ?? 0})
                  </button>
                ))}
              </div>
              {(grouped.get(mobileStage) || []).length === 0 && <div className="empty-state">Nenhuma oportunidade nesta etapa.</div>}
              <div>{(grouped.get(mobileStage) || []).map(renderCard)}</div>
            </>
          )}
        </>
      )}

      {tab === "historico" && (
        <div>
          {events === null && <div className="empty-state">Carregando...</div>}
          {events !== null && events.length === 0 && <div className="empty-state">Nenhum evento registrado ainda.</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {events?.map((ev) => (
              <div key={ev.id} className="card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{EVENT_LABELS[ev.event_type] || ev.event_type}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {ev.patientName || "Paciente"} · {ev.procedureInterest}
                </div>
                {ev.detail && <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{ev.detail}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
