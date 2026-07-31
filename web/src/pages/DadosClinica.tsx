import { FormEvent, useEffect, useState } from "react";
import { BackHeader } from "../components/BackHeader";
import { useToast } from "../context/ToastContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { api } from "../lib/api";

const FIELD_TYPES: Partial<Record<keyof ClinicSettings, { type: string; inputMode?: "tel" | "email" | "numeric" }>> = {
  phone: { type: "tel", inputMode: "tel" },
  whatsapp: { type: "tel", inputMode: "tel" },
  email: { type: "email", inputMode: "email" },
  zip_code: { type: "text", inputMode: "numeric" },
  website: { type: "url" },
};

interface ClinicSettings {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  responsible_name: string | null;
  specialty: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  general_notes: string | null;
  about_text: string | null;
  google_review_link: string | null;
}

export function DadosClinica() {
  const isMobile = useIsMobile();
  const showToast = useToast();
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ clinic: ClinicSettings }>("/settings")
      .then((r) => setClinic(r.clinic))
      .catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clinic) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch("/settings", { clinic });
      showToast("✓ Informações salvas.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !clinic) return <div className="empty-state">{error}</div>;
  if (!clinic) return <div className="empty-state">Carregando...</div>;

  function field(label: string, key: keyof ClinicSettings) {
    const typeInfo = FIELD_TYPES[key];
    return (
      <div>
        <label className="field-label">{label}</label>
        <input
          className="input"
          type={typeInfo?.type || "text"}
          inputMode={typeInfo?.inputMode}
          value={(clinic as any)[key] || ""}
          onChange={(e) => setClinic({ ...(clinic as ClinicSettings), [key]: e.target.value })}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <BackHeader title="Dados da Clínica" subtitle="Usados pela IA para responder dúvidas sobre a clínica no WhatsApp" backTo="/configuracoes" />

      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Dados básicos</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          {field("Nome da clínica", "name")}
          {field("Nome da responsável", "responsible_name")}
          {field("Especialidade", "specialty")}
          {field("Endereço completo", "address")}
          {field("Cidade", "city")}
          {field("Estado", "state")}
          {field("CEP", "zip_code")}
          {field("Telefone", "phone")}
          {field("WhatsApp", "whatsapp")}
          {field("E-mail", "email")}
          {field("Instagram", "instagram")}
          {field("Site", "website")}
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Avaliações no Google</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
          Link usado ao convidar pacientes a avaliar a clínica no Google, depois da consulta
        </div>
        {field("Link de avaliação do Google", "google_review_link")}
      </div>

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Observações gerais</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
          Qualquer informação adicional que a IA deve levar em conta
        </div>
        <textarea
          className="input"
          rows={3}
          value={clinic.general_notes || ""}
          onChange={(e) => setClinic({ ...clinic, general_notes: e.target.value })}
        />
      </div>

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Sobre a clínica</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 12 }}>
          Usado quando o cliente perguntar coisas como "quem é a doutora?" ou "como funciona a clínica?"
        </div>
        <textarea
          className="input"
          rows={5}
          placeholder='Ex: "A Dra. Cristiane Zangelmi é especialista em harmonização facial, estética avançada e rejuvenescimento facial."'
          value={clinic.about_text || ""}
          onChange={(e) => setClinic({ ...clinic, about_text: e.target.value })}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
