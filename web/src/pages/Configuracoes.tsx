import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { MoonIcon, SunIcon } from "../components/icons";
import { Procedimentos } from "./Procedimentos";
import { FaqInteligente } from "./configuracoesIA/FaqInteligente";
import { HorariosClinica } from "./configuracoesIA/HorariosClinica";
import { InformacoesClinica } from "./configuracoesIA/InformacoesClinica";
import { MensagensAutomaticas } from "./configuracoesIA/MensagensAutomaticas";
import { RegrasIA } from "./configuracoesIA/RegrasIA";

type MainTab = "geral" | "ia";
type IaTab = "informacoes" | "mensagens" | "faq" | "procedimentos" | "horarios" | "regras";

const IA_TABS: { id: IaTab; label: string }[] = [
  { id: "informacoes", label: "Informações da Clínica" },
  { id: "mensagens", label: "Mensagens automáticas" },
  { id: "faq", label: "FAQ Inteligente" },
  { id: "procedimentos", label: "Procedimentos" },
  { id: "horarios", label: "Horários da clínica" },
  { id: "regras", label: "Regras da IA" },
];

function GeralTab() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Preferências</div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>Preferência salva neste dispositivo, aplicada instantaneamente</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>Tema da plataforma</span>
        <div className="segmented">
          <span
            className={`segmented-item${theme === "light" ? " active" : ""}`}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setTheme("light")}
          >
            <SunIcon width={14} height={14} /> Light
          </span>
          <span
            className={`segmented-item${theme === "dark" ? " active" : ""}`}
            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => setTheme("dark")}
          >
            <MoonIcon width={14} height={14} /> Dark
          </span>
        </div>
      </div>
    </div>
  );
}

function IaTabContent({ tab }: { tab: IaTab }) {
  switch (tab) {
    case "informacoes":
      return <InformacoesClinica />;
    case "mensagens":
      return <MensagensAutomaticas />;
    case "faq":
      return <FaqInteligente />;
    case "procedimentos":
      return <Procedimentos embedded />;
    case "horarios":
      return <HorariosClinica />;
    case "regras":
      return <RegrasIA />;
  }
}

export function Configuracoes() {
  const [mainTab, setMainTab] = useState<MainTab>("geral");
  const [iaTab, setIaTab] = useState<IaTab>("informacoes");

  return (
    <div>
      <h1 className="page-title">Configurações</h1>
      <p className="page-subtitle">Gerencie as preferências da clínica e a base de conhecimento da IA</p>

      <div className="tab-nav">
        <span className={`tab-nav-item${mainTab === "geral" ? " active" : ""}`} onClick={() => setMainTab("geral")}>
          Geral
        </span>
        <span className={`tab-nav-item${mainTab === "ia" ? " active" : ""}`} onClick={() => setMainTab("ia")}>
          Inteligência da IA
        </span>
      </div>

      {mainTab === "geral" && <GeralTab />}

      {mainTab === "ia" && (
        <div>
          <div className="tab-nav">
            {IA_TABS.map((t) => (
              <span key={t.id} className={`tab-nav-item${iaTab === t.id ? " active" : ""}`} onClick={() => setIaTab(t.id)}>
                {t.label}
              </span>
            ))}
          </div>
          <IaTabContent tab={iaTab} />
        </div>
      )}
    </div>
  );
}
