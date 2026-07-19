import { useEffect, useState } from "react";
import { ToggleCard } from "../components/ToggleCard";
import { api } from "../lib/api";

interface Settings {
  confirmation_enabled: boolean;
  reactivation_enabled: boolean;
  post_attendance_enabled: boolean;
  commercial_ai_enabled: boolean;
  inactivity_nudge_enabled: boolean;
  [key: string]: unknown;
}

export function SecretariaVirtual() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ clinic: Settings }>("/settings")
      .then((r) => setSettings(r.clinic))
      .catch((e) => setError(e.message));
  }, []);

  async function toggle(key: string) {
    if (!settings) return;
    const value = !settings[key];
    setSavingKey(key);
    setError(null);
    try {
      await api.patch("/settings", { clinic: { [key]: value } });
      setSettings({ ...settings, [key]: value });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Secretária Virtual</h1>
      <p className="page-subtitle">O que ela faz automaticamente pelo WhatsApp, sem você precisar acompanhar</p>

      {error && <div className="error-text">{error}</div>}

      {!settings ? (
        <div className="empty-state">Carregando...</div>
      ) : (
        <div className="card" style={{ padding: 0, maxWidth: 620 }}>
          <ToggleCard
            title="Confirmação de consultas"
            description="Pede confirmação pelo WhatsApp antes de cada consulta"
            checked={settings.confirmation_enabled}
            disabled={savingKey === "confirmation_enabled"}
            onToggle={() => toggle("confirmation_enabled")}
            adjustTo="/secretaria-virtual/confirmacao"
          />
          <ToggleCard
            title="Recuperar pacientes que sumiram"
            description="Retoma contato com quem ficou muito tempo sem aparecer"
            checked={settings.reactivation_enabled}
            disabled={savingKey === "reactivation_enabled"}
            onToggle={() => toggle("reactivation_enabled")}
            adjustTo="/secretaria-virtual/reativacao"
          />
          <ToggleCard
            title="Acompanhar depois da consulta"
            description="Manda mensagens de acompanhamento após o atendimento"
            checked={settings.post_attendance_enabled}
            disabled={savingKey === "post_attendance_enabled"}
            onToggle={() => toggle("post_attendance_enabled")}
            adjustTo="/secretaria-virtual/pos-consulta"
          />
          <ToggleCard
            title="Oportunidades comerciais"
            description="Acompanha quem demonstrou interesse mas ainda não fechou"
            checked={settings.commercial_ai_enabled}
            disabled={savingKey === "commercial_ai_enabled"}
            onToggle={() => toggle("commercial_ai_enabled")}
            adjustTo="/secretaria-virtual/oportunidades"
          />
          <ToggleCard
            title="Perguntas frequentes"
            description="Respostas que a IA usa para dúvidas comuns"
            adjustTo="/secretaria-virtual/faq"
            adjustLabel="Editar"
          />
          <ToggleCard
            title="Avisar quando o cliente some no meio da conversa"
            description="Pergunta se o cliente ainda está por aqui após alguns minutos sem resposta"
            checked={settings.inactivity_nudge_enabled}
            disabled={savingKey === "inactivity_nudge_enabled"}
            onToggle={() => toggle("inactivity_nudge_enabled")}
          />
        </div>
      )}
    </div>
  );
}
