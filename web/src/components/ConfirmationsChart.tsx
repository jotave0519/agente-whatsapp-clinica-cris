import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface ConfirmationsPoint {
  label: string;
  confirmed: number;
  cancelled: number;
  rescheduled: number;
}

interface Props {
  data: ConfirmationsPoint[];
}

const SERIES = [
  { key: "confirmed", name: "Confirmações", color: "var(--green)" },
  { key: "cancelled", name: "Cancelamentos", color: "var(--red)" },
  { key: "rescheduled", name: "Remarcações", color: "var(--blue)" },
] as const;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ fontSize: 12.5, fontWeight: 600, color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

/** Grafico do Dashboard: Confirmacoes/Cancelamentos/Remarcacoes nos ultimos 30 dias, mesmo padrao visual de RevenueChart.tsx. */
export function ConfirmationsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border-soft)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--text-faint)" }} interval="preserveStartEnd" />
        <YAxis hide allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {SERIES.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
