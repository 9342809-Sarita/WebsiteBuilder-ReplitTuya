import React from "react";

type PollerSettings = {
  energyEnabled: boolean;
  energyIntervalMs: number;
  healthEnabled: boolean;
  healthIntervalMs: number;
  dashboardRefreshEnabled: boolean;
  dashboardRefreshMs: number;
  masterKillSwitch: boolean;
};

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<PollerSettings | null>(null);
  const [msg, setMsg] = React.useState<string>("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/pollers/settings");
    const s = await r.json();
    setSettings(s);
    setLoading(false);
  }
  React.useEffect(() => { load(); }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMsg("");
    const r = await fetch("/api/pollers/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const s = await r.json();
    setSettings(s);
    setSaving(false);
    setMsg("Saved!");
    setTimeout(() => setMsg(""), 1500);
  }

  async function ping(type: "health" | "energy") {
    setMsg(`Pinging ${type}...`);
    const r = await fetch(`/api/pollers/ping-now?type=${type}`, { method: "POST" });
    const j = await r.json();
    if (j.ok) setMsg(`Pinged ${type}: ${j.devices ?? 0} device(s) updated`);
    else setMsg(`Ping failed: ${j.error || "unknown"}`);
  }

  if (loading || !settings) return <div className="p-4">Loading…</div>;

  // helpers to show seconds/minutes in the UI
  const sec = (ms: number) => Math.round(ms / 1000);
  const min = (ms: number) => Math.round(ms / 60000);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-semibold">Polling Settings</h1>

      {/* Health Poller */}
      <section className="p-4 rounded-xl border">
        <h2 className="text-lg font-medium">Health Poller</h2>
        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={settings.healthEnabled}
            onChange={(e) => setSettings({ ...settings, healthEnabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>

        <div className="mt-3">
          <label className="block text-sm mb-1">Interval (seconds)</label>
          <input
            type="number"
            value={sec(settings.healthIntervalMs)}
            onChange={(e) =>
              setSettings({ ...settings, healthIntervalMs: Number(e.target.value) * 1000 })
            }
            className="border rounded px-2 py-1 w-40"
          />
        </div>

        {!settings.healthEnabled && (
          <button
            onClick={() => ping("health")}
            className="mt-3 px-3 py-2 rounded bg-black text-white"
          >
            Ping now (Health)
          </button>
        )}
      </section>

      {/* Energy Poller */}
      <section className="p-4 rounded-xl border">
        <h2 className="text-lg font-medium">Energy Poller</h2>
        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={settings.energyEnabled}
            onChange={(e) => setSettings({ ...settings, energyEnabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>

        <div className="mt-3">
          <label className="block text-sm mb-1">Interval (minutes)</label>
          <input
            type="number"
            value={min(settings.energyIntervalMs)}
            onChange={(e) =>
              setSettings({ ...settings, energyIntervalMs: Number(e.target.value) * 60000 })
            }
            className="border rounded px-2 py-1 w-40"
          />
        </div>

        {!settings.energyEnabled && (
          <button
            onClick={() => ping("energy")}
            className="mt-3 px-3 py-2 rounded bg-black text-white"
          >
            Ping now (Energy)
          </button>
        )}
      </section>

      {/* Dashboard refresh */}
      <section className="p-4 rounded-xl border">
        <h2 className="text-lg font-medium">Live Dashboard Refresh</h2>
        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={settings.dashboardRefreshEnabled}
            onChange={(e) => setSettings({ ...settings, dashboardRefreshEnabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>

        <div className="mt-3">
          <label className="block text-sm mb-1">Refresh interval (seconds)</label>
          <input
            type="number"
            value={sec(settings.dashboardRefreshMs)}
            onChange={(e) =>
              setSettings({ ...settings, dashboardRefreshMs: Number(e.target.value) * 1000 })
            }
            className="border rounded px-2 py-1 w-40"
          />
        </div>
      </section>

      {/* Master Kill Switch */}
      <section className="p-4 rounded-xl border border-red-200 bg-red-50">
        <h2 className="text-lg font-medium text-red-700">Master Kill Switch</h2>
        <p className="text-sm text-red-600 mt-1">Disables ALL Tuya API traffic when enabled</p>
        <label className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            checked={settings.masterKillSwitch}
            onChange={(e) => setSettings({ ...settings, masterKillSwitch: e.target.checked })}
          />
          <span className="font-medium">Disable all Tuya traffic</span>
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={saving}
          onClick={save}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <span className="text-sm">{msg}</span>
      </div>
    </div>
  );
}