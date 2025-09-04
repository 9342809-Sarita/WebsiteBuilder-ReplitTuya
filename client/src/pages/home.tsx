import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/ui/stats-card";
import { DeviceStatusPanel } from "@/components/device-status-panel";
import { useToast } from "@/hooks/use-toast";
import { getDevices, getDeviceStatus, getHealth, type TuyaDevice } from "@/lib/api";
import { 
  Home, 
  RefreshCw, 
  RotateCcw, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  Layers,
  AlertCircle,
  Monitor,
  Smartphone,
  Zap,
  Settings,
  MessageSquare
} from "lucide-react";
import { Link } from "wouter";

export default function HomePage() {
  const [selectedDevice, setSelectedDevice] = useState<TuyaDevice | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const { toast } = useToast();

  // Health check query
  const { data: healthData } = useQuery({
    queryKey: ["/api/health"],
    refetchInterval: 30000, // Check health every 30 seconds
  });

  // Devices query
  const { 
    data: devicesData, 
    isLoading: isLoadingDevices, 
    error: devicesError,
    refetch: refetchDevices 
  } = useQuery({
    queryKey: ["/api/devices"],
    enabled: false, // Don't auto-fetch, wait for user action
  });

  const devices: TuyaDevice[] = (devicesData as any)?.result?.devices || (devicesData as any)?.result?.list || (devicesData as any)?.result || [];
  
  // Calculate stats
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.online === true || d.online === "true").length;
  const offlineDevices = totalDevices - onlineDevices;
  const categories = new Set(devices.map(d => d.category || d.category_name).filter(Boolean)).size;

  const handleFetchDevices = async () => {
    try {
      await refetchDevices();
      toast({
        title: "Devices Loaded",
        description: `Found ${devices.length} devices`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch devices. Please check your configuration.",
        variant: "destructive",
      });
    }
  };
  
  const handleRefreshAll = async () => {
    // Close any open device status panel
    setSelectedDevice(null);
    setDeviceStatus(null);
    
    // If devices are already loaded, refresh them
    if (devices.length > 0) {
      await handleFetchDevices();
    }
    
    toast({
      title: "Refreshed",
      description: "Application state refreshed",
    });
  };

  const handleViewStatus = async (device: TuyaDevice) => {
    setSelectedDevice(device);
    setDeviceStatus(null);
    setIsLoadingStatus(true);

    try {
      const deviceId = device.id || device.device_id || "";
      const statusData = await getDeviceStatus(deviceId);
      setDeviceStatus(statusData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch device status",
        variant: "destructive",
      });
      setDeviceStatus({ error: "Failed to load device status" });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleRefreshStatus = () => {
    if (selectedDevice) {
      handleViewStatus(selectedDevice);
    }
  };

  const handleExportStatus = () => {
    if (deviceStatus) {
      const dataStr = JSON.stringify(deviceStatus, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `device-status-${selectedDevice?.id || 'unknown'}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: "Device status exported as JSON file",
      });
    }
  };

  const handleCloseStatusPanel = () => {
    setSelectedDevice(null);
    setDeviceStatus(null);
  };

  const isConnected = (healthData as any)?.ok;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Home className="text-primary-foreground h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Tuya Device Monitor</h1>
                <p className="text-sm text-muted-foreground">Read-only Smart Life device viewer</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/ask">
                <Button variant="outline" size="sm" data-testid="link-ask">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Ask AI
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" size="sm" data-testid="link-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span data-testid="connection-status">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="mb-8">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                  <CardTitle className="text-lg mb-1">Device Management</CardTitle>
                  <CardDescription>Monitor your Smart Life devices and their current status</CardDescription>
                </div>
                <div className="flex space-x-3">
                  <Button 
                    onClick={handleFetchDevices}
                    disabled={isLoadingDevices}
                    data-testid="button-fetch-devices"
                  >
                    {isLoadingDevices ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    {isLoadingDevices ? "Loading..." : "Fetch Devices"}
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={handleRefreshAll}
                    disabled={isLoadingDevices}
                    data-testid="button-refresh-all"
                  >
                    <RotateCcw className={`mr-2 h-4 w-4 ${isLoadingDevices ? 'animate-spin' : ''}`} />
                    Refresh All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Message */}
        {devicesError && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="error-message">
                Failed to fetch devices. Please check your connection and Tuya configuration.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Total Devices"
            value={totalDevices}
            icon={Cpu}
            iconColor="text-primary"
            iconBgColor="bg-primary/10"
          />
          <StatsCard
            title="Online"
            value={onlineDevices}
            icon={CheckCircle}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
          />
          <StatsCard
            title="Offline"
            value={offlineDevices}
            icon={XCircle}
            iconColor="text-red-600"
            iconBgColor="bg-red-100"
          />
          <StatsCard
            title="Categories"
            value={categories}
            icon={Layers}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
          />
        </div>

        {/* Two Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Device List */}
          <div className="lg:col-span-1">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center space-x-2">
                  <Smartphone className="h-4 w-4" />
                  <span>Devices ({devices.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingDevices ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mr-3" />
                    <span>Loading devices...</span>
                  </div>
                ) : devices.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground px-4">
                    <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No devices found</p>
                    <p className="text-xs mt-1">Click "Fetch Devices" to load your Smart Life devices</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {devices.map((device) => {
                      const isOnline = device.online === true || device.online === "true";
                      const isSelected = selectedDevice?.id === device.id || selectedDevice?.device_id === device.device_id;
                      
                      return (
                        <div 
                          key={device.id || device.device_id} 
                          className={`p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                          }`}
                          onClick={() => handleViewStatus(device)}
                          data-testid={`device-item-${device.id || device.device_id}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <h4 className="text-sm font-medium text-primary hover:text-primary/80 transition-colors line-clamp-2">
                                {device.name}
                              </h4>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Badge 
                                variant={isOnline ? "default" : "secondary"}
                                className={`text-xs ${
                                  isOnline 
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full mr-1 ${
                                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                                {isOnline ? "Online" : "Offline"}
                              </Badge>
                              
                              <div className="text-xs text-muted-foreground">
                                {device.category || device.category_name || "Device"}
                              </div>
                            </div>
                            
                            {(device as any).product_name && (
                              <div className="text-xs text-muted-foreground truncate">
                                {(device as any).product_name}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Right Panel - Device Status */}
          <div className="lg:col-span-2">
            {selectedDevice ? (
              <DeviceStatusPanel
                device={selectedDevice}
                status={deviceStatus}
                onClose={handleCloseStatusPanel}
                onRefresh={handleRefreshStatus}
                onExport={handleExportStatus}
                isLoading={isLoadingStatus}
                isInline={true}
              />
            ) : (
              <Card className="shadow-sm">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center text-muted-foreground">
                    <Zap className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <h3 className="text-lg font-medium mb-2">Select a Device</h3>
                    <p className="text-sm">Click on a device from the list to view its status and history</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Read-only monitoring • No device control • Secure API access</span>
            </div>
            <div className="mt-2 md:mt-0 text-sm text-muted-foreground">
              Powered by Tuya OpenAPI • v1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
