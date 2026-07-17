import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

type MessageType = "simple" | "question" | "review" | "reminder";
type DelayUnit = "hours" | "days";
type EnrollmentStatus = "active" | "completed" | "interrupted" | "transferred";

interface FlowMessage {
  delay_value: number;
  delay_unit: DelayUnit;
  message_type: MessageType;
  body: string;
}

interface Flow {
  id: string;
  name: string;
  procedure_match: string;
  active: boolean;
  messages: FlowMessage[];
}

interface Enrollment {
  id: string;
  patientName: string;
  procedure: string;
  flowName: string;
  status: EnrollmentStatus;
  started_at: string;
}

interface ProcedureOption {
  id: string;
  name: string;
}

const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  simple: "Mensagem simples",
  question: "Pergunta aberta",
  review: "Pedido de avaliação (Google)",
  reminder: "Lembrete de retorno",
};

const MESSAGE_TYPE_HELP: Record<MessageType, string> = {
  simple: "Instrução de estilo — a IA compõe o texto final com o histórico do paciente.",
  question: "Instrução de estilo para a pergunta — ex: perguntar como está se sentindo.",
  review: "Instrução de estilo para o convite — o link de avaliação é anexado automaticamente, não inclua links aqui.",
  reminder: "Instrução de estilo para o lembrete — só é enviado se o paciente ainda não tiver uma consulta futura marcada.",
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: "Em andamento",
  completed: "Concluído",
  interrupted: "Interrompido",
  transferred: "Transferido para equipe",
};

const STATUS_BADGE: Record<EnrollmentStatus, string> = {
  active: "badge-blue",
  completed: "badge-green",
  interrupted: "badge-neutral",
  transferred: "badge-red",
};

const EMPTY_MESSAGE: FlowMessage = { delay_value: 2, delay_unit: "hours", message_type: "question", body: "" };

const EMPTY_FORM = {
  name: "",
  procedure_match: "all",
  active: true,
  messages: [{ ...EMPTY_MESSAGE }] as FlowMessage[],
};

function delayLabel(m: FlowMessage): string {
  const unit = m.delay_unit === "hours" ? (m.delay_value === 1 ? "hora" : "horas") : m.delay_value === 1 ? "dia" : "dias";
  return `${m.delay_value} ${unit} após a consulta`;
}

