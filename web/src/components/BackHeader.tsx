import { useNavigate } from "react-router-dom";
import { InfoTooltip } from "./InfoTooltip";
import { ArrowLeftIcon } from "./icons";

interface Props {
  title: string;
  subtitle?: string;
  backTo: string;
  help?: string;
}

/** Cabecalho de tela "drill-down" (voltar + titulo + subtitulo), mesmo padrao ja usado em PatientDetail.tsx. */
export function BackHeader({ title, subtitle, backTo, help }: Props) {
  const navigate = useNavigate();
  return (
    <div style={{ marginBottom: 4 }}>
      <button className="mobile-icon-btn" style={{ marginBottom: 10, marginLeft: -8 }} onClick={() => navigate(backTo)}>
        <ArrowLeftIcon />
      </button>
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {title}
        {help && <InfoTooltip title={title} text={help} />}
      </h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}
