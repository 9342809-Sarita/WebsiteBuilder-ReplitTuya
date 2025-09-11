import { useState } from "react";
import { getDebugLastSample } from "../lib/api";

type Props = { deviceId: string };

export default function DebugPanel({ deviceId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | "all" | "live">(null);
  
  // helper
  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      return false;
    }
  }

  async function refresh() {
    if (!deviceId) return;
    setLoading(true); setErr(null);
    try {
      const resp = await getDebugLastSample(deviceId, live);
      setData(resp);
    } catch (e:any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  function percentDiff(a?: number|null, b?: number|null) {
    if (a==null || b==null || a===0) return null;
    return Math.round(((b - a) / a) * 100);
  }

  function DiffBadge({ diff }: { diff: number | null }) {
    if (diff == null) return <span className="text-xs opacity-60">—</span>;
    const abs = Math.abs(diff);
    let cls = "bg-green-100 text-green-700";
    if (abs > 5 && abs <= 15) cls = "bg-yellow-100 text-yellow-800";
    if (abs > 15) cls = "bg-red-100 text-red-700";
    return (
      <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
        {abs}% diff
      </span>
    );
  }

  // quick check: W_est = V * A * PF
  const W_est = (() => {
    const v = data?.db?.health?.voltageV ?? null;
    const a = data?.db?.health?.currentA ?? null;
    const pf = data?.db?.health?.pfResolved ?? data?.db?.health?.pfTuya ?? data?.db?.health?.pfEst ?? null;
    if (v==null || a==null || pf==null) return null;
    return Math.round(v * a * pf);
  })();

  const W_meas = data?.db?.health?.powerW ?? null;
  const diff = percentDiff(W_meas, W_est);

  return (
    <div className="mt-3 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Debug Panel</div>
        <div className="flex items-center gap-2">
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} />
            Live Tuya
          </label>
          <button className="px-2 py-1 border rounded" onClick={refresh} disabled={!deviceId || loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button
            className="px-2 py-1 border rounded"
            onClick={async () => {
              if (!data) return;
              const ok = await copyText(JSON.stringify(data, null, 2));
              setCopied(ok ? "all" : null);
              setTimeout(() => setCopied(null), 1200);
            }}
            disabled={!data || loading}
            title="Copy combined DB+Live JSON"
          >
            Copy JSON
          </button>
          {copied && <span className="text-xs opacity-70 ml-2">Copied!</span>}
          <button className="px-2 py-1 border rounded" onClick={() => setOpen(o => !o)}>
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="text-sm mb-2 opacity-70">DB Snapshot</div>
            {err && <div className="text-red-600 text-sm">{err}</div>}
            {!data ? (
              <div className="text-sm opacity-60">No data yet. Click Refresh.</div>
            ) : (
              <table className="text-sm w-full">
                <tbody>
                  <tr><td className="pr-3">Time</td><td>{data.db?.health?.ts || "—"}</td></tr>
                  <tr><td>Voltage</td><td><code className="font-mono tabular-nums">{data.db?.health?.voltageV ?? "—"}</code> V</td></tr>
                  <tr><td>Current</td><td><code className="font-mono tabular-nums">{data.db?.health?.currentA ?? "—"}</code> A</td></tr>
                  <tr><td>Power</td><td><code className="font-mono tabular-nums">{W_meas ?? "—"}</code> W</td></tr>
                  <tr><td>PF (resolved)</td><td><code className="font-mono tabular-nums">{data.db?.health?.pfResolved ? data.db.health.pfResolved.toFixed(2) : "—"}</code></td></tr>
                  <tr><td>PF (tuya)</td><td><code className="font-mono tabular-nums">{data.db?.health?.pfTuya ? data.db.health.pfTuya.toFixed(2) : "—"}</code></td></tr>
                  <tr><td>PF (estimated)</td><td><code className="font-mono tabular-nums">{data.db?.health?.pfEst ? data.db.health.pfEst.toFixed(2) : "—"}</code></td></tr>
                  <tr><td className="pt-2">Sanity W ≈ V·A·PF</td>
                      <td className="pt-2">
                        <div className="flex items-center">
                          <span><code className="font-mono tabular-nums">{W_est ?? "—"}</code> W</span>
                          <DiffBadge diff={diff} />
                        </div>
                      </td></tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded border p-3">
            <div className="text-sm mb-2 opacity-70">Energy Increment</div>
            {data?.db?.energy ? (
              <table className="text-sm w-full">
                <tbody>
                  <tr><td className="pr-3">Time</td><td>{data.db.energy.ts}</td></tr>
                  <tr><td>addEleKwh</td><td><code className="font-mono tabular-nums">{data.db.energy.addEleKwh}</code> kWh</td></tr>
                </tbody>
              </table>
            ) : <div className="text-sm opacity-60">No energy row</div>}
          </div>

          {live && (
            <div className="rounded border p-3 md:col-span-2">
              <div className="text-sm mb-2 opacity-70">Live Tuya Status</div>
              {data?.live?.error ? (
                <div className="text-red-600 text-sm">Fetch failed</div>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={async () => {
                        const liveBlob = JSON.stringify(data?.live ?? {}, null, 2);
                        const ok = await copyText(liveBlob);
                        setCopied(ok ? "live" : null);
                        setTimeout(() => setCopied(null), 1200);
                      }}
                      disabled={!data?.live}
                      title="Copy only the Live Tuya JSON"
                    >
                      Copy Live JSON
                    </button>
                    {copied === "live" && <span className="text-xs opacity-70">Copied!</span>}
                  </div>
                  <pre className="text-xs overflow-auto max-h-64 bg-gray-50 p-2 rounded">
                    {JSON.stringify(data?.live, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}