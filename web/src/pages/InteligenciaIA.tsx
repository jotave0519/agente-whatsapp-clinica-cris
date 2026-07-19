import { useState } from "react";
import { Procedimentos } from "./Procedimentos";
import { ConfirmacaoAutomatica } from "./configuracoesIA/ConfirmacaoAutomatica";
import { FaqInteligente } from "./configuracoesIA/FaqInteligente";
import { InformacoesClinica } from "./configuracoesIA/InformacoesClinica";
import { MensagensAutomaticas } from "./configuracoesIA/MensagensAutomaticas";
import { RegrasIA } from "./configuracoesIA/RegrasIA";

type IaTab = "informacoes" | "mensagens" | "confirmacao" | "faq" | "procedimentos" | "regras";

const IA_TABS: { id: IaTab; label: string }[] = [
  { id: "informacoes", label: "Informações da Clínica" },
  { id: "mensagens", label: "Mensagens automáticas" },
  { id: "confirmacao", label: "Confirmação automática" },
  { id: "faq", label: "FAQ Inteligente" },
  { id: "procedimentos", label: "Procedimentos" },
  { id: "regras", label: "Regras da IA" },
];

function IaTabContent({ tab }: { tab: IaTab }) {
  switch (tab) {
    case "informacoes":
      return <InformacoesClinica />;
    case "mensagens":
      return <MensagensAutomaticas />;
    case "confirmacao":
      return <ConfirmacaoAutomatica />;
    case "faq":
      return <FaqInteligente />;
    case "procedimentos":
      return <Procedimentos embedded />;
    case "regras":
      return <RegrasIA />;
  }
}

export function InteligenciaIA() {
  const [iaTab, setIaTab] = useState<IaTab>("informacoes");

  return (
    <div>
      <h1 className="page-title">Inteligência da IA</h1>
      <p className="page-subtitle">Base de conhecimento que a IA usa nos atendimentos do WhatsApp</p>

      <div className="tab-nav">
        {IA_TABS.map((t) => (
          <span key={t.id} className={`tab-nav-item${iaTab === t.id ? " active" : ""}`} onClick={() => setIaTab(t.id)}>
            {t.label}
          </span>
        ))}
      </div>

      <IaTabContent tab={iaTab} />
    </div>
  );
}
