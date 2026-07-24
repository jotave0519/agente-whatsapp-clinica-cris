export interface TimelineItem {
  type: "schedule_event" | "payment" | "note" | "goal" | "media" | "document" | "manual";
  title: string;
  detail: string | null;
  occurred_at: string;
}

const TYPE_COLOR: Record<TimelineItem["type"], string> = {
  schedule_event: "var(--blue)",
  payment: "var(--green)",
  note: "var(--yellow)",
  goal: "var(--accent)",
  media: "var(--accent)",
  document: "var(--neutral)",
  manual: "var(--red)",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return <div className="empty-state">Nenhum evento registrado ainda.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 12, padding: "10px 2px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 10px" }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: TYPE_COLOR[item.type], marginTop: 4, flexShrink: 0 }} />
            {i < items.length - 1 && <div style={{ width: 1, flex: 1, background: "var(--border-soft)", marginTop: 4 }} />}
          </div>
          <div style={{ flex: 1, paddingBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.title}</div>
            {item.detail && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{item.detail}</div>}
            <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>{formatDateTime(item.occurred_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
