import { apiRequest } from "./queryClient";

export interface TuyaDevice {
  id?: string;
  device_id?: string;
  name?: string;
  category?: string;
  category_name?: string;
  online?: boolean | string;
}

export interface TuyaDeviceStatus {
  code: string;
  value: any;
  type?: string;
}

export interface TuyaApiResponse {
  result?: any;
  success?: boolean;
  t?: number;
  error?: string;
  detail?: string;
}

export async function getHealth(): Promise<TuyaApiResponse> {
  const res = await apiRequest("GET", "/api/health");
  return res.json();
}

export async function getDevices(): Promise<TuyaApiResponse> {
  const res = await apiRequest("GET", "/api/devices");
  return res.json();
}

export async function getDeviceStatus(deviceId: string): Promise<TuyaApiResponse> {
  const res = await apiRequest("GET", `/api/devices/${deviceId}/status`);
  return res.json();
}

export async function getDeviceHistory(deviceId: string, options?: {
  startTime?: number;
  endTime?: number;
  size?: number;
  type?: string;
}): Promise<TuyaApiResponse> {
  const params = new URLSearchParams();
  if (options?.startTime) params.append("start_time", options.startTime.toString());
  if (options?.endTime) params.append("end_time", options.endTime.toString());
  if (options?.size) params.append("size", options.size.toString());
  if (options?.type) params.append("type", options.type);
  
  const queryString = params.toString();
  const url = `/api/devices/${deviceId}/history${queryString ? `?${queryString}` : ""}`;
  
  const res = await apiRequest("GET", url);
  return res.json();
}

// Energy Chart APIs
export async function getEnergyTodayHourly(deviceId: string): Promise<any> {
  const res = await apiRequest("GET", `/api/energy/today-hourly?deviceId=${deviceId}`);
  return res.json();
}

export async function getEnergyMonthDaily(deviceId: string, month?: string): Promise<any> {
  const params = new URLSearchParams({ deviceId });
  if (month) params.append("month", month);
  
  const res = await apiRequest("GET", `/api/energy/month-daily?${params}`);
  return res.json();
}

export async function getEnergyYearMonthly(deviceId: string, year?: string): Promise<any> {
  const params = new URLSearchParams({ deviceId });
  if (year) params.append("year", year);
  
  const res = await apiRequest("GET", `/api/energy/year-monthly?${params}`);
  return res.json();
}

export async function getEnergyCalendar(deviceId: string, month?: string): Promise<any> {
  const params = new URLSearchParams({ deviceId });
  if (month) params.append("month", month);
  
  const res = await apiRequest("GET", `/api/energy/calendar?${params}`);
  return res.json();
}

// Power Chart APIs
export async function getPowerLast24h(deviceId: string): Promise<any> {
  // Use thin=1 for potentially large payloads to enable server-side thinning
  const res = await apiRequest("GET", `/api/power/last-24h?deviceId=${deviceId}&thin=1`);
  return res.json();
}

export async function getPowerLast7d(deviceId: string): Promise<any> {
  const res = await apiRequest("GET", `/api/power/last-7d?deviceId=${deviceId}`);
  return res.json();
}
