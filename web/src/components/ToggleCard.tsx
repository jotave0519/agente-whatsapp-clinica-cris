import { Link } from "react-router-dom";

interface Props {
  title: string;
  description: string;
  checked?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  adjustTo?: string;
  adjustLabel?: string;
}

/** Card com switch grande + descricao curta + link opcional "Ajustar" - a unidade visual basica do hub Secretaria Virtual. */
export function ToggleCard({ title, description, checked, onToggle, disabled, adjustTo, adjustLabel = "Ajustar" }: Props) {
  return (
    <div className="toggle-card">
      <div style={{ flex: 1 }}>
        <div className="toggle-card-title">{title}</div>
        <div className="toggle-card-desc">{description}</div>
      </div>
      {adjustTo && (
        <Link to={adjustTo} className="toggle-card-adjust">
          {adjustLabel}
        </Link>
      )}
      {onToggle && (
        <label className="switch">
          <input type="checkbox" checked={!!checked} disabled={disabled} onChange={onToggle} />
          <span className="switch-track" />
        </label>
      )}
    </div>
  );
}
