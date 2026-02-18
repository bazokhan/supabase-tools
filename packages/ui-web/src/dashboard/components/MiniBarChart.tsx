import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { BadgeTone } from "./Badge";

interface BarItem {
  label: string;
  value: number;
  tone?: BadgeTone;
}

interface MiniBarChartProps {
  data: BarItem[];
  maxBars?: number;
  height?: number;
  yAxisWidth?: number;
}

const TONE_COLORS: Record<string, string> = {
  good: "var(--success)",
  warn: "var(--warning)",
  bad: "var(--danger)",
  accent: "var(--accent)",
  default: "var(--text-muted)",
};

export function MiniBarChart({ data, maxBars = 8, height = 140, yAxisWidth = 132 }: MiniBarChartProps) {
  const display = data.slice(0, maxBars).map((item) => ({
    name: item.label.length > 20 ? `${item.label.slice(0, 18)}...` : item.label,
    fullName: item.label,
    value: item.value,
    fill: TONE_COLORS[item.tone ?? "default"] ?? TONE_COLORS.default,
  }));

  if (display.length === 0) return null;

  return (
    <div style={{ width: "100%", height }} className="mini-bar-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={display} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={yAxisWidth} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-soft)" }}
            contentStyle={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}
            labelFormatter={(label, payload) => {
              const first = payload?.[0]?.payload as { fullName?: string } | undefined;
              return first?.fullName ?? String(label);
            }}
            formatter={(value: number) => [value.toLocaleString(), ""]}
          />
          <Bar dataKey="value" radius={[0, 2, 2, 0]} maxBarSize={24}>
            {display.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
