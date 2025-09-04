import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Lightbulb, Thermometer, Plug, DoorOpen, Home } from "lucide-react";
import type { TuyaDevice } from "@/lib/api";

interface DeviceTableProps {
  devices: TuyaDevice[];
  onViewStatus: (device: TuyaDevice) => void;
  isLoading?: boolean;
}

const getDeviceIcon = (category?: string) => {
  const cat = category?.toLowerCase() || "";
  if (cat.includes("light") || cat.includes("bulb")) return Lightbulb;
  if (cat.includes("climate") || cat.includes("thermo")) return Thermometer;
  if (cat.includes("electrical") || cat.includes("outlet") || cat.includes("plug")) return Plug;
  if (cat.includes("security") || cat.includes("door") || cat.includes("sensor")) return DoorOpen;
  return Home;
};

const getCategoryColor = (category?: string) => {
  const cat = category?.toLowerCase() || "";
  if (cat.includes("light") || cat.includes("bulb")) return "bg-blue-100 text-blue-800";
  if (cat.includes("climate") || cat.includes("thermo")) return "bg-orange-100 text-orange-800";
  if (cat.includes("electrical") || cat.includes("outlet") || cat.includes("plug")) return "bg-purple-100 text-purple-800";
  if (cat.includes("security") || cat.includes("door") || cat.includes("sensor")) return "bg-green-100 text-green-800";
  return "bg-gray-100 text-gray-800";
};

export function DeviceTable({ devices, onViewStatus, isLoading }: DeviceTableProps) {
  const isOnline = (device: TuyaDevice) => {
    return device.online === true || device.online === "true";
  };

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-border">
        <CardTitle className="text-lg font-medium">Device List</CardTitle>
        <CardDescription>Click "View Status" to see current device data points</CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="px-6 py-3">Device</TableHead>
                <TableHead className="px-6 py-3">Device ID</TableHead>
                <TableHead className="px-6 py-3">Category</TableHead>
                <TableHead className="px-6 py-3">Status</TableHead>
                <TableHead className="px-6 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No devices found. Click "Fetch Devices" to load your Smart Life devices.
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((device) => {
                  const deviceId = device.id || device.device_id || "";
                  const deviceName = device.name || "Unknown Device";
                  const category = device.category || device.category_name || "Unknown";
                  const online = isOnline(device);
                  const Icon = getDeviceIcon(category);

                  return (
                    <TableRow key={deviceId} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg mr-3">
                            <Icon className="text-primary h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{deviceName}</div>
                            <div className="text-sm text-muted-foreground">Smart Device</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                          {deviceId}
                        </code>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant="secondary" className={getCategoryColor(category)}>
                          {category}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge 
                          variant={online ? "default" : "destructive"}
                          className={online ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                        >
                          <div className={`w-2 h-2 rounded-full mr-1 ${online ? "bg-green-500" : "bg-red-500"}`} />
                          {online ? "Online" : "Offline"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewStatus(device)}
                          disabled={!online}
                          className="h-8"
                          data-testid={`button-view-status-${deviceId}`}
                        >
                          <Eye className="mr-1.5 h-3 w-3" />
                          View Status
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
