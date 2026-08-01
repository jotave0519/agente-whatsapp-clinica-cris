import { useEffect, useState } from "react";
import { ToggleCard } from "../components/ToggleCard";
import { api } from "../lib/api";

interface Settings {
  confirmation_enabled: boolean;
  reactivation_enabled: boolean;
  post_attendance_enabled: boolean;
  commercial_ai_enabled: boolean;
  inactivity_nudge_enabled: boolean;
  cancellation_notify_enabled: boolean;
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
            description="Pede confirmação pelo WhatsApp antes de cada consulta e avisa a clínica quando o paciente confirma, remarca ou não responde."
            help="A IA envia automaticamente um pedido de confirmação alguns dias antes da consulta. Se o paciente confirmar, o agendamento é marcado como confirmado na Agenda. Se ele pedir para remarcar ou não responder no prazo, a clínica é avisada para agir. Isso reduz faltas e mantém a agenda sempre atualizada."
            checked={settings.confirmation_enabled}
            disabled={savingKey === "confirmation_enabled"}
            onToggle={() => toggle("confirmation_enabled")}
            adjustTo="/secretaria-virtual/confirmacao"
          />
          <ToggleCard
            title="Notificar cancelamentos feitos pela clínica"
            description="Quando um agendamento for cancelado manualmente pela clínica, a IA avisa o paciente pelo WhatsApp e oferece remarcar."
            help="Quando a doutora cancela uma consulta pela Agenda, a IA envia automaticamente uma mensagem ao paciente informando o cancelamento (com o motivo, se um foi informado) e oferecendo remarcar direto pelo WhatsApp. Desativar isso não muda nada no cancelamento em si — só impede o disparo dessa mensagem automática; o Calendar e o CRM continuam sendo atualizados normalmente."
            checked={settings.cancellation_notify_enabled}
            disabled={savingKey === "cancellation_notify_enabled"}
            onToggle={() => toggle("cancellation_notify_enabled")}
          />
          <ToggleCard
            title="Recuperar pacientes que sumiram"
            description="Identifica pacientes que não retornam há um tempo e inicia uma campanha personalizada de reativação pelo WhatsApp."
            help="Com base no tempo de inatividade que você define (ex: 60 dias sem consulta), a IA seleciona os pacientes do perfil escolhido e envia mensagens no tom configurado, espalhadas ao longo dos dias para não parecer spam. Ela registra quem respondeu, remarcou ou não teve interesse, e nunca contata quem já tem consulta futura ou pediu para não ser contatado."
            checked={settings.reactivation_enabled}
            disabled={savingKey === "reactivation_enabled"}
            onToggle={() => toggle("reactivation_enabled")}
            adjustTo="/secretaria-virtual/reativacao"
          />
          <ToggleCard
            title="Acompanhar depois da consulta"
            description="Envia mensagens após o atendimento perguntando como o paciente está e alerta a clínica em caso de dor, desconforto ou qualquer problema relatado."
            help="Algumas horas depois da consulta (o prazo é configurável), a IA manda uma mensagem perguntando como o paciente está se sentindo. A resposta fica registrada no histórico do paciente. Se ele relatar dor, reação ou insatisfação, a clínica recebe um alerta para entrar em contato o quanto antes."
            checked={settings.post_attendance_enabled}
            disabled={savingKey === "post_attendance_enabled"}
            onToggle={() => toggle("post_attendance_enabled")}
            adjustTo="/secretaria-virtual/pos-consulta"
          />
          <ToggleCard
            title="Oportunidades comerciais"
            description="Acompanha pacientes que demonstraram interesse em um procedimento mas ainda não fecharam, e retoma contato para aumentar a conversão."
            help="Sempre que a IA percebe, numa conversa, que um paciente se interessou por um procedimento sem agendar, ela cria uma oportunidade no Kanban. A partir daí, envia mensagens de follow-up nos intervalos configurados até o paciente agendar, recusar, ou a oportunidade expirar — sem precisar de nenhuma ação manual da recepção."
            checked={settings.commercial_ai_enabled}
            disabled={savingKey === "commercial_ai_enabled"}
            onToggle={() => toggle("commercial_ai_enabled")}
            adjustTo="/secretaria-virtual/oportunidades"
          />
          <ToggleCard
            title="Perguntas frequentes"
            description="Respostas prontas que a IA consulta antes de responder dúvidas comuns dos pacientes, como preço, funcionamento e preparo."
            help="Toda vez que um paciente pergunta algo pelo WhatsApp, a IA verifica primeiro se a pergunta bate com alguma cadastrada aqui. Se bater, ela responde com o texto exato que você escreveu — garantindo que informações sensíveis (preço, contraindicações etc.) sejam sempre respondidas do jeito que a clínica aprovou."
            adjustTo="/secretaria-virtual/faq"
            adjustLabel="Editar"
          />
          <ToggleCard
            title="Avisar quando o cliente some no meio da conversa"
            description="Pergunta gentilmente se o paciente ainda está por aqui quando ele para de responder no meio de um atendimento, evitando abandonos silenciosos."
            help="Se um paciente parar de responder no meio de uma conversa (por exemplo, durante um agendamento), a IA aguarda alguns minutos e envia uma mensagem perguntando se ele ainda está por aí. Isso ajuda a recuperar conversas que ficariam paradas e reduz agendamentos abandonados pela metade."
            checked={settings.inactivity_nudge_enabled}
            disabled={savingKey === "inactivity_nudge_enabled"}
            onToggle={() => toggle("inactivity_nudge_enabled")}
          />
        </div>
      )}
    </div>
  );
}
