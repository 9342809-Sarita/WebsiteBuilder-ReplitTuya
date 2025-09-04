import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, RotateCcw, Download, Home } from "lucide-react";
import type { TuyaDevice, TuyaDeviceStatus } from "@/lib/api";

interface DeviceStatusPanelProps {
  device: TuyaDevice;
  status: TuyaDeviceStatus[] | any;
  onClose: () => void;
  onRefresh: () => void;
  onExport: () => void;
  isLoading?: boolean;
}

export function DeviceStatusPanel({ 
  device, 
  status, 
  onClose, 
  onRefresh, 
  onExport,
  isLoading 
}: DeviceStatusPanelProps) {
  const deviceId = device.id || device.device_id || "";
  const deviceName = device.name || "Unknown Device";
  const category = device.category || device.category_name || "Unknown";
  const isOnline = device.online === true || device.online === "true";

  const formatStatus = () => {
    if (isLoading) {
      return "Loading status...";
    }
    return JSON.stringify(status, null, 2);
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-close-status-panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
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
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Data Points (DPs)</h4>
              <div className="bg-muted/30 rounded-lg p-4 h-64 overflow-auto">
                <pre 
                  className="font-mono text-sm text-foreground whitespace-pre-wrap"
                  data-testid="device-status-json"
                >
                  {formatStatus()}
                </pre>
              </div>
            </div>
          </div>
          
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
              onClick={onExport}
              data-testid="button-export-status"
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
