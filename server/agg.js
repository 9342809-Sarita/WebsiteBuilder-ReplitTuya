export function aggregateSeries(resp) {
  // Expect { series: [{deviceId, points:[{t,kWh}]}], granularity, tz }
  // Ensure unique time keys and add combined totals
  const g = resp?.granularity || "day";
  const tz = resp?.tz || "Asia/Kolkata";
  const series = Array.isArray(resp?.series) ? resp.series : [];

  const map = new Map(); // t -> sum kWh
  for (const s of series) {
    for (const p of s.points || []) {
      const key = p.t;
      map.set(key, (map.get(key) || 0) + (Number(p.kWh) || 0));
    }
  }
  const combined = [...map.entries()].sort(([a],[b]) => a.localeCompare(b))
    .map(([t, kWh]) => ({ t, kWh }));

  return { granularity: g, tz, series, combined };
}