import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Database, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type Summary = {
  ok: boolean;
  global: {
    rawHealthCount: number | null;
    rawEnergyCount: number | null;
    rawHealthLast10m: number | null;
    rawEnergyLast10m: number | null;
    nowUtc: string;
  };
  devices: Array<{
    deviceId: string;
    name: string;
    lastHealthTs: string | null;
    lastEnergyTs: string | null;
    lastPowerW: number | null;
    lastVoltageV: number | null;
    lastCurrentA: number | null;
    lastAddEleKwh: number | null;
    _errors?: { lastHealth?: string | null; lastEnergy?: string | null };
  }>;
  errors?: Record<string, string>;
};

type TailRow = {
  table: "RawHealth" | "RawEnergy";
  tsUtc: string;
  deviceId: string;
  powerW?: number | null;
  voltageV?: number | null;
  currentA?: number | null;
  pfEst?: number | null;
  addEleKwh?: number | null;
};

export default function MonitorPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tail, setTail] = useState<TailRow[]>([]);
  const [schema, setSchema] = useState<any>(null);
  const [selftest, setSelftest] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Auto-refresh every 5s
  useEffect(() => {
    let timer: any;

    const tick = async () => {
      try {
        setErr(null);
        const [sRes, tRes, schRes, stRes] = await Promise.all([
          fetch("/api/monitor/ingest-summary"),
          fetch("/api/monitor/latest?limit=50"),
          fetch("/api/monitor/schema"),
          fetch("/api/monitor/selftest"),
        ]);
        
        const s = await sRes.json();
        const t = await tRes.json();
        const sch = await schRes.json();
        const st = await stRes.json();
        
        setSummary(s);
        setTail(t.rows ?? []);
        setSchema(sch);
        setSelftest(st);
        setLastUpdate(new Date());
      } catch (e: any) {
        setErr(e?.message || String(e));
      } finally {
        timer = setTimeout(tick, 5000);
      }
    };

    tick();
    return () => clearTimeout(timer);
  }, []);

  const ErrorChip = ({ text }: { text: string }) => (
    <span className="inline-block bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs px-2 py-1 rounded mr-2 font-mono">
      {text.length > 50 ? text.substring(0, 47) + "..." : text}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back to Home</span>
                </button>
              </Link>
              <div className="h-6 border-l border-gray-300 dark:border-gray-600" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Database className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <span>Data Monitor</span>
              </h1>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {err && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
            <CardContent className="pt-4">
              <div className="text-red-600 dark:text-red-400">Network error: {err}</div>
            </CardContent>
          </Card>
        )}

        {/* Global Stats */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Global Statistics</span>
                {!summary.ok && <span className="text-red-500 text-sm font-normal">(Some errors)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300">RawHealth Rows</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {summary.global.rawHealthCount !== null ? summary.global.rawHealthCount.toLocaleString() : "-"}
                  </div>
                  {summary.errors?.rawHealthCount && <ErrorChip text={summary.errors.rawHealthCount} />}
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/50 dark:to-green-800/50 rounded-lg p-4 border border-green-200 dark:border-green-700">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">RawEnergy Rows</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {summary.global.rawEnergyCount !== null ? summary.global.rawEnergyCount.toLocaleString() : "-"}
                  </div>
                  {summary.errors?.rawEnergyCount && <ErrorChip text={summary.errors.rawEnergyCount} />}
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                  <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Last 10m Health</div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {summary.global.rawHealthLast10m ?? "-"}
                  </div>
                  {summary.errors?.rawHealthLast10m && <ErrorChip text={summary.errors.rawHealthLast10m} />}
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/50 dark:to-orange-800/50 rounded-lg p-4 border border-orange-200 dark:border-orange-700">
                  <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Last 10m Energy</div>
                  <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {summary.global.rawEnergyLast10m ?? "-"}
                  </div>
                  {summary.errors?.rawEnergyLast10m && <ErrorChip text={summary.errors.rawEnergyLast10m} />}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                Current time (UTC): {summary.global.nowUtc}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-device last seen */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>Per Device — Last Seen Data</CardTitle>
              {summary.errors?.devices && (
                <div className="text-sm">
                  <ErrorChip text={summary.errors.devices} />
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-3 pr-4 font-medium">Device</th>
                      <th className="py-3 pr-4 font-medium">Last Health (UTC)</th>
                      <th className="py-3 pr-4 font-medium">Last Energy (UTC)</th>
                      <th className="py-3 pr-4 font-medium">Power W</th>
                      <th className="py-3 pr-4 font-medium">Voltage V</th>
                      <th className="py-3 pr-4 font-medium">Current A</th>
                      <th className="py-3 pr-4 font-medium">add_ele kWh</th>
                      <th className="py-3 pr-4 font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.devices.map(d => (
                      <tr key={d.deviceId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{d.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{d.deviceId}</div>
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                          {d.lastHealthTs ? new Date(d.lastHealthTs).toLocaleString() : "-"}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                          {d.lastEnergyTs ? new Date(d.lastEnergyTs).toLocaleString() : "-"}
                        </td>
                        <td className="py-3 pr-4 font-mono">{d.lastPowerW ?? "-"}</td>
                        <td className="py-3 pr-4 font-mono">{d.lastVoltageV ?? "-"}</td>
                        <td className="py-3 pr-4 font-mono">{d.lastCurrentA ?? "-"}</td>
                        <td className="py-3 pr-4 font-mono">{d.lastAddEleKwh ?? "-"}</td>
                        <td className="py-3 pr-4">
                          {d._errors?.lastHealth && <ErrorChip text={d._errors.lastHealth} />}
                          {d._errors?.lastEnergy && <ErrorChip text={d._errors.lastEnergy} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.devices.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No devices found in database
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Diagnostics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Diagnostics</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
              >
                {showDiagnostics ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {showDiagnostics && (
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="border rounded p-3">
                  <div className="font-medium mb-2">Database Schema</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-auto max-h-64">
                    {schema ? JSON.stringify(schema, null, 2) : "Loading..."}
                  </pre>
                </div>
                <div className="border rounded p-3">
                  <div className="font-medium mb-2">Self Test</div>
                  <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-auto max-h-64">
                    {selftest ? JSON.stringify(selftest, null, 2) : "Loading..."}
                  </pre>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Live tail */}
        <Card>
          <CardHeader>
            <CardTitle>Live Tail — Latest 50 Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="py-3 pr-4 font-medium">When (UTC)</th>
                    <th className="py-3 pr-4 font-medium">Table</th>
                    <th className="py-3 pr-4 font-medium">Device</th>
                    <th className="py-3 pr-4 font-medium">Power W</th>
                    <th className="py-3 pr-4 font-medium">Voltage V</th>
                    <th className="py-3 pr-4 font-medium">Current A</th>
                    <th className="py-3 pr-4 font-medium">PF</th>
                    <th className="py-3 pr-4 font-medium">add_ele kWh</th>
                  </tr>
                </thead>
                <tbody>
                  {tail.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 pr-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                        {new Date(row.tsUtc).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          row.table === 'RawHealth' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200' 
                            : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                        }`}>
                          {row.table}
                        </span>
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400">{row.deviceId}</td>
                      <td className="py-2 pr-4 font-mono">{row.powerW ?? "-"}</td>
                      <td className="py-2 pr-4 font-mono">{row.voltageV ?? "-"}</td>
                      <td className="py-2 pr-4 font-mono">{row.currentA ?? "-"}</td>
                      <td className="py-2 pr-4 font-mono">{row.pfEst ?? "-"}</td>
                      <td className="py-2 pr-4 font-mono">{row.addEleKwh ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tail.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No recent data found
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-4 flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-refresh every 5 seconds</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}