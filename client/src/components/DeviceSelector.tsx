import React, { useEffect, useState } from "react";

type UiDevice = { deviceId: string; name: string; online: boolean };

export default function DeviceSelector(props: {
  value?: string;
  onChange: (id: string) => void;
}) {
  const [devices, setDevices] = useState<UiDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        // IMPORTANT: relative path so it works in dev/prod
        const r = await fetch("/api/devices/ui");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (mounted) setDevices(Array.isArray(data.devices) ? data.devices : []);
      } catch (e: any) {
        if (mounted) setErr(e?.message || String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div>Loading devices…</div>;
  if (err) return <div className="text-red-600">Failed to load devices: {err}</div>;
  if (!devices.length) return <div>No devices found.</div>;

  return (
    <div className="flex flex-col gap-2">
      <label className="font-medium">Device Selection</label>
      <select
        className="border rounded px-2 py-1"
        value={props.value || ""}
        onChange={e => props.onChange(e.target.value)}
      >
        <option value="" disabled>Select a device…</option>
        {devices.map(d => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.name} {d.online ? "" : "(offline)"}
          </option>
        ))}
      </select>
    </div>
  );
}