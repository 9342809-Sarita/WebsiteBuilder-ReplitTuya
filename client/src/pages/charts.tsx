import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, Zap, Calendar, BarChart3, Smartphone, Monitor, Home, CheckCircle, ChevronLeft, ChevronRight, CalendarDays, Database } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
import { CalendarKwh } from "@/components/CalendarKwh";
import { NoDataAlert } from "@/components/NoDataAlert";
import { Link } from "wouter";
import { 
  getEnergyTodayHourly, 
  getEnergyMonthDaily, 
  getEnergyYearMonthly, 
  getEnergyCalendar, 
  getPowerLast24h, 
  getPowerLast7d 
} from "@/lib/api";

interface Device {
  deviceId: string;
  name: string;
  online: boolean;
}

export default function ChartsPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch devices for selection
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
    return settings?.dataStorageEnabled ?? true;
  });

  // Load stored device ID from localStorage on mount
  useEffect(() => {
    const storedDeviceId = localStorage.getItem('selectedDeviceId');
    if (storedDeviceId && devices?.find((d: Device) => d.deviceId === storedDeviceId)) {
      setSelectedDeviceId(storedDeviceId);
    } else if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  // Save device selection to localStorage
  useEffect(() => {
    if (selectedDeviceId) {
      localStorage.setItem('selectedDeviceId', selectedDeviceId);
    }
  }, [selectedDeviceId]);

  // Chart data queries
  const { data: todayHourlyData, isLoading: todayHourlyLoading } = useQuery({
    queryKey: ["energy-today-hourly", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getEnergyTodayHourly(selectedDeviceId) : null,
    enabled: !!selectedDeviceId
  });

  const { data: monthDailyData, isLoading: monthDailyLoading } = useQuery({
    queryKey: ["energy-month-daily", selectedDeviceId, selectedMonth],
    queryFn: () => selectedDeviceId ? getEnergyMonthDaily(selectedDeviceId, selectedMonth) : null,
    enabled: !!selectedDeviceId
  });

  const { data: yearMonthlyData, isLoading: yearMonthlyLoading } = useQuery({
    queryKey: ["energy-year-monthly", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getEnergyYearMonthly(selectedDeviceId) : null,
    enabled: !!selectedDeviceId
  });

  const { data: calendarData, isLoading: calendarLoading } = useQuery({
    queryKey: ["energy-calendar", selectedDeviceId, selectedMonth],
    queryFn: () => selectedDeviceId ? getEnergyCalendar(selectedDeviceId, selectedMonth) : null,
    enabled: !!selectedDeviceId
  });

  const { data: power24hData, isLoading: power24hLoading } = useQuery({
    queryKey: ["power-last-24h", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getPowerLast24h(selectedDeviceId) : null,
    enabled: !!selectedDeviceId
  });

  const { data: power7dData, isLoading: power7dLoading } = useQuery({
    queryKey: ["power-last-7d", selectedDeviceId],
    queryFn: () => selectedDeviceId ? getPowerLast7d(selectedDeviceId) : null,
    enabled: !!selectedDeviceId
  });

  const getDeviceIcon = (device: Device) => {
    const name = device.name.toLowerCase();
    if (name.includes('phone') || name.includes('mobile')) return Smartphone;
    if (name.includes('monitor') || name.includes('tv') || name.includes('display')) return Monitor;
    return Home;
  };

  const selectedDevice = devices.find(d => d.deviceId === selectedDeviceId);

  // Month navigation helpers
  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const resetToToday = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(currentMonth);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Helper to check if data response is empty
  const isDataEmpty = (data: any) => {
    return !data || data.ok === false || 
           (data.buckets && data.buckets.length === 0) ||
           (data.points && data.points.length === 0) ||
           (data.days && data.days.length === 0);
  };

  // Helper function for intelligent downsampling based on screen width
  const downsampleForWidth = (points: any[], targetPoints: number = 1000) => {
    if (points.length <= targetPoints) return points;
    
    const step = Math.ceil(points.length / targetPoints);
    return points.filter((_, index) => index % step === 0);
  };

  // Memoized data processing helpers
  const processedHourlyData = useMemo(() => {
    if (!todayHourlyData?.buckets) return [];
    return todayHourlyData.buckets.map((bucket: any) => ({
      hour: `${bucket.hour}:00`,
      kwh: bucket.kwh
    }));
  }, [todayHourlyData]);

  const processedDailyData = useMemo(() => {
    if (!monthDailyData?.buckets) return [];
    return monthDailyData.buckets.map((bucket: any) => ({
      day: bucket.day,
      kwh: bucket.kwh
    }));
  }, [monthDailyData]);

  const processedMonthlyData = useMemo(() => {
    if (!yearMonthlyData?.buckets) return [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return yearMonthlyData.buckets.map((bucket: any) => ({
      month: monthNames[bucket.month - 1],
      kwh: bucket.kwh
    }));
  }, [yearMonthlyData]);

  const processedPower24hData = useMemo(() => {
    if (!power24hData?.points) return [];
    
    const points = power24hData.points;
    
    // First transform timestamps to readable format
    const transformedPoints = points.map((p: any) => ({
      time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      power: p.w
    }));
    
    // Apply intelligent downsampling based on device capabilities
    // Mobile devices get more aggressive downsampling
    const isMobile = window.innerWidth < 768;
    const targetPoints = isMobile ? 500 : 1000;
    
    return downsampleForWidth(transformedPoints, targetPoints);
  }, [power24hData]);

  const processedPower7dData = useMemo(() => {
    if (!power7dData?.points) return [];
    return power7dData.points.map((point: any) => ({
      day: new Date(point.d).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' }),
      power: point.wAvg
    }));
  }, [power7dData]);

  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex items-center justify-center h-64 text-center">
      <div className="text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>{message}</p>
      </div>
    </div>
  );

  const ChartSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <PageLayout 
      title="Energy Charts" 
      subtitle={
        <div className="flex items-center space-x-3">
          <span>Device power consumption and energy usage analytics</span>
          <Badge variant="secondary" className="text-xs">
            Asia/Kolkata
          </Badge>
        </div>
      }
      showConnectionStatus={false}
      headerAction={
        <Link href="/raw-data">
          <Button variant="outline" size="sm" className="flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Raw Data</span>
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Device Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Device Selection</span>
            </CardTitle>
            <CardDescription>
              Select a device to view its energy consumption and power usage charts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">No Devices Available</h3>
                <p className="text-sm">All devices have data storage disabled. Enable data storage in Settings to view charts.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {devices.map((device: Device) => {
                    const IconComponent = getDeviceIcon(device);
                    const isSelected = selectedDeviceId === device.deviceId;
                    
                    return (
                      <div
                        key={device.deviceId}
                        className={`relative cursor-pointer transition-all duration-200 p-4 rounded-lg border-2 ${
                          isSelected 
                            ? 'border-primary bg-primary/10 shadow-md' 
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedDeviceId(device.deviceId)}
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
                {selectedDevice && (
                  <div className="mt-4 flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">Selected:</span>
                    <Badge variant="secondary">{selectedDevice.name}</Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        {selectedDeviceId ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Energy Consumption</span>
              </CardTitle>
              <CardDescription>
                Energy and power analytics for {selectedDevice?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="energy" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="energy" className="flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Energy (kWh)</span>
                  </TabsTrigger>
                  <TabsTrigger value="power" className="flex items-center space-x-2">
                    <Activity className="h-4 w-4" />
                    <span>Power (W)</span>
                  </TabsTrigger>
                </TabsList>

                {/* Energy Tab */}
                <TabsContent value="energy" className="space-y-6 mt-6">
                  {/* Row 1: Today & This Month */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Today - Hourly */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Today — Hourly</CardTitle>
                        <CardDescription>Energy consumption by hour (kWh)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {todayHourlyLoading ? (
                          <ChartSkeleton />
                        ) : isDataEmpty(todayHourlyData) ? (
                          <NoDataAlert />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">{todayHourlyData.totalKwh} kWh</Badge>
                              </span>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processedHourlyData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="hour" />
                                  <YAxis />
                                  <Tooltip formatter={(value) => [`${value} kWh`, 'Energy']} />
                                  <Bar dataKey="kwh" fill="#8884d8" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* This Month - Daily */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">This Month — Daily</CardTitle>
                        <CardDescription>Energy consumption by day (kWh)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {monthDailyLoading ? (
                          <ChartSkeleton />
                        ) : isDataEmpty(monthDailyData) ? (
                          <NoDataAlert />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">
                                  {monthDailyData.buckets?.reduce((sum: number, bucket: any) => sum + bucket.kwh, 0).toFixed(2)} kWh
                                </Badge>
                              </span>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processedDailyData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="day" />
                                  <YAxis />
                                  <Tooltip formatter={(value) => [`${value} kWh`, 'Energy']} />
                                  <Bar dataKey="kwh" fill="#82ca9d" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Row 2: This Year & Calendar */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* This Year - Monthly */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">This Year — Monthly</CardTitle>
                        <CardDescription>Energy consumption by month (kWh)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {yearMonthlyLoading ? (
                          <ChartSkeleton />
                        ) : isDataEmpty(yearMonthlyData) ? (
                          <NoDataAlert />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">
                                  {yearMonthlyData.buckets?.reduce((sum: number, bucket: any) => sum + bucket.kwh, 0).toFixed(2)} kWh
                                </Badge>
                              </span>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processedMonthlyData}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="month" />
                                  <YAxis />
                                  <Tooltip formatter={(value) => [`${value} kWh`, 'Energy']} />
                                  <Bar dataKey="kwh" fill="#ffc658" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Calendar - Daily kWh */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CalendarDays className="h-5 w-5" />
                            <span>Calendar — Daily kWh</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-normal min-w-32 text-center">
                              {formatMonth(selectedMonth)}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={resetToToday}>
                              Today
                            </Button>
                          </div>
                        </CardTitle>
                        <CardDescription>Daily energy consumption heatmap</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {calendarLoading ? (
                          <ChartSkeleton />
                        ) : isDataEmpty(calendarData) ? (
                          <NoDataAlert />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">{calendarData.totalKwh} kWh</Badge>
                              </span>
                            </div>
                            <CalendarKwh 
                              month={selectedMonth}
                              days={calendarData.days || []}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Power Tab */}
                <TabsContent value="power" className="space-y-6 mt-6">
                  {/* Row 1: Last 24 Hours */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Last 24 Hours — 3s Resolution</CardTitle>
                      <CardDescription>Power consumption over time (W)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {power24hLoading ? (
                        <ChartSkeleton />
                      ) : isDataEmpty(power24hData) ? (
                        <NoDataAlert />
                      ) : (
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={processedPower24hData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <Tooltip 
                                formatter={(value, name) => [`${value} W`, 'Power']}
                                labelFormatter={(label) => `Time: ${label}`}
                              />
                              <Line type="monotone" dataKey="power" stroke="#8884d8" strokeWidth={1} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Row 2: Last 7 Days */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Last 7 Days — Average Power</CardTitle>
                      <CardDescription>Daily average power consumption (W)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {power7dLoading ? (
                        <ChartSkeleton />
                      ) : isDataEmpty(power7dData) ? (
                        <NoDataAlert />
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={processedPower7dData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value} W`, 'Avg Power']} />
                              <Bar dataKey="power" fill="#ff7c7c" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-muted-foreground">
                Select a device above to view its energy consumption and power usage charts.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}