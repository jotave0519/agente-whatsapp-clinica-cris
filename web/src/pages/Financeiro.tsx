import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

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

export function Financeiro() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get<FinanceData>("/finance");
      setData(r);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(type: "receita" | "despesa") {
    setForm({ ...EMPTY_FORM, type });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/finance/transactions", {
        type: form.type,
        description: form.description,
        category: form.category || null,
        amount: Number(form.amount),
        method: form.method || null,
        status: form.status,
      });
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const maxBar = Math.max(1, ...data.chart.flatMap((b) => [b.in, b.out]));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Gestão financeira da clínica</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => openForm("receita")}>
            + Nova receita
          </button>
          <button className="btn" onClick={() => openForm("despesa")}>
            + Nova despesa
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {showForm && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: 20, display: "grid", gap: 12, maxWidth: 480 }}>
          <div style={{ fontWeight: 600 }}>{form.type === "receita" ? "Nova receita" : "Nova despesa"}</div>
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
      )}

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)", fontWeight: 600 }}>Receitas recentes</div>
          {data.receitas.length === 0 && <div className="empty-state">Nenhuma receita registrada.</div>}
          {data.receitas.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", borderBottom: "1px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.description}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.method || "—"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{formatMoney(r.amount)}</div>
                <span className={`badge ${r.status === "pago" ? "badge-green" : "badge-yellow"}`}>{r.status === "pago" ? "Pago" : "Pendente"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)", fontWeight: 600 }}>Despesas recentes</div>
          {data.despesas.length === 0 && <div className="empty-state">Nenhuma despesa registrada.</div>}
          {data.despesas.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 18px", borderBottom: "1px solid var(--border-soft)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.description}</div>
                {d.category && <span className="badge badge-neutral">{d.category}</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--red)" }}>− {formatMoney(d.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
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
