import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Activity, ChevronDown, ChevronUp, HardDrive, Settings } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  pf?: number | null;  // Unified PF field from server
  pfEst?: number | null;  // Legacy fallback field
  addEleKwh?: number | null;
};

type StorageSize = {
  ok: boolean;
  totalSizeBytes: number;
  totalRows?: number;
  tables?: Record<string, number>;
  breakdown?: Record<string, any>;
  error?: string;
};

// Utility to format bytes as KB/MB/GB
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(((bytes / Math.pow(k, i)) + Number.EPSILON) * 100) / 100 + " " + sizes[i];
}

export default function MonitorPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tail, setTail] = useState<TailRow[]>([]);
  const [schema, setSchema] = useState<any>(null);
  const [deviceSettings, setDeviceSettings] = useState<any[]>([]);
  const [selftest, setSelftest] = useState<any>(null);
  const [storageSize, setStorageSize] = useState<StorageSize | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [countdown, setCountdown] = useState<number>(5);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const saved = localStorage.getItem('monitor-refresh-interval');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  
  // Update countdown when refresh interval changes
  useEffect(() => {
    setCountdown(refreshInterval);
  }, [refreshInterval]);
  
  // Save refresh interval to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('monitor-refresh-interval', refreshInterval.toString());
  }, [refreshInterval]);

  // Data fetching function
  const fetchAllData = async () => {
    try {
      setIsRefreshing(true);
      setErr(null);
      const [sRes, tRes, schRes, stRes, szRes, dsRes] = await Promise.all([
        fetch("/api/monitor/ingest-summary"),
        fetch("/api/monitor/latest?limit=50"),
        fetch("/api/monitor/schema"),
        fetch("/api/monitor/selftest"),
        fetch("/api/monitor/storage-size"),
        fetch("/api/device-settings"),
      ]);
      
      const s = await sRes.json();
      const t = await tRes.json();
      const sch = await schRes.json();
      const st = await stRes.json();
      const sz = await szRes.json();
      const ds = await dsRes.json();
      
      const settings = ds.result || [];
      setDeviceSettings(settings);
      
      // Filter devices to only show those with data storage enabled
      const enabledDevices = s.devices?.filter((device: any) => {
        const deviceSetting = settings.find((setting: any) => setting.deviceId === device.deviceId);
        return deviceSetting?.dataStorageEnabled ?? true; // Default to enabled if no settings found
      }) || [];
      
      // Filter tail data to only show data from enabled devices
      const enabledDeviceIds = new Set(enabledDevices.map((d: any) => d.deviceId));
      const filteredTailRows = (t.rows ?? []).filter((row: TailRow) => 
        enabledDeviceIds.has(row.deviceId)
      );
      
      setSummary({ ...s, devices: enabledDevices });
      setTail(filteredTailRows);
      setSchema(sch);
      setSelftest(st);
      setStorageSize(sz);
      setLastUpdate(new Date());
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh with countdown timer
  useEffect(() => {
    let countdownTimer: any;

    // Initial data fetch
    fetchAllData();

    // Countdown timer - updates every second
    countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // When countdown reaches 0, refresh and reset to configured interval
          fetchAllData();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownTimer);
    };
  }, [refreshInterval]);

  const ErrorChip = ({ text }: { text: string }) => (
    <span className="inline-block bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 text-xs px-2 py-1 rounded mr-2 font-mono">
      {text.length > 50 ? text.substring(0, 47) + "..." : text}
    </span>
  );

  return (
    <PageLayout 
      title="Data Monitor" 
      subtitle="Real-time database activity and storage tracking (only showing devices with data storage enabled)"
      showConnectionStatus={false}
    >
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Database Monitor</h2>
            <p className="text-sm text-muted-foreground mt-1">Track ingestion, storage, and performance metrics</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-sm text-muted-foreground">
              {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
            </div>
            <div className="flex items-center space-x-2">
              {isRefreshing ? (
                <div className="flex items-center space-x-1 sm:space-x-2 text-blue-600 dark:text-blue-400">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">Refreshing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1 sm:space-x-2 bg-blue-50 dark:bg-blue-900/20 px-2 sm:px-3 py-1 rounded-full border border-blue-200 dark:border-blue-700">
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
                    <span className="hidden sm:inline">Refresh in: </span><span className="font-mono font-bold">{countdown}s</span>
                  </span>
                </div>
              )}
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" data-testid="settings-dialog-trigger">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Monitor Settings</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="refresh-interval" className="text-right">
                          Refresh Interval
                        </Label>
                        <div className="col-span-3">
                          <Select 
                            value={refreshInterval.toString()} 
                            onValueChange={(value) => setRefreshInterval(parseInt(value, 10))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 second</SelectItem>
                              <SelectItem value="2">2 seconds</SelectItem>
                              <SelectItem value="5">5 seconds</SelectItem>
                              <SelectItem value="10">10 seconds</SelectItem>
                              <SelectItem value="15">15 seconds</SelectItem>
                              <SelectItem value="30">30 seconds</SelectItem>
                              <SelectItem value="60">1 minute</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Choose how often the monitor refreshes data from the server.
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        </div>
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
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                Current time (UTC): {summary.global.nowUtc} | 
                {storageSize?.ok && (
                  <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                    <HardDrive className="h-3 w-3" />
                    <span>DB: {formatBytes(storageSize.totalSizeBytes)}</span>
                    {storageSize.totalRows && storageSize.totalRows > 0 && (
                      <span>({storageSize.totalRows.toLocaleString()} rows)</span>
                    )}
                  </span>
                )}
                {storageSize?.error && (
                  <span className="text-red-600 dark:text-red-400">Storage: Error</span>
                )}
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
                      <td className="py-2 pr-4 font-mono">{
                        // Prefer unified 'pf' field over legacy 'pfEst'
                        (() => {
                          const pfValue = row.pf !== null && row.pf !== undefined ? row.pf : row.pfEst;
                          return (pfValue !== null && pfValue !== undefined && typeof pfValue === 'number') 
                            ? pfValue.toFixed(2) 
                            : "-";
                        })()
                      }</td>
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
      </div>
    </PageLayout>
  );
}