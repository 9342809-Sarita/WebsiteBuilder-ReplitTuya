import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";

interface ChartPanelProps {
  resp: any;
  gran: "day" | "month" | "year";
}

export default function ChartPanel({ resp, gran }: ChartPanelProps) {
  const combined = resp?.combined || [];
  const series = resp?.series || [];

  const data = useMemo(() => {
    // Merge series into recharts rows keyed by t
    const rows = new Map();
    for (const s of series) {
      for (const p of s.points || []) {
        const key = p.t;
        const row = rows.get(key) || { t: key };
        row[s.deviceId] = (row[s.deviceId] || 0) + (Number(p.kWh)||0);
        rows.set(key, row);
      }
    }
    // Also include combined for stacked/total
    for (const p of combined) {
      const row = rows.get(p.t) || { t: p.t };
      row.total = p.kWh;
      rows.set(p.t, row);
    }
    return Array.from(rows.values()).sort((a: any, b: any) => a.t.localeCompare(b.t));
  }, [series, combined]);

  const Chart = gran === "day" ? AreaChart : BarChart;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={360}>
        <Chart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <XAxis dataKey="t" />
          <YAxis />
          <Tooltip />
          <Legend />
          {gran === "day" ? 
            <Area dataKey="total" type="monotone" fillOpacity={0.3} /> : 
            <Bar dataKey="total" /> 
          }
        </Chart>
      </ResponsiveContainer>
      <small>Units: kWh per bucket; bucket = hour (Day), day (Month), month (Year).</small>
    </div>
  );
}