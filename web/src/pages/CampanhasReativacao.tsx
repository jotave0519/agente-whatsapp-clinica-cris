import { FormEvent, useEffect, useState } from "react";
import { FormSheet } from "../components/FormSheet";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

interface Campaign {
  id: string;
  name: string;
  segment_type: string;
  inactive_days: number;
  message_style: string;
  active: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  allowed_weekdays: number[];
  allowed_hour_start: string;
  allowed_hour_end: string;
  max_messages: number;
  nudge_interval_days: number;
  daily_send_cap: number;
}

interface CampaignStats {
  campaign: Campaign;
  totalTargets: number;
  byStatus: Record<string, number>;
  events: { id: string; event_type: string; detail: string | null; created_at: string }[];
}

const SEGMENT_OPTIONS = [
  { value: "all", label: "Todos os pacientes inativos" },
  { value: "evaluation_only", label: "Fizeram apenas avaliação" },
  { value: "procedure:Botox", label: "Fizeram Botox" },
  { value: "procedure:Preenchimento", label: "Fizeram preenchimento" },
  { value: "procedure:Limpeza de pele", label: "Fizeram limpeza de pele" },
  { value: "cancelled", label: "Cancelaram a última consulta" },
  { value: "no_show", label: "Faltaram na última consulta" },
  { value: "never_returned", label: "Nunca retornaram (só 1 visita)" },
  { value: "recurring", label: "Pacientes recorrentes" },
  { value: "custom", label: "Outro procedimento..." },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const EVENT_LABELS: Record<string, string> = {
  target_created: "Campanha iniciada",
  message_sent: "Mensagem enviada",
  reminder_sent: "Lembrete enviado",
  responded: "Paciente respondeu",
  declined: "Paciente sem interesse",
  ignored: "Paciente ignorou",
  converted: "Paciente reagendou",
  excluded: "Excluído por segurança",
  failed: "Falha no envio",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando envio",
  awaiting_response: "Aguardando resposta",
  responded: "Respondeu",
  ignored: "Ignorou",
  converted: "Convertido",
  declined: "Sem interesse",
  excluded: "Excluído",
  failed: "Falhou",
};

const EMPTY_FORM = {
  name: "",
  segment_type: "all",
  customProcedure: "",
  inactive_days: 60,
  message_style: "acolhedor e natural, como uma recepcionista que sente falta do paciente",
  active: true,
  allowed_weekdays: [1, 2, 3, 4, 5],
  allowed_hour_start: "09:00",
  allowed_hour_end: "18:00",
  max_messages: 2,
  nudge_interval_days: 7,
  daily_send_cap: 30,
};

function campaignBadge(c: Campaign): { label: string; cls: string } {
  if (!c.active) return { label: "Pausada", cls: "badge-yellow" };
  if (c.scheduled_start && c.scheduled_start > new Date().toISOString().slice(0, 10)) return { label: "Agendada", cls: "badge-blue" };
  if (c.scheduled_end && c.scheduled_end < new Date().toISOString().slice(0, 10)) return { label: "Encerrada", cls: "badge-neutral" };
  return { label: "Ativa", cls: "badge-green" };
}

export function CampanhasReativacao() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [statsFor, setStatsFor] = useState<CampaignStats | null>(null);
  const [reactivationEnabled, setReactivationEnabled] = useState<boolean | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);

  function load() {
    api
      .get<{ items: Campaign[] }>("/reactivation-campaigns")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api
      .get<{ clinic: { reactivation_enabled: boolean } }>("/settings")
      .then((r) => setReactivationEnabled(r.clinic.reactivation_enabled))
      .catch(() => {});
  }, []);

  async function toggleReactivationEnabled() {
    if (reactivationEnabled === null) return;
    setSavingToggle(true);
    try {
      await api.patch("/settings", { clinic: { reactivation_enabled: !reactivationEnabled } });
      setReactivationEnabled(!reactivationEnabled);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingToggle(false);
    }
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function startEdit(c: Campaign) {
    const isCustom = c.segment_type.startsWith("procedure:") && !SEGMENT_OPTIONS.some((o) => o.value === c.segment_type);
    setEditingId(c.id);
    setForm({
      name: c.name,
      segment_type: isCustom ? "custom" : c.segment_type,
      customProcedure: isCustom ? c.segment_type.slice("procedure:".length) : "",
      inactive_days: c.inactive_days,
      message_style: c.message_style,
      active: c.active,
      allowed_weekdays: c.allowed_weekdays,
      allowed_hour_start: c.allowed_hour_start.slice(0, 5),
      allowed_hour_end: c.allowed_hour_end.slice(0, 5),
      max_messages: c.max_messages,
      nudge_interval_days: c.nudge_interval_days,
      daily_send_cap: c.daily_send_cap,
    });
    setShowForm(true);
    setOpenMenuId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const segment_type = form.segment_type === "custom" ? `procedure:${form.customProcedure}` : form.segment_type;
      const payload = {
        name: form.name,
        segment_type,
        inactive_days: form.inactive_days,
        message_style: form.message_style,
        active: form.active,
        allowed_weekdays: form.allowed_weekdays,
        allowed_hour_start: form.allowed_hour_start,
        allowed_hour_end: form.allowed_hour_end,
        max_messages: form.max_messages,
        nudge_interval_days: form.nudge_interval_days,
        daily_send_cap: form.daily_send_cap,
      };
      if (editingId) {
        await api.patch(`/reactivation-campaigns/${editingId}`, payload);
      } else {
        await api.post("/reactivation-campaigns", payload);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(c: Campaign) {
    setOpenMenuId(null);
    try {
      await api.patch(`/reactivation-campaigns/${c.id}`, { active: !c.active });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDuplicate(c: Campaign) {
    setOpenMenuId(null);
    try {
      await api.post(`/reactivation-campaigns/${c.id}/duplicate`, {});
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete(c: Campaign) {
    setOpenMenuId(null);
    if (!window.confirm(`Excluir a campanha "${c.name}"? Isso não afeta pacientes já contatados, mas remove o histórico da campanha.`)) return;
    try {
      await api.delete(`/reactivation-campaigns/${c.id}`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleViewStats(c: Campaign) {
    setOpenMenuId(null);
    try {
      const stats = await api.get<CampaignStats>(`/reactivation-campaigns/${c.id}/stats`);
      setStatsFor(stats);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleWeekday(day: number) {
    setForm((f) => ({
      ...f,
      allowed_weekdays: f.allowed_weekdays.includes(day) ? f.allowed_weekdays.filter((d) => d !== day) : [...f.allowed_weekdays, day].sort(),
    }));
  }

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      {isMobile && <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{editingId ? "Editar campanha" : "Nova campanha"}</div>}
      <div>
        <label className="field-label">Nome da campanha</label>
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Segmento de pacientes</label>
        <select className="input" value={form.segment_type} onChange={(e) => setForm({ ...form, segment_type: e.target.value })}>
          {SEGMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {form.segment_type === "custom" && (
        <div>
          <label className="field-label">Nome do procedimento</label>
          <input className="input" required value={form.customProcedure} onChange={(e) => setForm({ ...form, customProcedure: e.target.value })} />
        </div>
      )}
      <div>
        <label className="field-label">Pacientes sem atendimento há quantos dias?</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
          <input
            type="number"
            className="input"
            style={{ maxWidth: 100 }}
            min={1}
            required
            value={form.inactive_days}
            onChange={(e) => setForm({ ...form, inactive_days: Number(e.target.value) })}
          />
          {[30, 60, 90, 180].map((d) => (
            <button
              key={d}
              type="button"
              className={`segmented-item${form.inactive_days === d ? " active" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => setForm({ ...form, inactive_days: d })}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Tom da mensagem (a IA compõe o texto com base no histórico do paciente)</label>
        <textarea className="input" rows={2} value={form.message_style} onChange={(e) => setForm({ ...form, message_style: e.target.value })} />
      </div>
      <div>
        <label className="field-label">Dias permitidos para envio</label>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              className={`segmented-item${form.allowed_weekdays.includes(day) ? " active" : ""}`}
              style={{ cursor: "pointer" }}
              onClick={() => toggleWeekday(day)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div>
          <label className="field-label">Horário permitido</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <input
              className="input"
              style={{ width: 100 }}
              type="time"
              value={form.allowed_hour_start}
              onChange={(e) => setForm({ ...form, allowed_hour_start: e.target.value })}
            />
            <span style={{ color: "var(--text-muted)" }}>às</span>
            <input
              className="input"
              style={{ width: 100 }}
              type="time"
              value={form.allowed_hour_end}
              onChange={(e) => setForm({ ...form, allowed_hour_end: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <label className="field-label">Quantidade máxima de mensagens</label>
          <input
            type="number"
            className="input"
            style={{ maxWidth: 100, marginTop: 6 }}
            min={1}
            value={form.max_messages}
            onChange={(e) => setForm({ ...form, max_messages: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="field-label">Intervalo entre lembretes (dias)</label>
          <input
            type="number"
            className="input"
            style={{ maxWidth: 100, marginTop: 6 }}
            min={1}
            value={form.nudge_interval_days}
            onChange={(e) => setForm({ ...form, nudge_interval_days: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="field-label">Limite de envios por dia</label>
          <input
            type="number"
            className="input"
            style={{ maxWidth: 100, marginTop: 6 }}
            min={1}
            value={form.daily_send_cap}
            onChange={(e) => setForm({ ...form, daily_send_cap: Number(e.target.value) })}
          />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
        Campanha ativa
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
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Campanhas de Reativação</h1>
          <p className="page-subtitle">IA que retoma contato com pacientes inativos de forma natural e contextualizada</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {reactivationEnabled !== null && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={reactivationEnabled} disabled={savingToggle} onChange={toggleReactivationEnabled} />
              Reativação automática ativa
            </label>
          )}
          <button
            onClick={startCreate}
            style={{ display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 15px", borderRadius: 11, background: "var(--text)", color: "var(--bg)", fontSize: 13.5, fontWeight: 500 }}
          >
            + Nova campanha
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      {!isMobile && showForm && (
        <div className="card" style={{ marginBottom: 20, maxWidth: 560 }}>
          {formFields}
        </div>
      )}
      <FormSheet open={isMobile && showForm} onClose={() => setShowForm(false)}>
        {formFields}
      </FormSheet>

      {items === null && <div className="empty-state">Carregando...</div>}
      {items !== null && items.length === 0 && <div className="empty-state">Nenhuma campanha criada ainda.</div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16 }}>
        {items?.map((c) => {
          const badge = campaignBadge(c);
          const segmentLabel = SEGMENT_OPTIONS.find((o) => o.value === c.segment_type)?.label || c.segment_type;
          return (
            <div key={c.id} className="card" style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{c.name}</div>
                  <span className={`badge ${badge.cls}`} style={{ marginTop: 6, display: "inline-block" }}>
                    {badge.label}
                  </span>
                </div>
                <button className="mobile-icon-btn" onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}>
                  ⋮
                </button>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>{segmentLabel}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Inativos há {c.inactive_days}+ dias</div>

              {openMenuId === c.id && (
                <div
                  style={{
                    position: "absolute",
                    top: 40,
                    right: 14,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow-card)",
                    zIndex: 5,
                    minWidth: 160,
                    overflow: "hidden",
                  }}
                >
                  {[
                    { label: "Ver estatísticas", onClick: () => handleViewStats(c) },
                    { label: "Editar", onClick: () => startEdit(c) },
                    { label: c.active ? "Pausar" : "Ativar", onClick: () => togglePause(c) },
                    { label: "Duplicar", onClick: () => handleDuplicate(c) },
                    { label: "Excluir", onClick: () => handleDelete(c), danger: true },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        fontSize: 13,
                        color: item.danger ? "var(--red)" : "var(--text)",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {statsFor && (
        <div className="modal-overlay" onClick={() => setStatsFor(null)}>
          <div className="modal-card" style={{ maxWidth: 480, maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{statsFor.campaign.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 14 }}>{statsFor.totalTargets} paciente(s) na campanha</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {Object.entries(statsFor.byStatus)
                .filter(([, count]) => count > 0)
                .map(([status, count]) => (
                  <div key={status} className="card" style={{ padding: 10 }}>
                    <div className="kpi-value" style={{ fontSize: 20 }}>
                      {count}
                    </div>
                    <div className="kpi-label" style={{ marginTop: 2, marginBottom: 0 }}>
                      {STATUS_LABELS[status] || status}
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Histórico</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {statsFor.events.length === 0 && <div className="empty-state">Nenhum evento ainda.</div>}
              {statsFor.events.map((ev) => (
                <div key={ev.id} style={{ padding: "8px 0", borderTop: "1px solid var(--border-soft)", fontSize: 12.5 }}>
                  <div>{EVENT_LABELS[ev.event_type] || ev.event_type}</div>
                  <div style={{ color: "var(--text-faint)", fontSize: 11.5, marginTop: 2 }}>
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>

            <button className="btn" style={{ marginTop: 16 }} onClick={() => setStatsFor(null)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
