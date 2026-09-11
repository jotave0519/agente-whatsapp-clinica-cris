import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormSheet } from "../components/FormSheet";
import { PatientPicker } from "../components/PatientPicker";
import { Skeleton, SkeletonKpiGrid } from "../components/Skeleton";
import { useToast } from "../context/ToastContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";

interface Transaction {
  id: string;
  type: "receita" | "despesa";
  description: string;
  category: string | null;
  amount: number;
  method: string | null;
  status: "pago" | "pendente";
  occurred_on: string;
  patient_id: string | null;
  patientName: string | null;
}

interface PatientOption {
  id: string;
  name: string;
  phone: string;
}

interface FinanceData {
  month: string;
  kpis: { receita: number; despesa: number; lucro: number; pendentes: number };
  chart: { label: string; in: number; out: number }[];
  receitas: Transaction[];
  despesas: Transaction[];
  reportProcs: { name: string; count: number }[];
  reportPatients: { name: string; visits: number }[];
}

interface DayClosingAppointment {
  id: string;
  patientName: string;
  procedure: string;
  time: string;
  status: string;
  patientId: string | null;
  amount: number | null;
  paymentStatus: "pago" | "pendente" | null;
  transactionId: string | null;
}

interface DayClosing {
  date: string;
  appointmentCount: number;
  invoiced: number;
  received: number;
  pending: number;
  appointments: DayClosingAppointment[];
}

