import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "../components/icons";
import { PhotoCompare, PatientMediaItem } from "../components/PhotoCompare";
import { Timeline, TimelineItem } from "../components/Timeline";
import { api } from "../lib/api";
import { uploadPatientDocument, uploadPatientMedia, getSignedDocumentUrl } from "../lib/patientMediaUpload";
import { getDisplayStatus } from "../lib/scheduleStatus";

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
  notes: string | null;
  staff_id: string | null;
}

interface Summary {
  firstVisit: string | null;
  lastVisit: string | null;
  nextAppointment: { id: string; date: string; time: string; procedure: string } | null;
  totalVisits: number;
  totalInvested: number;
  mostFrequentProcedure: string | null;
  averageReturnDays: number | null;
  status: "Ativo" | "Em acompanhamento" | "Inativo";
}

interface Suggestion {
  procedure: string;
  lastDate: string;
  daysSince: number;
  message: string;
}

interface PatientNote {
  id: string;
  body: string;
  created_at: string;
}

interface PatientGoal {
  id: string;
  description: string;
  status: "ativo" | "concluido";
  created_at: string;
}

interface PatientDocument {
  id: string;
  name: string;
  category: string | null;
  storage_path: string;
  created_at: string;
}

interface StaffOption {
  id: string;
  name: string;
}

interface PatientTransaction {
  id: string;
  description: string;
  amount: number;
  method: string | null;
  status: "pago" | "pendente";
  occurred_on: string;
  procedure_id: string | null;
  procedureName: string | null;
}

interface TreatmentTypeOption {
  id: string;
  name: string;
}

const PAYMENT_METHODS = ["Pix", "Cartão crédito", "Cartão débito", "Dinheiro", "Transferência", "Outro"];

const EMPTY_PAYMENT_DRAFT = {
  amount: "",
  method: "Pix",
  status: "pago" as "pago" | "pendente",
  occurred_on: new Date().toLocaleDateString("en-CA"),
  procedureId: "",
  observacoes: "",
};

const STATUS_BADGE: Record<string, string> = { Ativo: "badge-green", "Em acompanhamento": "badge-blue", Inativo: "badge-neutral" };

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

