import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, RotateCcw, Download, Home, Play, Pause, Thermometer, Lightbulb, Zap, Gauge, History, Clock, Calendar, TrendingUp, Filter, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getDeviceHistory } from "@/lib/api";
import type { TuyaDevice, TuyaDeviceStatus } from "@/lib/api";

interface DeviceStatusPanelProps {
  device: TuyaDevice;
  status: TuyaDeviceStatus[] | any;
  onClose: () => void;
  onRefresh: () => void;
  onExport: () => void;
  isLoading?: boolean;
  isInline?: boolean;
}

export function DeviceStatusPanel({ 
  device, 
  status, 
  onClose, 
  onRefresh, 
  onExport,
  isLoading,
  isInline = false 
}: DeviceStatusPanelProps) {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [historyData, setHistoryData] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState("current");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historyView, setHistoryView] = useState<"timeline" | "charts">("timeline");
  
  const deviceId = device.id || device.device_id || "";
  const deviceName = device.name || "Unknown Device";
  const category = device.category || device.category_name || "Unknown";
  const isOnline = device.online === true || device.online === "true";
  
  // Auto-refresh in live mode
  useEffect(() => {
    if (!isLiveMode || !isOnline) return;
    
    const interval = setInterval(() => {
      onRefresh();
      setLastUpdate(new Date());
    }, 3000); // Refresh every 3 seconds
    
    return () => clearInterval(interval);
  }, [isLiveMode, isOnline, onRefresh]);
  
  // Update last update time when status changes
  useEffect(() => {
    if (status && !isLoading) {
      setLastUpdate(new Date());
    }
  }, [status, isLoading]);
  
  // Load history when tab is switched
  const loadHistory = async () => {
    if (historyData) return; // Already loaded
    
    setIsLoadingHistory(true);
    try {
      const deviceId = device.id || device.device_id || "";
      const result = await getDeviceHistory(deviceId, {
        size: 50 // Get last 50 events
      });
      setHistoryData(result);
    } catch (error) {
      console.error("Failed to load history:", error);
      setHistoryData({ error: "Failed to load history data" });
    } finally {
      setIsLoadingHistory(false);
    }
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === "history" && !historyData) {
      loadHistory();
    }
  };
  
  const formatHistoryEvent = (log: any) => {
    const timestamp = new Date(log.event_time);
    const timeStr = timestamp.toLocaleString();
    const relativeTime = getRelativeTime(timestamp);
    
    return {
      ...log,
      timeStr,
      relativeTime,
      displayValue: formatValue(log.value, log.code)
    };
  };
  
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };
  
  const getHistoryLogs = () => {
    if (isLoadingHistory || !historyData) return [];
    
    let logs = historyData?.result?.logs || historyData?.result || [];
    logs = Array.isArray(logs) ? logs.map(formatHistoryEvent) : [];
    
    // Apply filter
    if (historyFilter !== "all") {
      logs = logs.filter((log: any) => {
        const code = log.code?.toLowerCase() || "";
        switch (historyFilter) {
          case "switch":
            return code.includes("switch") || typeof log.value === "boolean";
          case "sensor":
            return code.includes("temp") || code.includes("humidity") || code.includes("bright");
          case "power":
            return code.includes("power") || code.includes("current") || code.includes("voltage");
          default:
            return true;
        }
      });
    }
    
    return logs;
  };
  
  const getUniqueDataTypes = () => {
    const logs = getHistoryLogs();
    const types = new Set();
    
    logs.forEach((log: any) => {
      const code = log.code?.toLowerCase() || "";
      if (code.includes("switch") || typeof log.value === "boolean") types.add("switch");
      if (code.includes("temp") || code.includes("humidity") || code.includes("bright")) types.add("sensor");
      if (code.includes("power") || code.includes("current") || code.includes("voltage")) types.add("power");
    });
    
    return Array.from(types);
  };
  
  const getChartData = () => {
    const logs = getHistoryLogs();
    const numericLogs = logs.filter((log: any) => typeof log.value === "number");
    
    // Group by data point code
    const groupedData: { [key: string]: any[] } = {};
    
    numericLogs.forEach((log: any) => {
      if (!groupedData[log.code]) {
        groupedData[log.code] = [];
      }
      
      groupedData[log.code].push({
        timestamp: log.event_time,
        time: new Date(log.event_time).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        value: log.value,
        displayValue: log.displayValue
      });
    });
    
    return groupedData;
  };
  
  const getEventSummary = () => {
    const logs = getHistoryLogs();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const todayEvents = logs.filter((log: any) => new Date(log.event_time) >= today);
    const switchEvents = logs.filter((log: any) => typeof log.value === "boolean");
    const sensorReadings = logs.filter((log: any) => typeof log.value === "number");
    
    return {
      total: logs.length,
      today: todayEvents.length,
      switches: switchEvents.length,
      sensors: sensorReadings.length
    };
  };

  const getDataPoints = () => {
    if (isLoading) return [];
    if (!status) return [];
    
    // Handle different response structures
    const dataPoints = status?.result || status;
    return Array.isArray(dataPoints) ? dataPoints : [];
  };
  
  const getValueIcon = (code: string, type?: string) => {
    const codeStr = code?.toLowerCase() || "";
    if (codeStr.includes("temp") || codeStr.includes("temperature")) return Thermometer;
    if (codeStr.includes("light") || codeStr.includes("bright")) return Lightbulb;
    if (codeStr.includes("power") || codeStr.includes("current") || codeStr.includes("voltage")) return Zap;
    return Gauge;
  };
  
  const formatValue = (value: any, code: string) => {
    if (typeof value === "boolean") {
      return value ? "ON" : "OFF";
    }
    if (typeof value === "number") {
      const codeStr = code?.toLowerCase() || "";
      
      // Specific electrical measurement fields
      if (code === "cur_current") {
        return `${(value / 1000).toFixed(2)} A`; // Convert mA to A
      }
      if (code === "cur_power") {
        return `${(value / 10).toFixed(2)} W`; // Convert 0.1W units to W
      }
      if (code === "cur_voltage") {
        return `${(value / 10).toFixed(2)} V`; // Convert 0.1V units to V
      }
      if (code === "add_ele") {
        return `${(value / 1000).toFixed(2)} kWh`; // Convert Wh to kWh
      }
      if (code === "power_factor") {
        return `${(value / 1000).toFixed(2)}`; // Convert to decimal and format to 2 places
      }
      
      // Generic handling for similar fields
      if (codeStr.includes("temp")) return `${value}°C`;
      if (codeStr.includes("humidity")) return `${value}%`;
      if (codeStr.includes("bright")) return `${value}%`;
      if (codeStr.includes("power") && !code.startsWith("cur_")) return `${value}W`;
      if (codeStr.includes("current") && !code.startsWith("cur_")) return `${value}A`;
      if (codeStr.includes("voltage") && !code.startsWith("cur_")) return `${value}V`;
      if (codeStr.includes("ele") && !code.startsWith("add_")) return `${value} Wh`;
      
      return value.toString();
    }
    return String(value);
  };
  
  const getValueColor = (value: any, code: string) => {
    if (typeof value === "boolean") {
      return value ? "text-green-600" : "text-gray-600";
    }
    return "text-foreground";
  };

  return (
    <div className="mt-8 animate-in slide-in-from-top-2" data-testid="device-status-panel">
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                <Home className="text-primary h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-lg">Device Status</CardTitle>
                <CardDescription>
                  <span className="font-medium">{deviceName}</span>
                  <code className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                    {deviceId}
                  </code>
                </CardDescription>
              </div>
            </div>
            {!isInline && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-close-status-panel"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current" className="flex items-center space-x-2">
                <Gauge className="h-4 w-4" />
                <span>Current Status</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2">
                <History className="h-4 w-4" />
                <span>History</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="current" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Device Information</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="text-sm font-medium text-foreground">{deviceName}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Category</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {category}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Connection</span>
                  <Badge 
                    variant={isOnline ? "default" : "destructive"}
                    className={isOnline ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                  >
                    <div className={`w-2 h-2 rounded-full mr-1 ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Last Updated</span>
                  <span className="text-sm text-muted-foreground">
                    {lastUpdate.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-foreground">Live Data Points</h4>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">Live Mode</span>
                  <Switch 
                    checked={isLiveMode} 
                    onCheckedChange={setIsLiveMode}
                    disabled={!isOnline}
                  />
                  {isLiveMode && isOnline && (
                    <div className="flex items-center text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                      <Play className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-4 max-h-80 overflow-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <RotateCcw className="h-4 w-4 animate-spin mr-2" />
                    Loading device data...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getDataPoints().length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No data points available
                      </div>
                    ) : (
                      getDataPoints().map((dp: any, index: number) => {
                        const Icon = getValueIcon(dp.code, dp.type);
                        return (
                          <div 
                            key={`${dp.code}-${index}`} 
                            className="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {dp.code || "Unknown"}
                                </div>
                                {dp.type && (
                                  <div className="text-xs text-muted-foreground">
                                    Type: {dp.type}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${getValueColor(dp.value, dp.code)}`}>
                                {formatValue(dp.value, dp.code)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {typeof dp.value === "object" ? "Object" : typeof dp.value}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              
                  {/* Raw JSON View (collapsible) */}
                  <details className="mt-4">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      View Raw JSON Data
                    </summary>
                    <div className="mt-2 bg-muted/50 rounded p-3 max-h-40 overflow-auto">
                      <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                        {JSON.stringify(status, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="history" className="mt-6">
              <div className="space-y-6">
                {/* Summary Cards */}
                {historyData && !isLoadingHistory && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                      const summary = getEventSummary();
                      return (
                        <>
                          <Card className="p-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">{summary.total}</div>
                              <div className="text-xs text-muted-foreground">Total Events</div>
                            </div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-600">{summary.today}</div>
                              <div className="text-xs text-muted-foreground">Today</div>
                            </div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-blue-600">{summary.switches}</div>
                              <div className="text-xs text-muted-foreground">Switches</div>
                            </div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-orange-600">{summary.sensors}</div>
                              <div className="text-xs text-muted-foreground">Sensors</div>
                            </div>
                          </Card>
                        </>
                      );
                    })()
                    }
                  </div>
                )}
                
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h4 className="text-sm font-medium text-foreground">Device History (Last 7 days)</h4>
                  <div className="flex items-center space-x-3">
                    <Select value={historyFilter} onValueChange={setHistoryFilter}>
                      <SelectTrigger className="w-32">
                        <Filter className="h-3 w-3 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="switch">Switches</SelectItem>
                        <SelectItem value="sensor">Sensors</SelectItem>
                        <SelectItem value="power">Power</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex border rounded-md">
                      <Button
                        variant={historyView === "timeline" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setHistoryView("timeline")}
                        className="rounded-r-none border-r"
                      >
                        <History className="h-3 w-3 mr-1" />
                        Timeline
                      </Button>
                      <Button
                        variant={historyView === "charts" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setHistoryView("charts")}
                        className="rounded-l-none"
                      >
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Charts
                      </Button>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setHistoryData(null);
                        loadHistory();
                      }}
                      disabled={isLoadingHistory}
                    >
                      <RotateCcw className={`h-3 w-3 mr-1 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
                
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                    <RotateCcw className="h-6 w-6 animate-spin mr-3" />
                    <span>Loading device history...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getHistoryLogs().length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No history data available</p>
                        <p className="text-sm mt-2">History data is retained for 7 days on free accounts</p>
                        <p className="text-xs mt-1 text-muted-foreground/60">Make sure your device is active and generating events</p>
                      </div>
                    ) : (
                      <>
                        {/* Charts View */}
                        {historyView === "charts" && (() => {
                          const chartData = getChartData();
                          return (
                            <div className="space-y-6">
                              {Object.entries(chartData).map(([code, data]: [string, any[]]) => (
                                <Card key={code} className="p-4">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                      <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                                        {(() => {
                                          const Icon = getValueIcon(code);
                                          return <Icon className="h-4 w-4 text-primary" />;
                                        })()
                                        }
                                      </div>
                                      <div>
                                        <h5 className="font-medium text-sm">{code}</h5>
                                        <p className="text-xs text-muted-foreground">{data.length} readings</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center text-xs text-muted-foreground">
                                      <TrendingUp className="h-3 w-3 mr-1" />
                                      Last 24h
                                    </div>
                                  </div>
                                  <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={data.slice(-20).reverse()}>
                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                        <XAxis 
                                          dataKey="time" 
                                          tick={{ fontSize: 10 }}
                                          axisLine={false}
                                          tickLine={false}
                                        />
                                        <YAxis 
                                          tick={{ fontSize: 10 }}
                                          axisLine={false}
                                          tickLine={false}
                                          width={40}
                                        />
                                        <Tooltip 
                                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                                          contentStyle={{ 
                                            backgroundColor: 'hsl(var(--card))', 
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '6px'
                                          }}
                                          formatter={(value: any) => [value, 'Value']}
                                        />
                                        <Line 
                                          type="monotone" 
                                          dataKey="value" 
                                          stroke="hsl(var(--primary))" 
                                          strokeWidth={2}
                                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                                          activeDot={{ r: 4 }}
                                        />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                </Card>
                              ))}
                              
                              {Object.keys(chartData).length === 0 && (
                                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>No numeric data available for charts</p>
                                  <p className="text-xs mt-1">Charts show temperature, power, and other sensor readings</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        
                        {/* Timeline View */}
                        {historyView === "timeline" && (
                          <div className="space-y-3 max-h-96 overflow-auto bg-muted/20 rounded-lg p-4">
                            <div className="space-y-3">
                              {getHistoryLogs().map((log: any, index: number) => {
                                const Icon = getValueIcon(log.code);
                                const isFirstOfDay = index === 0 || 
                                  new Date(log.event_time).toDateString() !== 
                                  new Date(getHistoryLogs()[index - 1]?.event_time).toDateString();
                                
                                return (
                                  <div key={`${log.event_id}-${index}`}>
                                    {isFirstOfDay && (
                                      <div className="flex items-center my-4">
                                        <div className="flex-1 h-px bg-border"></div>
                                        <div className="px-3 text-xs font-medium text-muted-foreground bg-background">
                                          {new Date(log.event_time).toLocaleDateString('en-US', { 
                                            weekday: 'short', 
                                            month: 'short', 
                                            day: 'numeric' 
                                          })}
                                        </div>
                                        <div className="flex-1 h-px bg-border"></div>
                                      </div>
                                    )}
                                    <div className="flex items-start space-x-3 p-3 bg-card rounded-lg border border-border hover:shadow-sm transition-shadow">
                                      <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg mt-0.5 flex-shrink-0">
                                        <Icon className="h-5 w-5 text-primary" />
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="text-sm font-medium text-foreground">
                                            {log.code}
                                          </div>
                                          <div className="text-xs text-muted-foreground font-medium">
                                            {log.relativeTime}
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                          <div className={`text-sm font-medium ${getValueColor(log.value, log.code)}`}>
                                            {log.displayValue}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            {new Date(log.event_time).toLocaleTimeString()}
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-2">
                                          {log.event_from && (
                                            <Badge variant="outline" className="text-xs h-5">
                                              {log.event_from === "1" ? "Device" : "Cloud"}
                                            </Badge>
                                          )}
                                          <div className="text-xs text-muted-foreground">
                                            ID: {log.event_id}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              data-testid="button-refresh-status"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Refresh Status
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const dataToExport = activeTab === "history" ? historyData : status;
                if (dataToExport) {
                  const dataStr = JSON.stringify(dataToExport, null, 2);
                  const dataBlob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(dataBlob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `device-${activeTab}-${device.id || 'unknown'}-${Date.now()}.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }
              }}
              data-testid="button-export-status"
            >
              <Download className="mr-2 h-4 w-4" />
              Export {activeTab === "history" ? "History" : "Status"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
