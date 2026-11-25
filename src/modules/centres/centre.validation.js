import { z } from "zod";

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

export function normalizeMac(mac) {
  return mac.trim().replace(/-/g, ":").toUpperCase();
}

export const ipv4Schema = z.string().trim().regex(IPV4_REGEX, "Invalid IPv4 address");
export const macSchema = z
  .string()
  .trim()
  .regex(MAC_REGEX, "Invalid MAC address (expected XX:XX:XX:XX:XX:XX)")
  .transform(normalizeMac);

export const upsertCentreSchema = z.object({
  code: z.string().trim().min(2).max(20).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).optional().default(""),
  address: z.string().trim().max(240).optional().default(""),
  allowedSubnets: z.array(z.string().trim()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const registerTerminalSchema = z.object({
  centreCode: z.string().trim().min(2).max(20).transform((v) => v.toUpperCase()),
  centreName: z.string().trim().min(2).max(120).optional(),
  seatNumber: z.string().trim().min(1).max(20).transform((v) => v.toUpperCase()),
  systemId: z.string().trim().min(2).max(40).transform((v) => v.toUpperCase()),
  ipv4Address: ipv4Schema,
  macAddress: macSchema,
});

export const bulkImportTerminalsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "At least one row is required"),
});

export const verifyAndBindSchema = z.object({
  macAddresses: z.array(z.string().trim()).min(1, "At least one MAC address is required"),
  ipv4Address: ipv4Schema,
  hardwareFingerprint: z.string().trim().min(8).optional(),
});

export const heartbeatSchema = z.object({
  systemId: z.string().trim().min(2).transform((v) => v.toUpperCase()),
  status: z.enum(["ONLINE", "IDLE", "FAULT", "IN_EXAM"]),
  focusViolations: z.number().int().min(0).optional().default(0),
});
