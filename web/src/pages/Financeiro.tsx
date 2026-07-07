import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
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

export function Financeiro() {
  const isMobile = useIsMobile();
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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

  function openForm(type: "receita" | "despesa") {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, type });
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
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      type: form.type,
      description: form.description,
      category: form.category || null,
      amount: Number(form.amount),
      method: form.method || null,
      status: form.status,
    };
    try {
      if (editingId) {
        await api.patch(`/finance/transactions/${editingId}`, payload);
      } else {
        await api.post("/finance/transactions", payload);
      }
      setShowForm(false);
      await load();
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
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (error && !data) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

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
              Mês atual
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
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.method || "—"}</div>
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
