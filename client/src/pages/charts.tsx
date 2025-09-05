import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, Zap, Calendar, BarChart3, Smartphone, Monitor, Home, CheckCircle } from "lucide-react";
import { PageLayout } from "@/components/page-layout";

interface SeriesDataPoint {
  t: string;
  v: number | null;
}

interface DailyKwhDataPoint {
  dayIst: string;
  kwh: number;
}

interface Device {
  deviceId: string;
  name: string;
  online: boolean;
}

interface ChartDataPoint {
  time: string;
  [deviceName: string]: any;
}

export default function ChartsPage() {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [chartData, setChartData] = useState<{
    daily: ChartDataPoint[];
    monthly: any[];
    yearly: any[];
  }>({
    daily: [],
    monthly: [],
    yearly: []
  });

  // Fetch devices for icon selection
  const { data: devicesData } = useQuery({
    queryKey: ["/api/devices/ui"]
  });

  // Fetch device settings to filter enabled devices
  const { data: deviceSettingsData } = useQuery({
    queryKey: ["/api/device-settings"]
  });

  const allDevices: Device[] = (devicesData as any)?.devices || [];
  const deviceSettings = (deviceSettingsData as any)?.result || [];

  // Filter devices to only show those with data storage enabled
  const devices: Device[] = allDevices.filter(device => {
    const settings = deviceSettings.find((s: any) => s.deviceId === device.deviceId);
    return settings?.dataStorageEnabled ?? true; // Default to enabled if no settings found
  });

  // Fetch data for selected devices when selection changes
  useEffect(() => {
    if (selectedDeviceIds.length === 0) {
      setChartData({ daily: [], monthly: [], yearly: [] });
      return;
    }

    const fetchChartsData = async () => {
      try {
        // Fetch series data for all selected devices
        const seriesPromises = selectedDeviceIds.map(deviceId =>
          fetch(`/api/series?deviceId=${deviceId}&metric=kwh&gran=1m`)
            .then(res => res.json())
            .then(data => ({ deviceId, data }))
        );

        // Fetch daily data for all selected devices
        const dailyPromises = selectedDeviceIds.map(deviceId =>
          fetch(`/api/daily-kwh?deviceId=${deviceId}`)
            .then(res => res.json())
            .then(data => ({ deviceId, data }))
        );

        const [seriesResults, dailyResults] = await Promise.all([
          Promise.all(seriesPromises),
          Promise.all(dailyPromises)
        ]);

        // Process daily chart data
        const timeMap = new Map<string, any>();
        seriesResults.forEach(({ deviceId, data }) => {
          const deviceName = devices.find(d => d.deviceId === deviceId)?.name || deviceId;
          if (data?.data) {
            data.data.forEach((point: SeriesDataPoint) => {
              const timeKey = new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, { time: timeKey });
              }
              timeMap.get(timeKey)![deviceName] = point.v || 0;
            });
          }
        });

        const dailyChartData = Array.from(timeMap.values()).sort((a, b) => a.time.localeCompare(b.time));

        // Process monthly chart data
        const monthMap = new Map<string, any>();
        dailyResults.forEach(({ deviceId, data }) => {
          const deviceName = devices.find(d => d.deviceId === deviceId)?.name || deviceId;
          if (data?.data) {
            data.data.forEach((point: DailyKwhDataPoint) => {
              const monthKey = point.dayIst.substring(0, 7);
              if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, { month: monthKey });
              }
              const current = monthMap.get(monthKey)![deviceName] || 0;
              monthMap.get(monthKey)![deviceName] = current + point.kwh;
            });
          }
        });

        const monthlyChartData = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

        // Process yearly chart data
        const yearMap = new Map<string, any>();
        dailyResults.forEach(({ deviceId, data }) => {
          const deviceName = devices.find(d => d.deviceId === deviceId)?.name || deviceId;
          if (data?.data) {
            data.data.forEach((point: DailyKwhDataPoint) => {
              const yearKey = point.dayIst.substring(0, 4);
              if (!yearMap.has(yearKey)) {
                yearMap.set(yearKey, { year: yearKey });
              }
              const current = yearMap.get(yearKey)![deviceName] || 0;
              yearMap.get(yearKey)![deviceName] = current + point.kwh;
            });
          }
        });

        const yearlyChartData = Array.from(yearMap.values()).sort((a, b) => a.year.localeCompare(b.year));

        setChartData({
          daily: dailyChartData,
          monthly: monthlyChartData,
          yearly: yearlyChartData
        });
      } catch (error) {
        console.error('Error fetching chart data:', error);
      }
    };

    fetchChartsData();
  }, [selectedDeviceIds]); // Removed devices dependency to prevent infinite loops

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const getDeviceIcon = (device: Device) => {
    const name = device.name.toLowerCase();
    if (name.includes('phone') || name.includes('mobile')) return Smartphone;
    if (name.includes('monitor') || name.includes('tv') || name.includes('display')) return Monitor;
    return Home;
  };

  const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

  return (
    <PageLayout 
      title="Energy Charts" 
      subtitle="Device power consumption and energy usage"
      showConnectionStatus={false}
    >
      <div className="space-y-6">
        {/* Device Selection */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Device Selection</span>
              </CardTitle>
              <CardDescription>Click device icons to select/deselect multiple devices for comparison. Only showing devices with data storage enabled.</CardDescription>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">No Devices Available</h3>
                  <p className="text-sm">All devices have data storage disabled. Enable data storage in Settings to view charts.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {devices.map((device: Device) => {
                  const IconComponent = getDeviceIcon(device);
                  const isSelected = selectedDeviceIds.includes(device.deviceId);
                  
                  return (
                    <div
                      key={device.deviceId}
                      className={`relative cursor-pointer transition-all duration-200 p-4 rounded-lg border-2 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-md' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      onClick={() => toggleDeviceSelection(device.deviceId)}
                      data-testid={`device-icon-${device.deviceId}`}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <IconComponent className={`h-8 w-8 ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`} />
                        <span className={`text-xs text-center font-medium ${
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        }`}>
                          {device.name}
                        </span>
                        <div className={`flex items-center space-x-1 text-xs ${
                          device.online ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            device.online ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                          <span>{device.online ? 'Online' : 'Offline'}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute -top-2 -right-2">
                          <CheckCircle className="h-5 w-5 text-primary bg-background rounded-full" />
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}
              {selectedDeviceIds.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Selected:</span>
                  {selectedDeviceIds.map(deviceId => {
                    const device = devices.find(d => d.deviceId === deviceId);
                    return (
                      <Badge key={deviceId} variant="secondary">
                        {device?.name || deviceId}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {selectedDeviceIds.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>
                  Energy Consumption ({selectedDeviceIds.length} device{selectedDeviceIds.length > 1 ? 's' : ''})
                </span>
              </CardTitle>
              <CardDescription>kWh energy consumption over time for selected devices</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="daily" className="flex items-center space-x-1">
                    <Activity className="h-4 w-4" />
                    <span>Daily</span>
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Monthly</span>
                  </TabsTrigger>
                  <TabsTrigger value="yearly" className="flex items-center space-x-1">
                    <BarChart3 className="h-4 w-4" />
                    <span>Yearly</span>
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="daily" className="space-y-4" data-testid="daily-tab">
                  <div className="text-sm text-muted-foreground mb-4">
                    Real-time kWh energy consumption (1-minute intervals)
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData.daily}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          formatter={(value, name) => [`${Number(value).toFixed(3)} kWh`, name]} 
                          labelFormatter={(label) => `Time: ${label}`}
                        />
                        {selectedDeviceIds.map((deviceId, index) => {
                          const deviceName = devices.find(d => d.deviceId === deviceId)?.name || deviceId;
                          return (
                            <Line 
                              key={deviceId}
                              type="monotone" 
                              dataKey={deviceName}
                              stroke={chartColors[index % chartColors.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="monthly" className="space-y-4" data-testid="monthly-tab">
                  <div className="text-sm text-muted-foreground mb-4">
                    Monthly energy consumption (kWh) by device
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          formatter={(value, name) => [`${Number(value).toFixed(2)} kWh`, name]}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        {selectedDeviceIds.map((deviceId, index) => {
                          const deviceName = devices.find(d => d.deviceId === deviceId)?.name || deviceId;
                          return (
                            <Bar 
                              key={deviceId}
                              dataKey={deviceName}
                              fill={chartColors[index % chartColors.length]}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="yearly" className="space-y-4" data-testid="yearly-tab">
                  <div className="text-sm text-muted-foreground mb-4">
                    Yearly energy consumption (kWh) by device
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.yearly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip 
                          formatter={(value, name) => [`${Number(value).toFixed(2)} kWh`, name]}
                          labelFormatter={(label) => `Year: ${label}`}
                        />
                        {selectedDeviceIds.map((deviceId, index) => {
                          const deviceName = devices.find(d => d.deviceId === deviceId)?.name || deviceId;
                          return (
                            <Bar 
                              key={deviceId}
                              dataKey={deviceName}
                              fill={chartColors[index % chartColors.length]}
                            />
                          );
                        })}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-muted-foreground">
                Select one or more devices above to view their energy consumption charts.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}