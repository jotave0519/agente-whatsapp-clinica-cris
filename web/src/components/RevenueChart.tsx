import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface RevenuePoint {
  label: string;
  value: number;
}

interface Props {
  data: RevenuePoint[];
}

function formatMoney(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

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
      <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{formatMoney(payload[0].value)}</div>
    </div>
  );
}

/**
 * Grafico de faturamento usado no Dashboard. Sempre renderiza o eixo e a
 * area/linha mesmo com poucos pontos ou todos os valores zerados (o backend
 * ja preenche os 12 meses com zero quando nao ha faturamento, entao isso
 * aparece naturalmente como uma linha reta em zero, nunca como area vazia).
 */
export function RevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border-soft)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10.5, fill: "var(--text-faint)" }}
          interval="preserveStartEnd"
        />
        <YAxis hide domain={[0, (max: number) => (max <= 0 ? 10 : max * 1.15)]} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          isAnimationActive
          animationDuration={700}
          dot={data.length <= 1 ? { r: 4, fill: "var(--accent)", strokeWidth: 0 } : false}
          activeDot={{ r: 5, fill: "var(--accent)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
