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

// summaryPhrase encaixa na frase "Procurará pacientes {summaryPhrase} sem atendimento há N dias."
const SEGMENT_OPTIONS = [
  { value: "all", label: "Todos os pacientes inativos", summaryPhrase: "de todos os perfis" },
  { value: "evaluation_only", label: "Fizeram apenas avaliação", summaryPhrase: "que fizeram apenas avaliação" },
  { value: "procedure:Botox", label: "Fizeram Botox", summaryPhrase: "que fizeram Botox" },
  { value: "procedure:Preenchimento", label: "Fizeram preenchimento", summaryPhrase: "que fizeram preenchimento" },
  { value: "procedure:Limpeza de pele", label: "Fizeram limpeza de pele", summaryPhrase: "que fizeram limpeza de pele" },
  { value: "cancelled", label: "Cancelaram a última consulta", summaryPhrase: "que cancelaram a última consulta" },
  { value: "no_show", label: "Faltaram na última consulta", summaryPhrase: "que faltaram na última consulta" },
  { value: "never_returned", label: "Nunca retornaram (só 1 visita)", summaryPhrase: "que nunca retornaram" },
  { value: "recurring", label: "Pacientes recorrentes", summaryPhrase: "recorrentes" },
  { value: "custom", label: "Outro procedimento...", summaryPhrase: "" },
];

const TONE_OPTIONS = [
  {
    value: "acolhedor",
    label: "Acolhedor",
    description: "Caloroso e pessoal, como quem sente falta do paciente",
    style: "acolhedor e caloroso, como uma recepcionista que sente falta do paciente e quer genuinamente saber como ele está",
  },
  {
    value: "profissional",
    label: "Profissional",
    description: "Cordial e direto, sem informalidade excessiva",
    style: "profissional e cordial, direto ao ponto mas educado, como uma recepcionista experiente",
  },
  {
    value: "comercial",
    label: "Comercial",
    description: "Convida gentilmente a retomar os cuidados",
    style: "consultivo e proativo, destacando gentilmente a importância de manter os cuidados em dia, sem ser insistente",
  },
  { value: "personalizado", label: "Personalizado", description: "Descreva o estilo que preferir", style: "" },
];

const DAYS_OPTIONS = [30, 60, 90, 180];
const DAILY_CAP_OPTIONS = [10, 20, 30, 50];

// Padroes inteligentes aplicados automaticamente (nao aparecem na tela) -
// omitidos do payload de criacao para a coluna usar o default do banco;
// preservados como estao ao editar (nunca sobrescritos por este formulario).
const SMART_DEFAULTS = { allowed_weekdays: [1, 2, 3, 4, 5], allowed_hour_start: "09:00", allowed_hour_end: "18:00", max_messages: 2, nudge_interval_days: 7 };

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
  nameEdited: false,
  segment_type: "all",
  customProcedure: "",
  inactive_days: 60,
  tone: "acolhedor",
  customStyle: "",
  active: true,
  daily_send_cap: 30,
};

function campaignBadge(c: Campaign): { label: string; cls: string } {
  if (!c.active) return { label: "Pausada", cls: "badge-yellow" };
  if (c.scheduled_start && c.scheduled_start > new Date().toISOString().slice(0, 10)) return { label: "Agendada", cls: "badge-blue" };
  if (c.scheduled_end && c.scheduled_end < new Date().toISOString().slice(0, 10)) return { label: "Encerrada", cls: "badge-neutral" };
  return { label: "Ativa", cls: "badge-green" };
}

function previewProcedureFor(segmentType: string, customProcedure: string): string | null {
  if (segmentType === "custom") return customProcedure.trim() || null;
  if (segmentType.startsWith("procedure:")) return segmentType.slice("procedure:".length);
  if (segmentType === "evaluation_only") return "avaliação";
  return null;
}

