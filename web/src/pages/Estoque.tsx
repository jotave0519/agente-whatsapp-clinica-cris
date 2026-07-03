import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  min_quantity: number;
  expiry_date: string | null;
  active: boolean;
  status: "ok" | "baixo" | "vencimento";
}

interface Movement {
  id: string;
  item_id: string;
  item_name: string;
  type: "entrada" | "saida";
  quantity: number;
  note: string | null;
  created_at: string;
}

interface InventoryData {
  items: InventoryItem[];
  movements: Movement[];
  kpis: { totalItems: number; lowStock: number; expiringSoon: number; movementsThisMonth: number };
}

const EMPTY_ITEM_FORM = { name: "", category: "", unit: "un", quantity: "", min_quantity: "", expiry_date: "" };
const EMPTY_MOVE_FORM = { item_id: "", type: "entrada" as "entrada" | "saida", quantity: "", note: "" };

function statusBadge(status: InventoryItem["status"]) {
  if (status === "baixo") return <span className="badge badge-red">Estoque baixo</span>;
  if (status === "vencimento") return <span className="badge badge-yellow">Vence em breve</span>;
  return <span className="badge badge-green">Em estoque</span>;
}

export function Estoque() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [showMoveForm, setShowMoveForm] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [moveForm, setMoveForm] = useState(EMPTY_MOVE_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get<InventoryData>("/inventory");
      setData(r);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreateItem() {
    setEditingId(null);
    setItemForm(EMPTY_ITEM_FORM);
    setShowItemForm(true);
  }

  function startEditItem(item: InventoryItem) {
    setEditingId(item.id);
    setItemForm({
      name: item.name,
      category: item.category || "",
      unit: item.unit,
      quantity: String(item.quantity),
      min_quantity: String(item.min_quantity),
      expiry_date: item.expiry_date || "",
    });
    setShowItemForm(true);
  }

  async function handleItemSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.patch(`/inventory/items/${editingId}`, {
          name: itemForm.name,
          category: itemForm.category || null,
          unit: itemForm.unit,
          min_quantity: Number(itemForm.min_quantity),
          expiry_date: itemForm.expiry_date || null,
        });
      } else {
        await api.post("/inventory/items", {
          name: itemForm.name,
          category: itemForm.category || null,
          unit: itemForm.unit,
          quantity: Number(itemForm.quantity || 0),
          min_quantity: Number(itemForm.min_quantity || 0),
          expiry_date: itemForm.expiry_date || null,
        });
      }
      setShowItemForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(item: InventoryItem) {
    if (!window.confirm(`Excluir "${item.name}"? O histórico de movimentações desse item também será apagado.`)) return;
    try {
      await api.delete(`/inventory/items/${item.id}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEditMovement(m: Movement) {
    setEditingMovementId(m.id);
    setMoveForm({ item_id: m.item_id, type: m.type, quantity: String(m.quantity), note: m.note || "" });
    setShowMoveForm(true);
  }

  function closeMoveForm() {
    setShowMoveForm(false);
    setEditingMovementId(null);
    setMoveForm(EMPTY_MOVE_FORM);
  }

  async function handleMoveSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingMovementId) {
        await api.patch(`/inventory/movements/${editingMovementId}`, {
          type: moveForm.type,
          quantity: Number(moveForm.quantity),
          note: moveForm.note || null,
        });
      } else {
        await api.post("/inventory/movements", {
          item_id: moveForm.item_id,
          type: moveForm.type,
          quantity: Number(moveForm.quantity),
          note: moveForm.note || null,
        });
      }
      closeMoveForm();
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Carregando...</div>;

  const filteredItems = data.items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Estoque</h1>
          <p className="page-subtitle">Controle de produtos e insumos da clínica</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setEditingMovementId(null);
              setMoveForm(EMPTY_MOVE_FORM);
              setShowMoveForm(true);
            }}
          >
            Registrar movimentação
          </button>
          <button className="btn" onClick={startCreateItem}>
            + Novo item
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {showItemForm && (
        <form className="card" onSubmit={handleItemSubmit} style={{ marginBottom: 20, display: "grid", gap: 12, maxWidth: 480 }}>
          <div>
            <label className="field-label">Nome</label>
            <input className="input" required value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Categoria</label>
              <input className="input" value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Unidade</label>
              <input className="input" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {!editingId && (
              <div style={{ flex: 1 }}>
                <label className="field-label">Quantidade inicial</label>
                <input className="input" type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label className="field-label">Mínimo</label>
              <input className="input" type="number" value={itemForm.min_quantity} onChange={(e) => setItemForm({ ...itemForm, min_quantity: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Validade</label>
              <input className="input" type="date" value={itemForm.expiry_date} onChange={(e) => setItemForm({ ...itemForm, expiry_date: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setShowItemForm(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {showMoveForm && (
        <form className="card" onSubmit={handleMoveSubmit} style={{ marginBottom: 20, display: "grid", gap: 12, maxWidth: 480 }}>
          <div style={{ fontWeight: 600 }}>{editingMovementId ? "Editar movimentação" : "Registrar movimentação"}</div>
          <div>
            <label className="field-label">Item</label>
            <select
              className="input"
              required
              disabled={!!editingMovementId}
              value={moveForm.item_id}
              onChange={(e) => setMoveForm({ ...moveForm, item_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {data.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity} {i.unit})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Tipo</label>
              <select className="input" value={moveForm.type} onChange={(e) => setMoveForm({ ...moveForm, type: e.target.value as "entrada" | "saida" })}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="field-label">Quantidade</label>
              <input className="input" type="number" required value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Observação</label>
            <input className="input" value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvando..." : editingMovementId ? "Salvar alterações" : "Registrar"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={closeMoveForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="kpi-grid">
        <div className="card">
          <div className="kpi-label">Total de produtos</div>
          <div className="kpi-value">{data.kpis.totalItems}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Estoque baixo</div>
          <div className="kpi-value">{data.kpis.lowStock}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Vence em breve</div>
          <div className="kpi-value">{data.kpis.expiringSoon}</div>
        </div>
        <div className="card">
          <div className="kpi-label">Movimentações (mês)</div>
          <div className="kpi-value">{data.kpis.movementsThisMonth}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
            <input className="input" placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Qtd.</th>
                <th>Mínimo</th>
                <th>Validade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Nenhum item encontrado.
                  </td>
                </tr>
              )}
              {filteredItems.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{i.name}</div>
                    <div style={{ marginTop: 4 }}>{statusBadge(i.status)}</div>
                  </td>
                  <td>
                    {i.quantity} {i.unit}
                  </td>
                  <td>{i.min_quantity}</td>
                  <td>{i.expiry_date ? new Date(i.expiry_date).toLocaleDateString("pt-BR") : "—"}</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-secondary" onClick={() => startEditItem(i)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ borderRadius: 8, padding: "6px 12px", fontSize: 12.5 }} onClick={() => handleDeleteItem(i)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Movimentações recentes</div>
          {data.movements.length === 0 && <div className="empty-state">Nenhuma movimentação ainda.</div>}
          {data.movements.map((m) => (
            <div key={m.id} style={{ padding: "9px 0", borderTop: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{m.item_name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12.5, color: m.type === "entrada" ? "var(--green)" : "var(--red)" }}>
                    {m.type === "entrada" ? "+" : "−"}
                    {m.quantity}
                  </span>
                  <button style={{ fontSize: 11.5, color: "var(--accent)" }} onClick={() => startEditMovement(m)}>
                    editar
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{new Date(m.created_at).toLocaleString("pt-BR")}</div>
              {m.note && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{m.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
