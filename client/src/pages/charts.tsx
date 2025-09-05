import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { ArrowLeft, Activity, Zap, Calendar, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import DeviceSelector from "@/components/DeviceSelector";

interface SeriesDataPoint {
  t: string;
  v: number | null;
}

interface DailyKwhDataPoint {
  dayIst: string;
  kwh: number;
}

export default function ChartsPage() {
  const [deviceId, setDeviceId] = useState<string>("");

  // Fetch power series data for daily chart
  const { data: powerSeriesData } = useQuery({
    queryKey: [`/api/series?deviceId=${deviceId}&metric=power&gran=1m`],
    enabled: !!deviceId
  });

  // Fetch daily kWh data for monthly/yearly charts
  const { data: dailyKwhData } = useQuery({
    queryKey: [`/api/daily-kwh?deviceId=${deviceId}`],
    enabled: !!deviceId
  });

  // Process daily power data for chart
  const dailyChartData = (powerSeriesData as any)?.data?.map((point: SeriesDataPoint) => ({
    time: new Date(point.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    power: point.v || 0
  })) || [];

  // Process daily kWh data for monthly grouping
  const monthlyChartData = (dailyKwhData as any)?.data?.reduce((acc: any[], point: DailyKwhDataPoint) => {
    const monthKey = point.dayIst.substring(0, 7); // YYYY-MM format
    const existing = acc.find(item => item.month === monthKey);
    
    if (existing) {
      existing.kwh += point.kwh;
    } else {
      acc.push({
        month: monthKey,
        kwh: point.kwh
      });
    }
    return acc;
  }, []) || [];

  // Process daily kWh data for yearly grouping
  const yearlyChartData = (dailyKwhData as any)?.data?.reduce((acc: any[], point: DailyKwhDataPoint) => {
    const yearKey = point.dayIst.substring(0, 4); // YYYY format
    const existing = acc.find(item => item.year === yearKey);
    
    if (existing) {
      existing.kwh += point.kwh;
    } else {
      acc.push({
        year: yearKey,
        kwh: point.kwh
      });
    }
    return acc;
  }, []) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <BarChart3 className="text-primary-foreground h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Energy Charts</h1>
                <p className="text-sm text-muted-foreground">Device power consumption and energy usage</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Device Selection */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Device Selection</span>
              </CardTitle>
              <CardDescription>Select a device to view its energy consumption data</CardDescription>
            </CardHeader>
            <CardContent>
              <DeviceSelector value={deviceId} onChange={setDeviceId} />
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {deviceId ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Energy Consumption</span>
              </CardTitle>
              <CardDescription>Power usage and energy consumption patterns</CardDescription>
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
                    Real-time power consumption (1-minute intervals)
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis label={{ value: 'Power (W)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => [`${value} W`, 'Power']} />
                        <Line 
                          type="monotone" 
                          dataKey="power" 
                          stroke="#8884d8" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="monthly" className="space-y-4" data-testid="monthly-tab">
                  <div className="text-sm text-muted-foreground mb-4">
                    Monthly energy consumption (kWh)
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, 'Energy']} />
                        <Bar dataKey="kwh" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                
                <TabsContent value="yearly" className="space-y-4" data-testid="yearly-tab">
                  <div className="text-sm text-muted-foreground mb-4">
                    Yearly energy consumption (kWh)
                  </div>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yearlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, 'Energy']} />
                        <Bar dataKey="kwh" fill="#8884d8" />
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
                Choose a device to view charts.
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}