export function PosAtendimento() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<"fluxos" | "historico">("fluxos");

  const [flows, setFlows] = useState<Flow[] | null>(null);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [enrollments, setEnrollments] = useState<{ items: Enrollment[]; total: number } | null>(null);

  function loadFlows() {
    api
      .get<{ items: Flow[] }>("/post-attendance-flows")
      .then((r) => setFlows(r.items))
      .catch((e) => setError(e.message));
  }

  function loadEnrollments() {
    api
      .get<{ items: Enrollment[]; total: number }>("/post-attendance-enrollments")
      .then(setEnrollments)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    loadFlows();
    api
      .get<{ items: ProcedureOption[] }>("/procedures")
      .then((r) => setProcedures(r.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "historico" && enrollments === null) loadEnrollments();
  }, [tab]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(f: Flow) {
    setEditingId(f.id);
    setForm({ name: f.name, procedure_match: f.procedure_match, active: f.active, messages: f.messages.length > 0 ? f.messages : [{ ...EMPTY_MESSAGE }] });
    setShowForm(true);
  }

  function updateMessage(index: number, patch: Partial<FlowMessage>) {
    setForm((f) => ({ ...f, messages: f.messages.map((m, i) => (i === index ? { ...m, ...patch } : m)) }));
  }

  function addMessage() {
    setForm((f) => ({ ...f, messages: [...f.messages, { ...EMPTY_MESSAGE, message_type: "simple" }] }));
  }

  function removeMessage(index: number) {
    setForm((f) => ({ ...f, messages: f.messages.filter((_, i) => i !== index) }));
  }

  function moveMessage(index: number, dir: -1 | 1) {
    setForm((f) => {
      const target = index + dir;
      if (target < 0 || target >= f.messages.length) return f;
      const messages = [...f.messages];
      [messages[index], messages[target]] = [messages[target], messages[index]];
      return { ...f, messages };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { name: form.name, procedure_match: form.procedure_match, active: form.active, messages: form.messages };
      if (editingId) {
        await api.patch(`/post-attendance-flows/${editingId}`, payload);
      } else {
        await api.post("/post-attendance-flows", payload);
      }
      setShowForm(false);
      loadFlows();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(f: Flow) {
    try {
      await api.patch(`/post-attendance-flows/${f.id}`, { active: !f.active });
      loadFlows();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(f: Flow) {
    if (!window.confirm(`Excluir o fluxo "${f.name}"? Pacientes já em acompanhamento por ele não serão mais contatados.`)) return;
    try {
      await api.delete(`/post-attendance-flows/${f.id}`);
      loadFlows();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 22 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.01em" }}>{editingId ? "Editar fluxo" : "Novo fluxo de pós-atendimento"}</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Defina a sequência de mensagens que a IA envia depois desse procedimento.</p>
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" }}>Nome do fluxo</label>
        <input className="input" required placeholder="Ex: Botox — acompanhamento" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: "block" }}>Procedimento associado</label>
        <select className="input" value={form.procedure_match} onChange={(e) => setForm({ ...form, procedure_match: e.target.value })}>
          <option value="all">Qualquer procedimento</option>
          {procedures.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Mensagens da sequência</div>
        <div style={{ display: "grid", gap: 10 }}>
          {form.messages.map((m, i) => (
            <div key={i} className="card" style={{ padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>Mensagem {i + 1}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" className="mobile-icon-btn" disabled={i === 0} onClick={() => moveMessage(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="mobile-icon-btn" disabled={i === form.messages.length - 1} onClick={() => moveMessage(i, 1)}>
                    ↓
                  </button>
                  <button type="button" className="mobile-icon-btn" onClick={() => removeMessage(i)} disabled={form.messages.length === 1}>
                    ✕
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 8 }}>
                <select className="input" value={m.message_type} onChange={(e) => updateMessage(i, { message_type: e.target.value as MessageType })}>
                  {Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  min={1}
                  style={{ width: isMobile ? "100%" : 80 }}
                  value={m.delay_value}
                  onChange={(e) => updateMessage(i, { delay_value: Math.max(1, Number(e.target.value)) })}
                />
                <select className="input" style={{ width: isMobile ? "100%" : 110 }} value={m.delay_unit} onChange={(e) => updateMessage(i, { delay_unit: e.target.value as DelayUnit })}>
                  <option value="hours">horas depois</option>
                  <option value="days">dias depois</option>
                </select>
              </div>

              <div>
                <textarea
                  className="input"
                  rows={2}
                  required
                  placeholder={MESSAGE_TYPE_HELP[m.message_type]}
                  value={m.body}
                  onChange={(e) => updateMessage(i, { body: e.target.value })}
                />
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{delayLabel(m)}</div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 10 }} onClick={addMessage}>
          + Adicionar mensagem
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Fluxo ativo
      </label>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Pós-atendimento</h1>
          <p className="page-subtitle">IA que acompanha o paciente automaticamente depois de cada consulta</p>
        </div>
        {tab === "fluxos" && (
          <button
            onClick={startCreate}
            style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500 }}
          >
            + Novo fluxo
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid var(--border-soft)" }}>
        {(["fluxos", "historico"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "9px 4px",
              marginRight: 18,
              fontSize: 13.5,
              fontWeight: 600,
              color: tab === t ? "var(--accent-dark)" : "var(--text-muted)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {t === "fluxos" ? "Fluxos" : "Histórico"}
          </button>
        ))}
      </div>

      {error && <div className="error-text">{error}</div>}

      {tab === "fluxos" && (
        <>
          {!isMobile && showForm && (
            <div className="card" style={{ marginBottom: 20, maxWidth: 640 }}>
              {formFields}
            </div>
          )}
          <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
            {formFields}
          </FormSheet>

          {flows === null && <div className="empty-state">Carregando...</div>}
          {flows !== null && flows.length === 0 && <div className="empty-state">Nenhum fluxo criado ainda. Crie um para começar a acompanhar seus pacientes automaticamente.</div>}

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
            {flows?.map((f) => (
              <div key={f.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600 }}>{f.name}</div>
                    <span className={`badge ${f.active ? "badge-green" : "badge-yellow"}`} style={{ marginTop: 6, display: "inline-block" }}>
                      {f.active ? "Ativo" : "Pausado"}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>{f.procedure_match === "all" ? "Qualquer procedimento" : f.procedure_match}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                  {f.messages.length} mensagem{f.messages.length === 1 ? "" : "s"} na sequência
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn btn-secondary" style={{ fontSize: 12.5, padding: "7px 12px" }} onClick={() => startEdit(f)}>
                    Editar
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12.5, padding: "7px 12px" }} onClick={() => togglePause(f)}>
                    {f.active ? "Pausar" : "Ativar"}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12.5, padding: "7px 12px", color: "var(--red)" }} onClick={() => handleDelete(f)}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "historico" && (
        <div>
          {enrollments === null && <div className="empty-state">Carregando...</div>}
          {enrollments !== null && enrollments.items.length === 0 && <div className="empty-state">Nenhum acompanhamento registrado ainda.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {enrollments?.items.map((en) => (
              <div key={en.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{en.patientName || "Paciente sem nome"}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                    {en.procedure} · fluxo "{en.flowName}"
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>Iniciado em {new Date(en.started_at).toLocaleString("pt-BR")}</div>
                </div>
                <span className={`badge ${STATUS_BADGE[en.status]}`}>{STATUS_LABELS[en.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
