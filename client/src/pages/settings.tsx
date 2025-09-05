import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getDevices } from "@/lib/api";
import type { TuyaDevice } from "@/lib/api";
import { 
  Settings, 
  Save, 
  Trash2, 
  FileText, 
  Smartphone, 
  AlertCircle,
  RefreshCw,
  Database,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { PageLayout } from "@/components/page-layout";

interface DeviceSpec {
  id: number;
  deviceId: string;
  deviceName: string;
  specification: string;
  createdAt: string;
  updatedAt: string;
}

interface DeviceSettings {
  id: number;
  deviceId: string;
  deviceName: string;
  dataStorageEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const [specifications, setSpecifications] = useState<{ [deviceId: string]: string }>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch devices
  const { 
    data: devicesData, 
    isLoading: isLoadingDevices, 
    error: devicesError,
    refetch: refetchDevices 
  } = useQuery({
    queryKey: ["/api/devices"],
    enabled: false, // Don't auto-fetch, wait for user action
  });

  // Fetch device specifications
  const { 
    data: specsData, 
    isLoading: isLoadingSpecs,
    refetch: refetchSpecs 
  } = useQuery({
    queryKey: ["/api/device-specs"],
    enabled: false, // Load after devices are loaded
  });

  // Fetch device settings
  const { 
    data: settingsData, 
    isLoading: isLoadingSettings,
    refetch: refetchSettings 
  } = useQuery({
    queryKey: ["/api/device-settings"],
    enabled: false, // Load after devices are loaded
  });

  const devices: TuyaDevice[] = (devicesData as any)?.result?.devices || 
    (devicesData as any)?.result?.list || (devicesData as any)?.result || [];

  const deviceSpecs: DeviceSpec[] = (specsData as any)?.result || [];
  const deviceSettings: DeviceSettings[] = (settingsData as any)?.result || [];

  // Mutation for saving device specifications
  const saveSpecMutation = useMutation({
    mutationFn: async (data: { deviceId: string; deviceName: string; specification: string }) => {
      const response = await apiRequest("POST", "/api/device-specs", data);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-specs"] });
      toast({
        title: "Success",
        description: `Device specification ${(data as any).action} successfully`,
      });
      // Clear the textarea after successful save
      setSpecifications(prev => ({
        ...prev,
        [variables.deviceId]: ""
      }));
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save device specification",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting device specifications
  const deleteSpecMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await apiRequest("DELETE", `/api/device-specs/${deviceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-specs"] });
      toast({
        title: "Success",
        description: "Device specification deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete device specification",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating device settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { deviceId: string; deviceName: string; dataStorageEnabled: boolean }) => {
      const response = await apiRequest("POST", "/api/device-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-settings"] });
      toast({
        title: "Success",
        description: "Device storage setting updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update device setting",
        variant: "destructive",
      });
    },
  });

  // Load devices on page load
  useEffect(() => {
    refetchDevices();
  }, [refetchDevices]);

  // Load specifications and settings after devices are loaded
  useEffect(() => {
    if (devices.length > 0) {
      refetchSpecs();
      refetchSettings();
    }
  }, [devices.length, refetchSpecs, refetchSettings]);

  // Initialize specifications state from loaded data
  useEffect(() => {
    if (deviceSpecs.length > 0) {
      const specsMap: { [deviceId: string]: string } = {};
      deviceSpecs.forEach(spec => {
        specsMap[spec.deviceId] = spec.specification;
      });
      setSpecifications(specsMap);
    }
  }, [deviceSpecs]);

  const handleSpecificationChange = (deviceId: string, value: string) => {
    setSpecifications(prev => ({
      ...prev,
      [deviceId]: value
    }));
  };

  const handleSaveSpecification = (device: TuyaDevice) => {
    const deviceId = device.id || device.device_id;
    if (!deviceId) {
      toast({
        title: "Error",
        description: "Device ID is missing",
        variant: "destructive",
      });
      return;
    }
    const specification = specifications[deviceId] || "";
    
    if (!specification.trim()) {
      toast({
        title: "Error",
        description: "Please enter a specification before saving",
        variant: "destructive",
      });
      return;
    }

    saveSpecMutation.mutate({
      deviceId,
      deviceName: device.name || 'Unknown Device',
      specification: specification.trim()
    });
  };

  const handleDeleteSpecification = (deviceId: string) => {
    deleteSpecMutation.mutate(deviceId);
  };

  const getExistingSpec = (deviceId: string): DeviceSpec | undefined => {
    return deviceSpecs.find(spec => spec.deviceId === deviceId);
  };

  const getDeviceStorageEnabled = (deviceId: string): boolean => {
    const settings = deviceSettings.find(setting => setting.deviceId === deviceId);
    return settings?.dataStorageEnabled ?? true; // Default to enabled if no settings found
  };

  const handleToggleDataStorage = (device: TuyaDevice) => {
    const deviceId = device.id || device.device_id;
    if (!deviceId) {
      toast({
        title: "Error",
        description: "Device ID is missing",
        variant: "destructive",
      });
      return;
    }

    const currentEnabled = getDeviceStorageEnabled(deviceId);
    updateSettingsMutation.mutate({
      deviceId,
      deviceName: device.name || 'Unknown Device',
      dataStorageEnabled: !currentEnabled
    });
  };

  return (
    <PageLayout 
      title="Device Settings" 
      subtitle="Manage device specifications and configurations"
      showConnectionStatus={false}
    >
      <div className="space-y-6">
        {/* Load Devices Button */}
        {devices.length === 0 && !isLoadingDevices && (
          <div className="mb-6">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                  <div>
                    <CardTitle className="text-lg mb-1">Load Your Devices</CardTitle>
                    <CardDescription>First, load your devices to manage their specifications</CardDescription>
                  </div>
                  <Button 
                    onClick={() => refetchDevices()}
                    disabled={isLoadingDevices}
                    data-testid="button-load-devices"
                  >
                    {isLoadingDevices ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Smartphone className="mr-2 h-4 w-4" />
                    )}
                    {isLoadingDevices ? "Loading..." : "Load Devices"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error Message */}
        {devicesError && (
          <div className="mb-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="error-message">
                Failed to load devices. Please check your connection and Tuya configuration.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Loading State */}
        {(isLoadingDevices || isLoadingSpecs || isLoadingSettings) && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mr-3" />
            <span>Loading {isLoadingDevices ? "devices" : isLoadingSpecs ? "specifications" : "settings"}...</span>
          </div>
        )}

        {/* Device Data Storage Controls */}
        {devices.length > 0 && !isLoadingDevices && !isLoadingSettings && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Data Storage Controls</h2>
                <p className="text-muted-foreground">Enable or disable data collection and storage for individual devices</p>
              </div>
              <Badge variant="secondary" className="text-sm">
                {deviceSettings.filter(s => s.dataStorageEnabled).length} of {devices.length} Enabled
              </Badge>
            </div>

            <div className="grid gap-4">
              {devices.map((device) => {
                const deviceId = device.id || device.device_id || "";
                const isOnline = device.online === true || device.online === "true";
                const storageEnabled = getDeviceStorageEnabled(deviceId);
                const isUpdating = updateSettingsMutation.isPending;

                return (
                  <Card key={`storage-${deviceId}`} className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-lg">
                            <Database className="text-blue-500 h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">
                              {device.name || "Unknown Device"}
                            </h3>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>ID: {deviceId}</span>
                              <span>•</span>
                              <div className={`flex items-center space-x-1 ${
                                isOnline ? 'text-green-600' : 'text-gray-500'
                              }`}>
                                <div className={`w-2 h-2 rounded-full ${
                                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                                <span>{isOnline ? 'Online' : 'Offline'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <Label 
                              htmlFor={`storage-toggle-${deviceId}`} 
                              className="text-sm font-medium"
                            >
                              Data Storage
                            </Label>
                            <Switch
                              id={`storage-toggle-${deviceId}`}
                              checked={storageEnabled}
                              onCheckedChange={() => handleToggleDataStorage(device)}
                              disabled={isUpdating}
                              data-testid={`switch-storage-${deviceId}`}
                            />
                          </div>
                          <Badge 
                            variant={storageEnabled ? "default" : "secondary"}
                            className="text-xs min-w-[60px] justify-center"
                          >
                            {storageEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                      
                      {!storageEnabled && (
                        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                              <p className="font-medium">Data collection disabled</p>
                              <p>This device will not appear in Charts or Monitor pages. No energy data will be stored.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Device Specifications */}
        {devices.length > 0 && !isLoadingDevices && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Device Specifications</h2>
                <p className="text-muted-foreground">Add custom specifications to describe what type each device is</p>
              </div>
              <Badge variant="outline" className="text-sm">
                {devices.length} {devices.length === 1 ? 'Device' : 'Devices'}
              </Badge>
            </div>

            <div className="grid gap-6">
              {devices.map((device) => {
                const deviceId = device.id || device.device_id || "";
                const isOnline = device.online === true || device.online === "true";
                const existingSpec = getExistingSpec(deviceId);
                const currentSpec = specifications[deviceId] || "";
                const isSaving = saveSpecMutation.isPending;
                const isDeleting = deleteSpecMutation.isPending;

                return (
                  <Card key={deviceId} className="shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                            <FileText className="text-primary h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{device.name}</CardTitle>
                            <CardDescription className="flex items-center space-x-2">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {deviceId}
                              </code>
                              <Badge 
                                variant={isOnline ? "default" : "secondary"}
                                className={`text-xs ${
                                  isOnline 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full mr-1 ${
                                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                                }`} />
                                {isOnline ? "Online" : "Offline"}
                              </Badge>
                            </CardDescription>
                          </div>
                        </div>
                        {existingSpec && (
                          <div className="flex flex-col items-end space-y-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSpecification(deviceId)}
                              disabled={isDeleting}
                              data-testid={`button-delete-spec-${deviceId}`}
                              title="Delete current specification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">Delete spec</span>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {existingSpec && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-sm font-medium text-foreground mb-1">Current Specification:</div>
                          <div className="text-sm text-muted-foreground">{existingSpec.specification}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Last updated: {new Date(existingSpec.updatedAt).toLocaleString()}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground">
                          Add new Device Specification
                        </label>
                        <Textarea
                          placeholder="Describe what type of device this is and any relevant specifications..."
                          value={currentSpec}
                          onChange={(e) => handleSpecificationChange(deviceId, e.target.value)}
                          rows={3}
                          className="resize-none"
                          data-testid={`textarea-spec-${deviceId}`}
                        />
                        
                        <div className="flex justify-end">
                          <Button
                            onClick={() => handleSaveSpecification(device)}
                            disabled={isSaving || !currentSpec.trim()}
                            data-testid={`button-save-spec-${deviceId}`}
                          >
                            {isSaving ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            {existingSpec ? "Update Specification" : "Save Specification"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {devices.length === 0 && !isLoadingDevices && !devicesError && (
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Devices Found</h3>
            <p className="text-sm">Load your devices first to start managing their specifications</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}