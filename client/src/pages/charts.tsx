import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Activity, Zap, Calendar, BarChart3, Smartphone, Monitor, Home, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { PageLayout } from "@/components/page-layout";
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

  // Auto-select first device if none selected
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

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

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  // Data processing helpers
  const processHourlyData = () => {
    if (!todayHourlyData?.buckets) return [];
    return todayHourlyData.buckets.map((bucket: any) => ({
      hour: `${bucket.hour}:00`,
      kwh: bucket.kwh
    }));
  };

  const processDailyData = () => {
    if (!monthDailyData?.buckets) return [];
    return monthDailyData.buckets.map((bucket: any) => ({
      day: bucket.day,
      kwh: bucket.kwh
    }));
  };

  const processMonthlyData = () => {
    if (!yearMonthlyData?.buckets) return [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return yearMonthlyData.buckets.map((bucket: any) => ({
      month: monthNames[bucket.month - 1],
      kwh: bucket.kwh
    }));
  };

  const processPower24hData = () => {
    if (!power24hData?.points) return [];
    // Downsample if too many points for performance
    const points = power24hData.points;
    if (points.length <= 1000) return points.map((p: any) => ({
      time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      power: p.w
    }));
    
    // Downsample to ~1000 points
    const step = Math.ceil(points.length / 1000);
    return points.filter((_: any, i: number) => i % step === 0).map((p: any) => ({
      time: new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      power: p.w
    }));
  };

  const processPower7dData = () => {
    if (!power7dData?.points) return [];
    return power7dData.points.map((point: any) => ({
      day: new Date(point.d).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit' }),
      power: point.wAvg
    }));
  };

  const processCalendarData = () => {
    if (!calendarData?.days) return [];
    
    type CalendarDay = {
      day: number;
      kwh: number;
      level: number;
    } | null;
    
    const weeks: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];
    
    // Get first day of month and its day of week
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    // Add all days of the month
    calendarData.days.forEach((day: any) => {
      currentWeek.push(day);
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Fill last week if needed
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.some(day => day !== null)) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  const getHeatmapColor = (level: number) => {
    const colors = [
      'bg-gray-100 dark:bg-gray-800',     // 0
      'bg-green-100 dark:bg-green-900',   // 1
      'bg-green-200 dark:bg-green-800',   // 2
      'bg-green-400 dark:bg-green-600',   // 3
      'bg-green-600 dark:bg-green-500'    // 4
    ];
    return colors[level] || colors[0];
  };

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
      subtitle="Device power consumption and energy usage analytics"
      showConnectionStatus={false}
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
                        ) : !todayHourlyData?.ok ? (
                          <EmptyState message="No data for this device today" />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">{todayHourlyData.totalKwh} kWh</Badge>
                              </span>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processHourlyData()}>
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
                        ) : !monthDailyData?.ok ? (
                          <EmptyState message="No data for this device this month" />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">{monthDailyData.totalKwh} kWh</Badge>
                              </span>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processDailyData()}>
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
                        ) : !yearMonthlyData?.ok ? (
                          <EmptyState message="No data for this device this year" />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">{yearMonthlyData.totalKwh} kWh</Badge>
                              </span>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processMonthlyData()}>
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
                          <span>Calendar — Daily kWh</span>
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
                          </div>
                        </CardTitle>
                        <CardDescription>Daily energy consumption heatmap</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {calendarLoading ? (
                          <ChartSkeleton />
                        ) : !calendarData?.ok ? (
                          <EmptyState message="No data for this device in selected month" />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Total: <Badge variant="outline">{calendarData.totalKwh} kWh</Badge>
                              </span>
                            </div>
                            <div className="space-y-2">
                              {/* Weekday headers */}
                              <div className="grid grid-cols-7 gap-1 text-xs text-center font-medium">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                  <div key={day} className="p-1">{day}</div>
                                ))}
                              </div>
                              {/* Calendar grid */}
                              {processCalendarData().map((week, weekIndex) => (
                                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                                  {week.map((day, dayIndex) => (
                                    <div
                                      key={dayIndex}
                                      className={`aspect-square flex items-center justify-center text-xs rounded ${
                                        day 
                                          ? `${getHeatmapColor(day.level)} cursor-pointer hover:ring-2 hover:ring-primary` 
                                          : 'bg-transparent'
                                      }`}
                                      title={day ? `${day.day}: ${day.kwh} kWh` : ''}
                                    >
                                      {day ? day.day : ''}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
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
                      ) : !power24hData?.ok ? (
                        <EmptyState message="No power data for this device in the last 24 hours" />
                      ) : (
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={processPower24hData()}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value} W`, 'Power']} />
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
                      ) : !power7dData?.ok ? (
                        <EmptyState message="No power data for this device in the last 7 days" />
                      ) : (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={processPower7dData()}>
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