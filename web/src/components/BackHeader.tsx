import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "./icons";

interface Props {
  title: string;
  subtitle?: string;
  backTo: string;
}

/** Cabecalho de tela "drill-down" (voltar + titulo + subtitulo), mesmo padrao ja usado em PatientDetail.tsx. */
export function BackHeader({ title, subtitle, backTo }: Props) {
  const navigate = useNavigate();
  return (
    <div style={{ marginBottom: 4 }}>
      <button className="mobile-icon-btn" style={{ marginBottom: 10, marginLeft: -8 }} onClick={() => navigate(backTo)}>
        <ArrowLeftIcon />
      </button>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}
