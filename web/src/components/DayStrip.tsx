const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Props {
  days: Date[];
  selected: Date;
  onSelect: (d: Date) => void;
}

export function DayStrip({ days, selected, onSelect }: Props) {
  const todayStr = toDateStr(new Date());
  const selectedStr = toDateStr(selected);

  return (
    <div className="day-strip">
      {days.map((d) => {
        const dateStr = toDateStr(d);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedStr;
        return (
          <button key={dateStr} className={`day-strip-chip${isSelected ? " active" : ""}`} onClick={() => onSelect(d)}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".03em", textTransform: "uppercase", color: isSelected ? "inherit" : isToday ? "var(--accent)" : "var(--text-faint)" }}>
              {WEEKDAY_LABELS[(d.getDay() + 6) % 7]}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{d.getDate()}</div>
          </button>
        );
      })}
    </div>
  );
}
