import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface Segment {
  label: string;
  value: number;
  color?: string;
}

interface MiniDonutChartProps {
  segments: Segment[];
  size?: number;
}

const DEFAULT_COLORS = [
  "var(--success)",
  "var(--accent)",
  "var(--warning)",
  "var(--danger)",
  "var(--text-muted)",
];

export function MiniDonutChart({ segments, size = 120 }: MiniDonutChartProps) {
  const filtered = segments.filter((s) => s.value > 0);
  if (filtered.length === 0) return null;

  const data = filtered.map((seg, i) => ({
    name: seg.label,
    value: seg.value,
    fill: seg.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  return (
    <div className="mini-donut-chart" style={{ width: size, height: size + 40 }}>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="90%"
            paddingAngle={1}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke="var(--bg)" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => value.toLocaleString()}
            contentStyle={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}
          />
          <Legend
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
            iconSize={8}
            iconType="circle"
            formatter={(value) => {
              const item = data.find((d) => d.name === value);
              return `${value}: ${(item?.value ?? 0).toLocaleString()}`;
            }}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
