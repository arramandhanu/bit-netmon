import { z } from 'zod';
import { DEVICE_TYPES, SNMP_VERSIONS, SNMP_AUTH_PROTOCOLS, SNMP_PRIV_PROTOCOLS } from '../types';

const ipAddressRegex = /^(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F:]+)$/;

/**
 * Schema for creating a new device via POST /api/v1/devices
 *
 * Validates:
 * - hostname uniqueness is checked at DB level, not here
 * - IP is v4 or v6
 * - SNMP v3 fields are required only when version is 'v3'
 */
const createDeviceBaseSchema = z
    .object({
        hostname: z
            .string()
            .min(1, 'Hostname is required')
            .max(255)
            .trim(),
        ipAddress: z
            .string()
            .regex(ipAddressRegex, 'Must be a valid IPv4 or IPv6 address'),
        displayName: z
            .string()
            .max(255)
            .optional(),
        deviceType: z.enum(DEVICE_TYPES).default('unknown'),
        locationId: z
            .number()
            .int()
            .positive()
            .optional(),

        // SNMP configuration
        snmpVersion: z.enum(SNMP_VERSIONS).default('v2c'),
        snmpCommunity: z
            .string()
            .max(255)
            .optional(),
        snmpPort: z
            .number()
            .int()
            .min(1)
            .max(65535)
            .default(161),
        snmpV3User: z
            .string()
            .max(255)
            .optional(),
        snmpV3AuthProto: z.enum(SNMP_AUTH_PROTOCOLS).optional(),
        snmpV3AuthPass: z
            .string()
            .min(8, 'Auth passphrase must be at least 8 characters')
            .optional(),
        snmpV3PrivProto: z.enum(SNMP_PRIV_PROTOCOLS).optional(),
        snmpV3PrivPass: z
            .string()
            .min(8, 'Privacy passphrase must be at least 8 characters')
            .optional(),

        // Polling
        pollingEnabled: z.boolean().default(true),
        pollingInterval: z
            .number()
            .int()
            .min(30, 'Minimum polling interval is 30 seconds')
            .max(3600)
            .default(300),
    });

export const createDeviceSchema = createDeviceBaseSchema
    .refine(
        (data) => {
            if (data.snmpVersion === 'v3') {
                return !!data.snmpV3User;
            }
            return true;
        },
        { message: 'SNMPv3 requires a username', path: ['snmpV3User'] },
    )
    .refine(
        (data) => {
            if (data.snmpVersion !== 'v3') {
                return !!data.snmpCommunity;
            }
            return true;
        },
        { message: 'SNMPv1/v2c requires a community string', path: ['snmpCommunity'] },
    );

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;

/**
 * Schema for updating a device — all fields optional
 */
export const updateDeviceSchema = createDeviceBaseSchema.partial();
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;

/**
 * Schema for alert rule creation
 */
export const createAlertRuleSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
    metricName: z.string().min(1),
    condition: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'neq']),
    threshold: z.number(),
    duration: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe('Seconds the condition must persist before triggering'),
    severity: z.enum(['info', 'warning', 'critical']).default('warning'),
    enabled: z.boolean().default(true),
    deviceGroupId: z.number().int().positive().optional(),
    notifyChannels: z
        .array(z.enum(['email', 'telegram', 'webhook']))
        .default(['telegram']),
});

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;

/**
 * Schema for discovery scan request
 */
export const discoverSubnetSchema = z.object({
    subnets: z
        .array(z.string().regex(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/, 'Must be a valid CIDR notation'))
        .min(1, 'At least one subnet required'),
    snmpCommunities: z
        .array(z.string())
        .default(['public']),
    concurrency: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50),
    timeout: z
        .number()
        .int()
        .min(1000)
        .max(30000)
        .default(3000),
});

export type DiscoverSubnetInput = z.infer<typeof discoverSubnetSchema>;
