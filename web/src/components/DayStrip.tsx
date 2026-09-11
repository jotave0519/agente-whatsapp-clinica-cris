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
            <span className={`day-strip-weekday${isToday ? " is-today" : ""}`}>{WEEKDAY_LABELS[(d.getDay() + 6) % 7]}</span>
            <span className={`day-strip-number${isToday ? " is-today" : ""}`}>{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
