import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/page-layout";
import { PfSourceBadge } from "@/components/pf-source-badge";
import { 
  Cpu, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Zap,
  Gauge,
  Activity,
  BarChart3
} from "lucide-react";

interface LiveDevice {
  deviceId: string;
  name: string;
  online: boolean;
  powerW: number;
  voltageV: number;
  currentA: number;
  pf: number;
  hasPf?: boolean;
}

interface LiveDashboardData {
  success: boolean;
  summary: {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
  };
  devices: LiveDevice[];
  timestamp: string;
}

type FilterType = 'total' | 'online' | 'offline';

export default function HomePage() {
  // Filter state - default to "online" as requested
  const [deviceFilter, setDeviceFilter] = useState<FilterType>('online');
  // Dynamic refresh interval and enabled flags from poller settings
  const [refreshMs, setRefreshMs] = useState<number>(10000);
  const [dashboardEnabled, setDashboardEnabled] = useState<boolean>(true);
  const [masterKillSwitch, setMasterKillSwitch] = useState<boolean>(false);

  // Fetch dashboard settings from poller settings
  useEffect(() => {
    fetch("/api/pollers/settings")
      .then(r => r.json())
      .then(s => {
        setRefreshMs(s.dashboardRefreshMs ?? 10000);
        setDashboardEnabled(s.dashboardRefreshEnabled ?? true);
        setMasterKillSwitch(s.masterKillSwitch ?? false);
      })
      .catch(() => {
        setRefreshMs(10000);
        setDashboardEnabled(true);
        setMasterKillSwitch(false);
      });
  }, []);

  // Check if dashboard should be enabled (not killed by master switch or dashboard disabled)
  const isDashboardEnabled = dashboardEnabled && !masterKillSwitch;

  // Live dashboard data query
  const { 
    data: dashboardData, 
    isLoading, 
    error,
    refetch 
  } = useQuery<LiveDashboardData>({
    queryKey: ["/api/live-dashboard"],
    refetchInterval: isDashboardEnabled ? refreshMs : false, // Dynamic refresh interval from poller settings
    enabled: isDashboardEnabled, // Disable query if dashboard is disabled or master kill switch is on
  });

  const summary = dashboardData?.summary || {
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0
  };

  const allDevices = dashboardData?.devices || [];
  const onlineDevices = allDevices.filter(d => d.online);
  const offlineDevices = allDevices.filter(d => !d.online);

  // Filter devices based on selected filter
  const getFilteredDevices = () => {
    switch (deviceFilter) {
      case 'total':
        return allDevices;
      case 'online':
        return onlineDevices;
      case 'offline':
        return offlineDevices;
      default:
        return onlineDevices;
    }
  };

  const filteredDevices = getFilteredDevices();

  const handleRefresh = () => {
    refetch();
  };

  if (masterKillSwitch) {
    return (
      <PageLayout 
        title="Dashboard"
        subtitle="Live device monitoring with real-time Tuya data"
      >
        <Card className="shadow-sm border-red-200">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-xl font-medium text-red-700 mb-2">Master Kill Switch Enabled</p>
              <p className="text-red-600 mb-4">All Tuya API traffic has been disabled for safety.</p>
              <p className="text-sm text-red-500">Go to Settings → Master Kill Switch to re-enable.</p>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout 
        title="Dashboard"
        subtitle="Live device monitoring with real-time Tuya data"
      >
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center text-muted-foreground">
              <XCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
              <h3 className="text-lg font-medium mb-2">Failed to Load Dashboard</h3>
              <p className="text-sm mb-4">Unable to fetch live device data from Tuya</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title="Dashboard"
      subtitle="Live device monitoring with real-time Tuya data"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <Card 
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
            deviceFilter === 'total' ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
          }`}
          onClick={() => setDeviceFilter('total')}
          data-testid="card-total-devices"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Devices
            </CardTitle>
            <Cpu className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary" data-testid="total-devices">
              {isLoading ? "..." : summary.totalDevices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All registered devices
            </p>
          </CardContent>
        </Card>
        
        <Card 
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
            deviceFilter === 'online' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-muted/50'
          }`}
          onClick={() => setDeviceFilter('online')}
          data-testid="card-online-devices"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Online Devices
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="online-devices">
              {isLoading ? "..." : summary.onlineDevices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently active and responding
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`shadow-sm cursor-pointer transition-all hover:shadow-md ${
            deviceFilter === 'offline' ? 'ring-2 ring-red-500 bg-red-50' : 'hover:bg-muted/50'
          }`}
          onClick={() => setDeviceFilter('offline')}
          data-testid="card-offline-devices"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Offline Devices
            </CardTitle>
            <XCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600" data-testid="offline-devices">
              {isLoading ? "..." : summary.offlineDevices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Not responding or disconnected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Control */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">
            {deviceFilter === 'total' && 'All Devices'}
            {deviceFilter === 'online' && 'Online Devices'}
            {deviceFilter === 'offline' && 'Offline Devices'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {deviceFilter === 'total' && 'Showing all registered devices'}
            {deviceFilter === 'online' && 'Real-time electrical readings from online devices'}
            {deviceFilter === 'offline' && 'Devices that are currently not responding'}
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
          size="sm"
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filtered Devices Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-center py-16">
            <div className="text-center text-muted-foreground">
              <Zap className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-2">
                {deviceFilter === 'total' && 'No Devices Found'}
                {deviceFilter === 'online' && 'No Online Devices'}
                {deviceFilter === 'offline' && 'No Offline Devices'}
              </h3>
              <p className="text-sm">
                {deviceFilter === 'total' && 'No devices are registered in the system'}
                {deviceFilter === 'online' && 'All devices are currently offline or not responding'}
                {deviceFilter === 'offline' && 'All devices are currently online and responding'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredDevices.map((device) => (
            <Card key={device.deviceId} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-3">
                    <CardTitle 
                      className="text-lg font-bold text-primary bg-primary/5 px-3 py-2 rounded-lg border border-primary/20" 
                      data-testid={`device-name-${device.deviceId}`}
                      title={device.name}
                    >
                      {device.name}
                    </CardTitle>
                  </div>
                  <Badge 
                    variant="default"
                    className={`flex-shrink-0 ${
                      device.online 
                        ? "bg-green-100 text-green-800 hover:bg-green-200" 
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mr-1 ${
                      device.online ? "bg-green-500" : "bg-red-500"
                    }`} />
                    {device.online ? "Online" : "Offline"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Power */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium">Power</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-600" data-testid={`power-${device.deviceId}`}>
                    {device.online ? device.powerW.toFixed(2) : '0.00'} W
                  </span>
                </div>

                {/* Voltage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Gauge className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Voltage</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600" data-testid={`voltage-${device.deviceId}`}>
                    {device.online ? device.voltageV.toFixed(2) : '0.00'} V
                  </span>
                </div>

                {/* Current */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Current</span>
                  </div>
                  <span className="text-lg font-bold text-orange-600" data-testid={`current-${device.deviceId}`}>
                    {device.online ? device.currentA.toFixed(2) : '0.00'} A
                  </span>
                </div>

                {/* Power Factor */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">Power Factor</span>
                    <PfSourceBadge size="xs" />
                  </div>
                  <span className="text-lg font-bold text-purple-600" data-testid={`pf-${device.deviceId}`}>
                    {device.online ? 
                      (device.hasPf !== false ? device.pf.toFixed(2) : '—') 
                      : '0.00'
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Data Source Info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-muted-foreground">
          Data sourced live from Tuya Cloud • Last updated: {dashboardData?.timestamp ? new Date(dashboardData.timestamp).toLocaleTimeString() : 'Never'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Offline devices display 0 values • Auto-refresh every 10 seconds
        </p>
      </div>
    </PageLayout>
  );
}