const EMPTY_FORM = { type: "receita" as "receita" | "despesa", description: "", category: "", amount: "", method: "", status: "pago" as "pago" | "pendente" };

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Rotulo do seletor de mes - relativo (Mes atual/passado/Proximo mes) so
// pros 3 meses mais proximos do atual; qualquer outro mostra mes/ano.
function monthOffsetLabel(monthKey: string): string {
  const current = currentMonthKey();
  if (monthKey === current) return "Mês atual";
  const [cy, cm] = current.split("-").map(Number);
  const [y, m] = monthKey.split("-").map(Number);
  const diff = (y - cy) * 12 + (m - cm);
  if (diff === 1) return "Próximo mês";
  if (diff === -1) return "Mês passado";
  const raw = monthLabel(monthKey);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Aritmetica de dia sempre a partir de uma data-string (nunca de "new
// Date()" puro): evita o mesmo desvio de UTC ja corrigido na Agenda.
function shiftDayStr(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function dayLabel(dateStr: string): string {
  const today = todayStr();
  if (dateStr === today) return "Hoje";
  if (dateStr === shiftDayStr(today, -1)) return "Ontem";
  if (dateStr === shiftDayStr(today, -2)) return "Anteontem";
  if (dateStr === shiftDayStr(today, 1)) return "Amanhã";
  const raw = new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  return raw;
}

function fullDayLabel(dateStr: string): string {
  const raw = new Date(`${dateStr}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function Financeiro() {
  const showToast = useToast();
  const isMobile = useIsMobile();
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [linkedPatientName, setLinkedPatientName] = useState<string | null>(null);

  // Fechamento do dia (Financeiro <-> Agenda) - data selecionada, seu
  // fechamento, e (opcional) um segundo dia pra comparacao.
  const [closingDate, setClosingDate] = useState(todayStr);
  const [closing, setClosing] = useState<DayClosing | null>(null);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [valueFormFor, setValueFormFor] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [savingValue, setSavingValue] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareDate, setCompareDate] = useState<string | null>(null);
  const [compareClosing, setCompareClosing] = useState<DayClosing | null>(null);

  async function load() {
    try {
      const r = await api.get<FinanceData>(`/finance?month=${month}`);
      setData(r);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function loadClosing(date: string, setter: (d: DayClosing) => void) {
    const r = await api.get<DayClosing>(`/finance/day-closing?date=${date}`);
    setter(r);
  }

  useEffect(() => {
    loadClosing(closingDate, setClosing).catch((e: any) => setClosingError(e.message));
  }, [closingDate]);

  useEffect(() => {
    if (!compareDate) {
      setCompareClosing(null);
      return;
    }
    loadClosing(compareDate, setCompareClosing).catch(() => {});
  }, [compareDate]);

  async function togglePayment(appt: DayClosingAppointment) {
    if (!appt.transactionId) return;
    setPayingId(appt.id);
    try {
      const nextStatus = appt.paymentStatus === "pago" ? "pendente" : "pago";
      await api.patch(`/finance/transactions/${appt.transactionId}`, { status: nextStatus });
      await loadClosing(closingDate, setClosing);
      showToast("✓ Status de pagamento atualizado.");
    } catch (e: any) {
      setClosingError(e.message);
    } finally {
      setPayingId(null);
    }
  }

  async function saveNewValue(appt: DayClosingAppointment) {
    const amount = Number(newAmount);
    if (!amount || amount <= 0 || !closing) return;
    setSavingValue(true);
    try {
      await api.post("/finance/transactions", {
        type: "receita",
        description: appt.procedure,
        amount,
        status: "pendente",
        schedule_id: appt.id,
        patient_id: appt.patientId,
        occurred_on: closing.date,
      });
      setValueFormFor(null);
      setNewAmount("");
      await loadClosing(closingDate, setClosing);
      showToast("✓ Valor registrado.");
    } catch (e: any) {
      setClosingError(e.message);
    } finally {
      setSavingValue(false);
    }
  }

  function openForm(type: "receita" | "despesa") {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, type });
    setPatient(null);
    setLinkedPatientName(null);
    setShowForm(true);
  }

  function openEdit(t: Transaction) {
    setEditingId(t.id);
    setForm({
      type: t.type,
      description: t.description,
      category: t.category || "",
      amount: String(t.amount),
      method: t.method || "",
      status: t.status,
    });
    setPatient(null);
    setLinkedPatientName(t.patientName);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      type: form.type,
      description: form.description,
      category: form.category || null,
      amount: Number(form.amount),
      method: form.method || null,
      status: form.status,
    };
    // patient_id so e enviado na criacao de uma receita nova - editar nao
    // permite trocar o paciente vinculado (evita ambiguidade sobre o que
    // acontece com o vinculo original).
    if (!editingId && form.type === "receita") payload.patient_id = patient?.id ?? null;
    try {
      if (editingId) {
        await api.patch(`/finance/transactions/${editingId}`, payload);
      } else {
        await api.post("/finance/transactions", payload);
      }
      setShowForm(false);
      await load();
      showToast(form.type === "receita" ? "✓ Receita salva." : "✓ Despesa salva.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: Transaction) {
    if (!window.confirm(`Excluir "${t.description}"?`)) return;
    try {
      await api.delete(`/finance/transactions/${t.id}`);
      await load();
      showToast("✓ Lançamento excluído.");
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !data) return <div className="empty-state">{error}</div>;
  if (!data) {
    return (
      <div>
        <Skeleton className="skeleton-title" style={{ width: 180, height: 28, marginBottom: 22 }} />
        <SkeletonKpiGrid count={4} />
        <div className="card" style={{ marginTop: 20, marginBottom: 20, minHeight: 160 }}>
          <Skeleton className="skeleton-title" style={{ width: "35%" }} />
          <Skeleton style={{ height: 100, marginTop: 12 }} />
        </div>
      </div>
    );
  }

  const maxBar = Math.max(1, ...data.chart.flatMap((b) => [b.in, b.out]));

  const transactionFormFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: isMobile ? 16 : undefined }}>
        {editingId ? "Editar " : "Nova "}
        {form.type === "receita" ? "receita" : "despesa"}
      </div>
      <div>
        <label className="field-label">Descrição</label>
        <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Valor (R$)</label>
          <input className="input" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">{form.type === "receita" ? "Forma de pagamento" : "Categoria"}</label>
          <input
            className="input"
            value={form.type === "receita" ? form.method : form.category}
            onChange={(e) => setForm(form.type === "receita" ? { ...form, method: e.target.value } : { ...form, category: e.target.value })}
          />
        </div>
      </div>
      {form.type === "receita" && (
        <div>
          <label className="field-label">Status</label>
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "pago" | "pendente" })}>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </div>
      )}
      {form.type === "receita" && !editingId && (
        <div>
          <label className="field-label">Paciente (opcional)</label>
          <PatientPicker value={patient} onChange={setPatient} />
        </div>
      )}
      {form.type === "receita" && editingId && linkedPatientName && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Paciente vinculado: {linkedPatientName}</div>
      )}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle" style={{ textTransform: "capitalize" }}>
            {monthLabel(month)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: 3 }}>
            <button style={{ width: 32, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              <ChevronLeftIcon color="var(--text-muted)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 500, padding: "0 8px", cursor: "pointer" }} onClick={() => setMonth(currentMonthKey())}>
              {monthOffsetLabel(month)}
            </span>
            <button style={{ width: 32, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              <ChevronRightIcon color="var(--text-muted)" />
            </button>
          </div>
          <button className="btn btn-secondary" onClick={() => openForm("receita")}>
            + Receita
          </button>
          <button className="btn" onClick={() => openForm("despesa")}>
            + Despesa
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 480 }}>
          {transactionFormFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {transactionFormFields}
      </FormSheet>

      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Receita (mês)</div>
          <div className="kpi-value">{formatMoney(data.kpis.receita)}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Despesa (mês)</div>
          <div className="kpi-value">{formatMoney(data.kpis.despesa)}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Lucro (mês)</div>
          <div className="kpi-value">{formatMoney(data.kpis.lucro)}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Pendente a receber</div>
          <div className="kpi-value">{formatMoney(data.kpis.pendentes)}</div>
        </div>
      </div>

      {/* Fechamento do dia: reaproveita os atendimentos da Agenda (via
          schedule_id em transactions) - fonte unica, nada cadastrado 2x. */}
      <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
          <div style={{ fontWeight: 600 }}>Fechamento do dia</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setClosingDate((d) => shiftDayStr(d, -1))}
            >
              <ChevronLeftIcon color="var(--text-muted)" />
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 92, textAlign: "center", cursor: "pointer" }} onClick={() => setClosingDate(todayStr())}>
              {dayLabel(closingDate)}
            </span>
            <button
              style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => setClosingDate((d) => shiftDayStr(d, 1))}
            >
              <ChevronRightIcon color="var(--text-muted)" />
            </button>
          </div>
        </div>

        {closingError && <div className="error-text">{closingError}</div>}

        {closing && (
          <div key={closing.date} className="finance-fade-in">
            <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 16 }}>{fullDayLabel(closing.date)}</div>

            <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.01em" }}>{closing.appointmentCount}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>Atendimentos</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.01em" }}>{formatMoney(closing.invoiced)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>Faturado</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.01em", color: "var(--green)" }}>{formatMoney(closing.received)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>Recebido</div>
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.01em", color: closing.pending > 0 ? "var(--yellow)" : "var(--text)" }}>
                  {formatMoney(closing.pending)}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>Pendente</div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-soft)" }}>
              {closing.appointments.length === 0 && <div className="empty-state">Nenhum atendimento neste dia.</div>}
              {closing.appointments.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderBottom: "1px solid var(--border-soft)" }}>
                  <div style={{ width: 40, flex: "0 0 40px", fontSize: 12.5, fontWeight: 600 }}>{a.time.slice(0, 5)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.patientName}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.procedure}</div>
                  </div>
                  {a.paymentStatus ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{formatMoney(a.amount || 0)}</span>
                      <button
                        className={`badge ${a.paymentStatus === "pago" ? "badge-green" : "badge-yellow"}`}
                        style={{ border: "none", cursor: "pointer" }}
                        disabled={payingId === a.id}
                        onClick={() => togglePayment(a)}
                        title="Toque para alternar entre Pago e Pendente"
                      >
                        {payingId === a.id ? "..." : a.paymentStatus === "pago" ? "Pago" : "Pendente"}
                      </button>
                    </div>
                  ) : valueFormFor === a.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "none" }}>
                      <input
                        className="input"
                        style={{ width: 86, padding: "6px 8px", fontSize: 12.5 }}
                        type="number"
                        step="0.01"
                        autoFocus
                        placeholder="R$"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                      />
                      <button className="btn" style={{ padding: "6px 10px", fontSize: 12 }} disabled={savingValue} onClick={() => saveNewValue(a)}>
                        OK
                      </button>
                    </div>
                  ) : (
                    <button
                      className="badge badge-neutral"
                      style={{ border: "none", cursor: "pointer", flex: "none" }}
                      onClick={() => {
                        setValueFormFor(a.id);
                        setNewAmount("");
                      }}
                    >
                      Definir valor
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
              {!compareOpen ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setCompareOpen(true);
                    setCompareDate(shiftDayStr(closingDate, -1));
                  }}
                >
                  Comparar com outro dia
                </button>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>Comparar dias</div>
                    <button
                      className="badge badge-neutral"
                      style={{ border: "none", cursor: "pointer" }}
                      onClick={() => {
                        setCompareOpen(false);
                        setCompareDate(null);
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                  <input
                    className="input"
                    type="date"
                    value={compareDate ?? ""}
                    onChange={(e) => setCompareDate(e.target.value)}
                    style={{ marginBottom: 16, maxWidth: 180 }}
                  />
                  {compareClosing && (
                    <div key={compareClosing.date} className="finance-fade-in">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", rowGap: 8, fontSize: 13 }}>
                        <div />
                        <div style={{ textAlign: "right", fontWeight: 600, padding: "0 4px 6px", borderBottom: "1px solid var(--border-soft)" }}>{dayLabel(closing.date)}</div>
                        <div style={{ textAlign: "right", fontWeight: 600, padding: "0 4px 6px", borderBottom: "1px solid var(--border-soft)" }}>{dayLabel(compareClosing.date)}</div>

                        <div style={{ color: "var(--text-muted)" }}>Atendimentos</div>
                        <div style={{ textAlign: "right" }}>{closing.appointmentCount}</div>
                        <div style={{ textAlign: "right" }}>{compareClosing.appointmentCount}</div>

                        <div style={{ color: "var(--text-muted)" }}>Faturado</div>
                        <div style={{ textAlign: "right" }}>{formatMoney(closing.invoiced)}</div>
                        <div style={{ textAlign: "right" }}>{formatMoney(compareClosing.invoiced)}</div>

                        <div style={{ color: "var(--text-muted)" }}>Recebido</div>
                        <div style={{ textAlign: "right" }}>{formatMoney(closing.received)}</div>
                        <div style={{ textAlign: "right" }}>{formatMoney(compareClosing.received)}</div>

                        <div style={{ color: "var(--text-muted)" }}>Pendente</div>
                        <div style={{ textAlign: "right" }}>{formatMoney(closing.pending)}</div>
                        <div style={{ textAlign: "right" }}>{formatMoney(compareClosing.pending)}</div>
                      </div>
                      {compareClosing.invoiced > 0 && closing.invoiced !== compareClosing.invoiced && (
                        <div
                          style={{
                            marginTop: 14,
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: closing.invoiced > compareClosing.invoiced ? "var(--green)" : "var(--red)",
                          }}
                        >
                          {closing.invoiced > compareClosing.invoiced ? "+" : ""}
                          {(((closing.invoiced - compareClosing.invoiced) / compareClosing.invoiced) * 100).toFixed(0)}% em faturamento vs.{" "}
                          {dayLabel(compareClosing.date)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Fluxo de caixa (últimos 6 meses)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14, fontSize: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--green)" }} /> Entradas
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--red)" }} /> Saídas
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          {data.chart.map((b) => (
            <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 4, height: 100 }}>
                <div style={{ width: "38%", height: `${(b.in / maxBar) * 100}%`, background: "var(--green)", borderRadius: "4px 4px 0 0" }} />
                <div style={{ width: "38%", height: `${(b.out / maxBar) * 100}%`, background: "var(--red)", borderRadius: "4px 4px 0 0" }} />
              </div>
              <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)", fontWeight: 600 }}>Receitas recentes</div>
          {data.receitas.length === 0 && <div className="empty-state">Nenhuma receita registrada.</div>}
          {data.receitas.map((r) =>
            isMobile ? (
              <div key={r.id} className="mobile-list-item">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.description}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{formatMoney(r.amount)}</div>
                </div>
                <div className="mobile-list-row">
                  <span>{r.method || "—"}</span>
                  <span className={`badge ${r.status === "pago" ? "badge-green" : "badge-yellow"}`}>{r.status === "pago" ? "Pago" : "Pendente"}</span>
                  {r.patient_id ? (
                    <Link to={`/pacientes/${r.patient_id}`} className="badge badge-blue">
                      {r.patientName || "Paciente"}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--text-faint)" }}>—</span>
                  )}
                </div>
                <div className="mobile-list-actions">
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(r)}>
                    Editar
                  </button>
                  <button className="btn-danger" style={{ flex: 1, borderRadius: 10, fontSize: 13 }} onClick={() => handleDelete(r)}>
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: "1px solid var(--border-soft)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.description}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                    {r.method || "—"}
                    {r.patient_id && (
                      <>
                        {" · "}
                        <Link to={`/pacientes/${r.patient_id}`} style={{ color: "var(--accent-dark)", fontWeight: 600 }}>
                          {r.patientName || "Paciente"}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{formatMoney(r.amount)}</div>
                    <span className={`badge ${r.status === "pago" ? "badge-green" : "badge-yellow"}`}>{r.status === "pago" ? "Pago" : "Pendente"}</span>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openEdit(r)}>
                    Editar
                  </button>
                  <button className="btn-danger" style={{ borderRadius: 8, padding: "6px 10px", fontSize: 12 }} onClick={() => handleDelete(r)}>
                    Excluir
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)", fontWeight: 600 }}>Despesas recentes</div>
          {data.despesas.length === 0 && <div className="empty-state">Nenhuma despesa registrada.</div>}
          {data.despesas.map((d) =>
            isMobile ? (
              <div key={d.id} className="mobile-list-item">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.description}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--red)" }}>− {formatMoney(d.amount)}</div>
                </div>
                {d.category && (
                  <div className="mobile-list-row">
                    <span className="badge badge-neutral">{d.category}</span>
                  </div>
                )}
                <div className="mobile-list-actions">
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(d)}>
                    Editar
                  </button>
                  <button className="btn-danger" style={{ flex: 1, borderRadius: 10, fontSize: 13 }} onClick={() => handleDelete(d)}>
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px", borderBottom: "1px solid var(--border-soft)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.description}</div>
                  {d.category && <span className="badge badge-neutral">{d.category}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--red)" }}>− {formatMoney(d.amount)}</div>
                  <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => openEdit(d)}>
                    Editar
                  </button>
                  <button className="btn-danger" style={{ borderRadius: 8, padding: "6px 10px", fontSize: 12 }} onClick={() => handleDelete(d)}>
                    Excluir
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Procedimentos mais realizados</div>
          {data.reportProcs.length === 0 && <div className="empty-state">Sem dados nos últimos 90 dias.</div>}
          {data.reportProcs.map((p) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span>{p.name}</span>
              <span style={{ color: "var(--text-muted)" }}>{p.count}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>Pacientes que mais retornam</div>
          {data.reportPatients.length === 0 && <div className="empty-state">Sem dados nos últimos 90 dias.</div>}
          {data.reportPatients.map((p) => (
            <div key={p.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span>{p.name}</span>
              <span style={{ color: "var(--text-muted)" }}>{p.visits} visitas</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
