import { z } from "zod";

// Tuya device schema
export const TuyaDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  category_name: z.string().optional(),
  online: z.union([z.boolean(), z.string()]),
  device_id: z.string().optional(),
});

export const TuyaDeviceStatusSchema = z.object({
  code: z.string(),
  value: z.any(),
  type: z.string().optional(),
});

export const TuyaApiResponseSchema = z.object({
  result: z.any(),
  success: z.boolean().optional(),
  t: z.number().optional(),
});

export type TuyaDevice = z.infer<typeof TuyaDeviceSchema>;
export type TuyaDeviceStatus = z.infer<typeof TuyaDeviceStatusSchema>;
export type TuyaApiResponse = z.infer<typeof TuyaApiResponseSchema>;