const TABS = [
  { id: "geral", label: "Visão Geral" },
  { id: "procedimentos", label: "Procedimentos" },
  { id: "agendamentos", label: "Agendamentos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "notas", label: "Notas & Objetivos" },
  { id: "documentos", label: "Documentos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [goals, setGoals] = useState<PatientGoal[]>([]);
  const [media, setMedia] = useState<PatientMediaItem[]>([]);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [transactions, setTransactions] = useState<PatientTransaction[]>([]);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentTypeOption[]>([]);

  const [tab, setTab] = useState<TabId>("geral");
  const [error, setError] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [eventDraft, setEventDraft] = useState({ title: "", detail: "" });
  const [showEventForm, setShowEventForm] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState(EMPTY_PAYMENT_DRAFT);
  const [savingPayment, setSavingPayment] = useState(false);

  function load() {
    if (!id) return;
    api.get<{ patient: Patient; schedules: ScheduleItem[] }>(`/patients/${id}/history`).then((r) => {
      setPatient(r.patient);
      setSchedules(r.schedules);
    }).catch((e) => setError(e.message));
    api.get<Summary>(`/patients/${id}/summary`).then(setSummary).catch(() => {});
    api.get<{ items: Suggestion[] }>(`/patients/${id}/suggestions`).then((r) => setSuggestions(r.items)).catch(() => {});
    api.get<{ items: TimelineItem[] }>(`/patients/${id}/timeline`).then((r) => setTimeline(r.items)).catch(() => {});
    api.get<{ items: PatientNote[] }>(`/patients/${id}/notes`).then((r) => setNotes(r.items)).catch(() => {});
    api.get<{ items: PatientGoal[] }>(`/patients/${id}/goals`).then((r) => setGoals(r.items)).catch(() => {});
    api.get<{ items: PatientMediaItem[] }>(`/patients/${id}/media`).then((r) => setMedia(r.items)).catch(() => {});
    api.get<{ items: PatientDocument[] }>(`/patients/${id}/documents`).then((r) => setDocuments(r.items)).catch(() => {});
    api.get<{ items: StaffOption[] }>("/staff").then((r) => setStaffOptions(r.items)).catch(() => {});
    api.get<{ items: PatientTransaction[] }>(`/patients/${id}/transactions`).then((r) => setTransactions(r.items)).catch(() => {});
    api.get<{ items: TreatmentTypeOption[] }>("/procedures").then((r) => setTreatmentTypes(r.items)).catch(() => {});
  }

  useEffect(load, [id]);

  const lastPayment = [...transactions].filter((t) => t.status === "pago").sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))[0] || null;

  function openPaymentForm() {
    setEditingTransactionId(null);
    setPaymentDraft(EMPTY_PAYMENT_DRAFT);
    setShowPaymentForm(true);
  }

  function startEditPayment(t: PatientTransaction) {
    setEditingTransactionId(t.id);
    setPaymentDraft({
      amount: String(t.amount),
      method: t.method || "Pix",
      status: t.status,
      occurred_on: t.occurred_on,
      procedureId: t.procedure_id || "",
      observacoes: "",
    });
    setShowPaymentForm(true);
  }

  async function handleSavePayment(e: FormEvent) {
    e.preventDefault();
    if (!id || !paymentDraft.amount) return;
    setSavingPayment(true);
    setError(null);
    try {
      const procedureName = treatmentTypes.find((t) => t.id === paymentDraft.procedureId)?.name;
      const description = [procedureName || "Pagamento", paymentDraft.observacoes.trim()].filter(Boolean).join(" — ");
      const payload = {
        amount: Number(paymentDraft.amount),
        method: paymentDraft.method,
        status: paymentDraft.status,
        occurred_on: paymentDraft.occurred_on,
        description,
      };
      if (editingTransactionId) {
        await api.patch(`/finance/transactions/${editingTransactionId}`, payload);
      } else {
        await api.post("/finance/transactions", { ...payload, type: "receita", patient_id: id, procedure_id: paymentDraft.procedureId || null });
      }
      setShowPaymentForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDeletePayment(transactionId: string) {
    if (!window.confirm("Excluir este pagamento?")) return;
    try {
      await api.delete(`/finance/transactions/${transactionId}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleDoNotContact() {
    if (!patient) return;
    setSavingContact(true);
    try {
      await api.patch(`/patients/${patient.id}`, { do_not_contact: !patient.do_not_contact });
      setPatient({ ...patient, do_not_contact: !patient.do_not_contact });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingContact(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!noteDraft.trim() || !id) return;
    try {
      await api.post(`/patients/${id}/notes`, { body: noteDraft });
      setNoteDraft("");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!id) return;
    await api.delete(`/patients/${id}/notes/${noteId}`);
    load();
  }

  async function handleAddGoal(e: FormEvent) {
    e.preventDefault();
    if (!goalDraft.trim() || !id) return;
    try {
      await api.post(`/patients/${id}/goals`, { description: goalDraft });
      setGoalDraft("");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleGoal(goal: PatientGoal) {
    if (!id) return;
    await api.patch(`/patients/${id}/goals/${goal.id}`, { status: goal.status === "ativo" ? "concluido" : "ativo" });
    load();
  }

  async function handleDeleteGoal(goalId: string) {
    if (!id) return;
    await api.delete(`/patients/${id}/goals/${goalId}`);
    load();
  }

  async function handleAddEvent(e: FormEvent) {
    e.preventDefault();
    if (!eventDraft.title.trim() || !id) return;
    try {
      await api.post(`/patients/${id}/timeline-events`, eventDraft);
      setEventDraft({ title: "", detail: "" });
      setShowEventForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleUploadMedia(file: File, kind: "antes" | "depois", scheduleId?: string) {
    if (!id) return;
    setUploadingMedia(true);
    try {
      const path = await uploadPatientMedia(id, file);
      await api.post(`/patients/${id}/media`, { kind, storagePath: path, scheduleId: scheduleId ?? null });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    if (!id) return;
    await api.delete(`/patients/${id}/media/${mediaId}`);
    load();
  }

  async function handleUploadDocument(file: File) {
    if (!id) return;
    setUploadingDoc(true);
    try {
      const path = await uploadPatientDocument(id, file);
      await api.post(`/patients/${id}/documents`, { name: file.name, storagePath: path });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleDeleteDocument(docId: string) {
    if (!id) return;
    await api.delete(`/patients/${id}/documents/${docId}`);
    load();
  }

  async function openDocument(doc: PatientDocument) {
    try {
      const url = await getSignedDocumentUrl(doc.storage_path);
      window.open(url, "_blank");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function assignStaff(scheduleId: string, staffId: string) {
    await api.patch(`/schedules/${scheduleId}/staff`, { staffId: staffId || null });
    load();
  }

  if (error && !patient) return <div className="empty-state">{error}</div>;
  if (!patient) return <div className="empty-state">Carregando...</div>;

  const completedSchedules = schedules.filter((s) => s.status === "Concluido").sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const ticketMedio = summary && summary.totalVisits > 0 ? summary.totalInvested / summary.totalVisits : 0;

  return (
    <div>
      <button className="mobile-icon-btn" style={{ marginBottom: 10, marginLeft: -8 }} onClick={() => navigate("/pacientes")}>
        <ArrowLeftIcon />
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="page-title">{patient.name || "Contato sem nome"}</h1>
            {summary && <span className={`badge ${STATUS_BADGE[summary.status]}`}>{summary.status}</span>}
          </div>
          <p className="page-subtitle" style={{ marginBottom: 8 }}>
            {patient.phone}
            {patient.email ? ` · ${patient.email}` : ""} · paciente desde {new Date(patient.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
          <input type="checkbox" checked={patient.do_not_contact} disabled={savingContact} onChange={toggleDoNotContact} />
          Não enviar mensagens de reativação/marketing
        </label>
      </div>

      {error && <div className="error-text">{error}</div>}

      {summary && (
        <div className="kpi-grid" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="kpi-value" style={{ fontSize: 18 }}>{formatDate(summary.firstVisit)}</div>
            <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Primeira consulta</div>
          </div>
          <div className="card">
            <div className="kpi-value" style={{ fontSize: 18 }}>{formatDate(summary.lastVisit)}</div>
            <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Última consulta</div>
          </div>
          <div className="card">
            <div className="kpi-value">{summary.totalVisits}</div>
            <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Procedimentos realizados</div>
          </div>
          <div className="card">
            <div className="kpi-value" style={{ fontSize: 18 }}>{formatMoney(summary.totalInvested)}</div>
            <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Total investido</div>
          </div>
          <div className="card">
            <div className="kpi-value" style={{ fontSize: 15 }}>{summary.mostFrequentProcedure || "—"}</div>
            <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Procedimento mais realizado</div>
          </div>
          <div className="card">
            <div className="kpi-value" style={{ fontSize: 18 }}>{summary.averageReturnDays ? `${summary.averageReturnDays} dias` : "—"}</div>
            <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Frequência média de retorno</div>
          </div>
        </div>
      )}

      <div className="tab-nav">
        {TABS.map((t) => (
          <span key={t.id} className={`tab-nav-item${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </span>
        ))}
      </div>

      {tab === "geral" && (
        <div>
          {suggestions.length > 0 && (
            <div className="card" style={{ marginBottom: 20, background: "var(--accent-bg)", border: "none" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--accent-dark)", marginBottom: 8 }}>Próximos tratamentos sugeridos</div>
              {suggestions.map((s, i) => (
                <div key={i} style={{ fontSize: 12.5, color: "var(--accent-dark)", marginTop: 4 }}>
                  • {s.message}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Timeline</div>
            <button className="btn btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={() => setShowEventForm(!showEventForm)}>
              + Adicionar evento
            </button>
          </div>

          {showEventForm && (
            <form onSubmit={handleAddEvent} className="card" style={{ marginBottom: 16, display: "grid", gap: 10 }}>
              <input className="input" placeholder="Título do evento" required value={eventDraft.title} onChange={(e) => setEventDraft({ ...eventDraft, title: e.target.value })} />
              <input className="input" placeholder="Detalhes (opcional)" value={eventDraft.detail} onChange={(e) => setEventDraft({ ...eventDraft, detail: e.target.value })} />
              <button className="btn" type="submit" style={{ width: "fit-content" }}>
                Salvar evento
              </button>
            </form>
          )}

          <div className="card">
            <Timeline items={timeline} />
          </div>
        </div>
      )}

      {tab === "procedimentos" && (
        <div>
          {completedSchedules.length === 0 && <div className="empty-state">Nenhum procedimento realizado ainda.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {completedSchedules.map((s) => (
              <div key={s.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.procedure}</div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDate(s.date)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Profissional:</span>
                  <select className="input" style={{ maxWidth: 200, padding: "5px 8px" }} value={s.staff_id || ""} onChange={(e) => assignStaff(s.id, e.target.value)}>
                    <option value="">Não informado</option>
                    {staffOptions.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
                {s.notes && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>{s.notes}</div>}

                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Fotos antes/depois</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <label className="btn btn-secondary" style={{ height: 30, fontSize: 11, cursor: "pointer" }}>
                        + Antes
                        <input type="file" accept="image/*" hidden disabled={uploadingMedia} onChange={(e) => e.target.files?.[0] && handleUploadMedia(e.target.files[0], "antes", s.id)} />
                      </label>
                      <label className="btn btn-secondary" style={{ height: 30, fontSize: 11, cursor: "pointer" }}>
                        + Depois
                        <input type="file" accept="image/*" hidden disabled={uploadingMedia} onChange={(e) => e.target.files?.[0] && handleUploadMedia(e.target.files[0], "depois", s.id)} />
                      </label>
                    </div>
                  </div>
                  <PhotoCompare items={media.filter((m) => m.schedule_id === s.id)} onDelete={handleDeleteMedia} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "agendamentos" && (
        <div className="card" style={{ padding: 0 }}>
          {schedules.length === 0 && <div className="empty-state">Nenhum agendamento ainda.</div>}
          {schedules
            .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
            .map((s) => {
              const display = getDisplayStatus(s);
              return (
                <div key={s.id} style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.procedure}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {formatDate(s.date)} às {s.time.slice(0, 5)}
                      {s.confirmed_at ? ` · confirmado em ${new Date(s.confirmed_at).toLocaleDateString("pt-BR")}` : ""}
                    </div>
                  </div>
                  <span className={`badge ${display.cls}`}>{display.label}</span>
                </div>
              );
            })}
        </div>
      )}

      {tab === "financeiro" && (
        <div>
          <div className="kpi-grid">
            <div className="card">
              <div className="kpi-value">{summary ? formatMoney(summary.totalInvested) : "—"}</div>
              <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Total gasto</div>
            </div>
            <div className="card">
              <div className="kpi-value">{formatMoney(ticketMedio)}</div>
              <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Ticket médio</div>
            </div>
            <div className="card">
              <div className="kpi-value" style={{ fontSize: 18 }}>{lastPayment ? formatDate(lastPayment.occurred_on) : "—"}</div>
              <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Último pagamento</div>
            </div>
            <div className="card">
              <div className="kpi-value" style={{ fontSize: 15 }}>Nenhum pacote ativo</div>
              <div className="kpi-label" style={{ marginTop: 4, marginBottom: 0 }}>Pacote ativo</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Pagamentos</div>
            <button className="btn" style={{ height: 34, fontSize: 12.5 }} onClick={openPaymentForm}>
              + Registrar pagamento
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            {transactions.length === 0 && <div className="empty-state">Nenhum pagamento registrado ainda.</div>}
            {transactions
              .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
              .map((t) => (
                <div key={t.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{formatMoney(t.amount)}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {formatDate(t.occurred_on)} · {t.method || "—"}
                      {t.procedureName ? ` · ${t.procedureName}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`badge ${t.status === "pago" ? "badge-green" : "badge-yellow"}`}>{t.status === "pago" ? "Pago" : "Pendente"}</span>
                    <button className="btn btn-secondary" style={{ height: 30, padding: "0 10px", fontSize: 11.5 }} onClick={() => startEditPayment(t)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ height: 30, padding: "0 10px", fontSize: 11.5 }} onClick={() => handleDeletePayment(t.id)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {showPaymentForm && (
        <div className="modal-overlay" onClick={() => setShowPaymentForm(false)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{editingTransactionId ? "Editar pagamento" : "Registrar pagamento"}</div>
            <form onSubmit={handleSavePayment} style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="field-label">Valor (R$)</label>
                <input className="input" type="number" step="0.01" required value={paymentDraft.amount} onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Forma de pagamento</label>
                <select className="input" value={paymentDraft.method} onChange={(e) => setPaymentDraft({ ...paymentDraft, method: e.target.value })}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="input" value={paymentDraft.status} onChange={(e) => setPaymentDraft({ ...paymentDraft, status: e.target.value as "pago" | "pendente" })}>
                  <option value="pago">Pago</option>
                  <option value="pendente">Pendente</option>
                </select>
              </div>
              <div>
                <label className="field-label">Data</label>
                <input className="input" type="date" required value={paymentDraft.occurred_on} onChange={(e) => setPaymentDraft({ ...paymentDraft, occurred_on: e.target.value })} />
              </div>
              {!editingTransactionId && (
                <div>
                  <label className="field-label">Procedimento relacionado (opcional)</label>
                  <select className="input" value={paymentDraft.procedureId} onChange={(e) => setPaymentDraft({ ...paymentDraft, procedureId: e.target.value })}>
                    <option value="">Nenhum</option>
                    {treatmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="field-label">Observações (opcional)</label>
                <input className="input" value={paymentDraft.observacoes} onChange={(e) => setPaymentDraft({ ...paymentDraft, observacoes: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" type="submit" disabled={savingPayment}>
                  {savingPayment ? "Salvando..." : "Salvar"}
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setShowPaymentForm(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === "notas" && (
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Observações clínicas</div>
          <form onSubmit={handleAddNote} className="card" style={{ marginBottom: 16, display: "grid", gap: 10 }}>
            <textarea className="input" rows={2} placeholder="Alergias, sensibilidade, preferências, cuidados pós-procedimento..." value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
            <button className="btn" type="submit" style={{ width: "fit-content" }}>
              Adicionar
            </button>
          </form>
          <div className="card" style={{ padding: 0, marginBottom: 24 }}>
            {notes.length === 0 && <div className="empty-state">Nenhuma observação registrada.</div>}
            {notes.map((n) => (
              <div key={n.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13 }}>{n.body}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <button className="btn-danger" style={{ height: 28, padding: "0 10px", fontSize: 11, flexShrink: 0 }} onClick={() => handleDeleteNote(n.id)}>
                  Excluir
                </button>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10 }}>Objetivos da paciente</div>
          <form onSubmit={handleAddGoal} className="card" style={{ marginBottom: 16, display: "flex", gap: 10 }}>
            <input className="input" placeholder="Ex: Harmonização facial, Botox, melhora da qualidade da pele..." value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} />
            <button className="btn" type="submit" style={{ flexShrink: 0 }}>
              Adicionar
            </button>
          </form>
          <div className="card" style={{ padding: 0 }}>
            {goals.length === 0 && <div className="empty-state">Nenhum objetivo registrado.</div>}
            {goals.map((g) => (
              <div key={g.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={g.status === "concluido"} onChange={() => toggleGoal(g)} />
                <div style={{ flex: 1, fontSize: 13, textDecoration: g.status === "concluido" ? "line-through" : "none", color: g.status === "concluido" ? "var(--text-faint)" : "var(--text)" }}>{g.description}</div>
                <button className="btn-danger" style={{ height: 28, padding: "0 10px", fontSize: 11 }} onClick={() => handleDeleteGoal(g.id)}>
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "documentos" && (
        <div>
          <label className="btn" style={{ width: "fit-content", cursor: "pointer", marginBottom: 16 }}>
            {uploadingDoc ? "Enviando..." : "+ Adicionar documento"}
            <input type="file" hidden disabled={uploadingDoc} onChange={(e) => e.target.files?.[0] && handleUploadDocument(e.target.files[0])} />
          </label>
          <div className="card" style={{ padding: 0 }}>
            {documents.length === 0 && <div className="empty-state">Nenhum documento anexado.</div>}
            {documents.map((d) => (
              <div key={d.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ cursor: "pointer" }} onClick={() => openDocument(d)}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{new Date(d.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <button className="btn-danger" style={{ height: 28, padding: "0 10px", fontSize: 11, flexShrink: 0 }} onClick={() => handleDeleteDocument(d.id)}>
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
