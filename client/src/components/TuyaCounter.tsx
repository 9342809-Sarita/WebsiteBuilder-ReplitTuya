import React, { useEffect, useState } from "react";

type Snapshot = {
  total: number;
  devicesCount: number;
  statusCount: number;
  logsCount: number;
  sinceReset: number;
  resetAt: string | null;
  lastPingAt: string | null;
};

export default function TuyaCounter({ refreshMs = 5000 }: { refreshMs?: number }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [prev, setPrev] = useState<{ t: number; total: number } | null>(null);
  const [rate, setRate] = useState<string>("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/tuya/counters");
    const j: Snapshot = await r.json();
    const now = Date.now();
    if (prev) {
      const dtMin = Math.max((now - prev.t) / 60000, 0.001);
      const d = Math.max(j.total - prev.total, 0);
      setRate(`${(d / dtMin).toFixed(1)} / min`);
    }
    setPrev({ t: now, total: j.total });
    setSnap(j);
    setLoading(false);
  }

  async function onReset() {
    setMsg("Resetting…");
    const r = await fetch("/api/tuya/counters/reset", { method: "POST" });
    const j = await r.json();
    setSnap(j);
    setMsg("Reset!");
    setTimeout(() => setMsg(""), 1200);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  if (loading || !snap) return <div className="text-sm opacity-70">Tuya pings: loading…</div>;

  return (
    <div className="rounded-xl border p-3 flex flex-col gap-2 w-full md:w-auto">
      <div className="text-sm font-semibold">Tuya API Pings</div>
      <div className="text-2xl font-bold">{snap.total.toLocaleString()}</div>
      {rate && <div className="text-sm text-muted-foreground">{rate}</div>}
      <div className="text-xs opacity-80">
        <div>Devices list: {snap.devicesCount}</div>
        <div>Status: {snap.statusCount}</div>
        <div>Logs: {snap.logsCount}</div>
        <div className="mt-1">Since reset: {snap.sinceReset}</div>
        {snap.lastPingAt && <div>Last: {new Date(snap.lastPingAt).toLocaleString()}</div>}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button className="px-3 py-1 rounded bg-black text-white" onClick={onReset}>Reset</button>
        <span className="text-xs">{msg}</span>
      </div>
    </div>
  );
}