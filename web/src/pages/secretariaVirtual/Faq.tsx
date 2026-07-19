import { FormEvent, useEffect, useState } from "react";
import { BackHeader } from "../../components/BackHeader";
import { FormSheet } from "../../components/FormSheet";
import { useIsMobile } from "../../hooks/useIsMobile";
import { api } from "../../lib/api";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  active: boolean;
  sort_order: number;
}

const EMPTY_FORM = { question: "", answer: "", active: true };

export function Faq() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<FaqItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await api.get<{ items: FaqItem[] }>("/faq");
      setItems(r.items);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(f: FaqItem) {
    setEditingId(f.id);
    setForm({ question: f.question, answer: f.answer, active: f.active });
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.patch(`/faq/${editingId}`, form);
      } else {
        await api.post("/faq", form);
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: FaqItem) {
    if (!window.confirm(`Excluir a pergunta "${f.question}"?`)) return;
    try {
      await api.delete(`/faq/${f.id}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function toggleActive(f: FaqItem) {
    try {
      await api.patch(`/faq/${f.id}`, { active: !f.active });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{editingId ? "Editar pergunta" : "Nova pergunta"}</div>}
      <div>
        <label className="field-label">Pergunta</label>
        <input className="input" required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Resposta</label>
        <textarea className="input" rows={4} required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Ativa (a IA pode usar esta resposta)
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
      <BackHeader title="Perguntas frequentes" subtitle="A IA consulta esta lista antes de responder no WhatsApp" backTo="/secretaria-virtual" />

      {error && !items && <div className="empty-state">{error}</div>}
      {!items ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <button
              onClick={startCreate}
              style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500, flexShrink: 0 }}
            >
              + Nova pergunta
            </button>
          </div>

          {error && <div className="error-text">{error}</div>}

          {!isMobile && showForm && (
            <div className="card" style={{ marginBottom: 20, maxWidth: 520 }}>
              {formFields}
            </div>
          )}
          <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
            {formFields}
          </FormSheet>

          {items.length === 0 && <div className="empty-state">Nenhuma pergunta cadastrada.</div>}

          {isMobile ? (
            <div className="card" style={{ padding: 0 }}>
              {items.map((f) => (
                <div key={f.id} className="mobile-list-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.question}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{f.answer || "Sem resposta cadastrada"}</div>
                  </div>
                  <div className="mobile-list-row">
                    <button className={`badge ${f.active && f.answer ? "badge-green" : "badge-neutral"}`} onClick={() => toggleActive(f)}>
                      {f.active ? "Ativa" : "Inativa"}
                    </button>
                  </div>
                  <div className="mobile-list-actions">
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => startEdit(f)}>
                      Editar
                    </button>
                    <button className="btn-danger" style={{ flex: 1, borderRadius: 10, fontSize: 13 }} onClick={() => handleDelete(f)}>
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Pergunta</th>
                    <th>Resposta</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.question}</td>
                      <td style={{ color: "var(--text-muted)", maxWidth: 360 }}>{f.answer || "Sem resposta cadastrada"}</td>
                      <td>
                        <button className={`badge ${f.active && f.answer ? "badge-green" : "badge-neutral"}`} style={{ cursor: "pointer" }} onClick={() => toggleActive(f)}>
                          {f.active ? "Ativa" : "Inativa"}
                        </button>
                      </td>
                      <td style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary" style={{ borderRadius: 8, padding: "6px 12px", fontSize: 12.5 }} onClick={() => startEdit(f)}>
                          Editar
                        </button>
                        <button className="btn-danger" style={{ borderRadius: 8, padding: "6px 12px", fontSize: 12.5 }} onClick={() => handleDelete(f)}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
