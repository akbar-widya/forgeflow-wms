import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { MovementTrendResponse } from "@forgeflow/contracts";

type ChartTooltipProps = {
  active?: boolean;
  payload?: Array<{ dataKey: string; name?: string; value: number; color: string }>;
  label?: string;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  return (
    <div className="rounded-[4px] border border-border bg-card px-3 py-2 text-xs shadow-none">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="mt-1 flex items-center gap-2">
          <span
            className="inline-block size-2 shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-4 font-mono font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MovementTrendChart({ data }: { data: MovementTrendResponse }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.days} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#52c41a" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#52c41a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="outboundFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4d4f" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#ff4d4f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8c8c8c", fontSize: 11 }}
            axisLine={{ stroke: "#f0f0f0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8c8c8c", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#f0f0f0" }} />
          <Area
            type="monotone"
            dataKey="inbound"
            name="Inbound"
            stroke="#52c41a"
            strokeWidth={2}
            fill="url(#inboundFill)"
          />
          <Area
            type="monotone"
            dataKey="outbound"
            name="Outbound"
            stroke="#ff4d4f"
            strokeWidth={2}
            fill="url(#outboundFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