function buildPreviewMessage(tone: string, customStyle: string, procedure: string | null): string {
  const proc = procedure ? `${procedure.toLowerCase() === "avaliação" ? "sua" : "seu(sua)"} ${procedure}` : "sua última visita";
  switch (tone) {
    case "acolhedor":
      return `Oi, Maria! 😊 Tudo bem? Já faz um tempinho desde ${proc} aqui na clínica. Passando para saber como você está e lembrar que, se quiser marcar uma nova avaliação, ficaremos muito felizes em te receber de novo. 💛`;
    case "profissional":
      return `Olá, Maria. Notamos que já faz algum tempo desde ${proc}. Gostaríamos de saber se você tem interesse em agendar uma nova avaliação. Estamos à disposição para qualquer dúvida.`;
    case "comercial":
      return `Oi, Maria! 😊 Faz um tempinho desde ${proc} — que tal aproveitar para dar continuidade aos seus cuidados? Temos horários disponíveis esta semana, posso te ajudar a agendar?`;
    default:
      return customStyle.trim()
        ? `Oi, Maria! 😊 A IA vai escrever cada mensagem seguindo o estilo descrito: "${customStyle.trim()}"`
        : "Descreva o estilo desejado para ver um exemplo de mensagem aqui.";
  }
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
    const isCustomSegment = c.segment_type.startsWith("procedure:") && !SEGMENT_OPTIONS.some((o) => o.value === c.segment_type);
    const matchedTone = TONE_OPTIONS.find((t) => t.value !== "personalizado" && t.style === c.message_style);
    setEditingId(c.id);
    setForm({
      name: c.name,
      nameEdited: true,
      segment_type: isCustomSegment ? "custom" : c.segment_type,
      customProcedure: isCustomSegment ? c.segment_type.slice("procedure:".length) : "",
      inactive_days: c.inactive_days,
      tone: matchedTone ? matchedTone.value : "personalizado",
      customStyle: matchedTone ? "" : c.message_style,
      active: c.active,
      daily_send_cap: c.daily_send_cap,
    });
    setShowForm(true);
    setOpenMenuId(null);
  }

  function updateForm(patch: Partial<typeof EMPTY_FORM>) {
    setForm((f) => {
      const next = { ...f, ...patch };
      // Nome sugerido automaticamente enquanto o usuario nao editar manualmente.
      if (!next.nameEdited && (patch.segment_type !== undefined || patch.inactive_days !== undefined)) {
        const segLabel = SEGMENT_OPTIONS.find((o) => o.value === next.segment_type)?.label || "";
        next.name = `Reativação — ${segLabel} há ${next.inactive_days}+ dias`;
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const segment_type = form.segment_type === "custom" ? `procedure:${form.customProcedure}` : form.segment_type;
      const toneOption = TONE_OPTIONS.find((t) => t.value === form.tone);
      const message_style = form.tone === "personalizado" ? form.customStyle.trim() : toneOption?.style || "";

      const payload: Record<string, unknown> = {
        name: form.name,
        segment_type,
        inactive_days: form.inactive_days,
        message_style,
        active: form.active,
        daily_send_cap: form.daily_send_cap,
      };
      // So aplica os padroes inteligentes na CRIACAO - editar uma campanha existente
      // nunca sobrescreve esses campos (podem ter sido customizados antes desta tela ser simplificada).
      if (!editingId) Object.assign(payload, SMART_DEFAULTS);

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

  const selectedSegment = SEGMENT_OPTIONS.find((o) => o.value === form.segment_type);
  const previewProcedure = previewProcedureFor(form.segment_type, form.customProcedure);
  const previewText = buildPreviewMessage(form.tone, form.customStyle, previewProcedure);
  const segmentSummaryPhrase =
    form.segment_type === "custom" ? (form.customProcedure.trim() ? `que fizeram ${form.customProcedure.trim()}` : "de todos os perfis") : selectedSegment?.summaryPhrase || "";
  const toneLabelLower = TONE_OPTIONS.find((t) => t.value === form.tone)?.label.toLowerCase() || "acolhedora";

  const formFields = (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 26 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-.01em" }}>{editingId ? "Editar campanha" : "Nova campanha de reativação"}</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Diga à IA quem você quer trazer de volta — o resto ela cuida.</p>
      </div>

      <div>
        <input
          className="input"
          style={{ fontSize: 13, opacity: 0.85 }}
          placeholder="Nome da campanha"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value, nameEdited: true })}
        />
      </div>

      {/* Etapa 1 */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>1. Quem você deseja reativar?</div>
        <select className="input" value={form.segment_type} onChange={(e) => updateForm({ segment_type: e.target.value })}>
          {SEGMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {form.segment_type === "custom" && (
          <input
            className="input"
            style={{ marginTop: 8 }}
            required
            placeholder="Nome do procedimento"
            value={form.customProcedure}
            onChange={(e) => setForm({ ...form, customProcedure: e.target.value })}
          />
        )}
      </div>

      {/* Etapa 2 */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>2. Após quanto tempo sem atendimento?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => updateForm({ inactive_days: d })}
              style={{
                flex: "1 1 70px",
                padding: "10px 0",
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 600,
                border: `1.5px solid ${form.inactive_days === d ? "var(--accent)" : "var(--border)"}`,
                background: form.inactive_days === d ? "var(--accent-bg)" : "var(--surface)",
                color: form.inactive_days === d ? "var(--accent-dark)" : "var(--text)",
              }}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {/* Etapa 3 */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>3. Tom da conversa</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 8 }}>
          {TONE_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm({ ...form, tone: t.value })}
              style={{
                padding: "10px 10px",
                borderRadius: 10,
                textAlign: "left",
                border: `1.5px solid ${form.tone === t.value ? "var(--accent)" : "var(--border)"}`,
                background: form.tone === t.value ? "var(--accent-bg)" : "var(--surface)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: form.tone === t.value ? "var(--accent-dark)" : "var(--text)" }}>{t.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{t.description}</div>
            </button>
          ))}
        </div>
        {form.tone === "personalizado" && (
          <textarea
            className="input"
            style={{ marginTop: 10 }}
            rows={2}
            required
            placeholder="Descreva o estilo desejado, ex: descontraído e bem-humorado, com emojis"
            value={form.customStyle}
            onChange={(e) => setForm({ ...form, customStyle: e.target.value })}
          />
        )}
      </div>

      {/* Etapa 4 */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>4. Limite de pacientes contatados por dia</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DAILY_CAP_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setForm({ ...form, daily_send_cap: n })}
              style={{
                flex: "1 1 60px",
                padding: "10px 0",
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 600,
                border: `1.5px solid ${form.daily_send_cap === n ? "var(--accent)" : "var(--border)"}`,
                background: form.daily_send_cap === n ? "var(--accent-bg)" : "var(--surface)",
                color: form.daily_send_cap === n ? "var(--accent-dark)" : "var(--text)",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Previa */}
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Prévia da mensagem</div>
        <div style={{ background: "var(--border-soft)", borderRadius: 14, padding: 16 }}>
          <div
            style={{
              maxWidth: "90%",
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 13px",
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            {previewText}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>Exemplo ilustrativo — a IA compõe cada mensagem com o histórico real do paciente.</div>
        </div>
      </div>

      {/* Resumo */}
      <div className="card" style={{ background: "var(--accent-bg)", border: "1px solid var(--accent)" }}>
        <ul style={{ display: "grid", gap: 6, fontSize: 13, color: "var(--text)", paddingLeft: 18 }}>
          <li>
            Procurará pacientes {segmentSummaryPhrase} sem atendimento há <strong>{form.inactive_days}+ dias</strong>.
          </li>
          <li>
            Conversará de forma <strong>{toneLabelLower}</strong>.
          </li>
          <li>
            Enviará até <strong>{form.daily_send_cap}</strong> contatos por dia.
          </li>
          <li>Não enviará mensagens para pacientes com consultas futuras ou que solicitaram não receber mensagens.</li>
        </ul>
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
