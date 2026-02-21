"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSubnetSchema = exports.createAlertRuleSchema = exports.updateDeviceSchema = exports.createDeviceSchema = void 0;
const zod_1 = require("zod");
const types_1 = require("../types");
const ipAddressRegex = /^(?:(?:\d{1,3}\.){3}\d{1,3}|[0-9a-fA-F:]+)$/;
/**
 * Schema for creating a new device via POST /api/v1/devices
 *
 * Validates:
 * - hostname uniqueness is checked at DB level, not here
 * - IP is v4 or v6
 * - SNMP v3 fields are required only when version is 'v3'
 */
const createDeviceBaseSchema = zod_1.z
    .object({
    hostname: zod_1.z
        .string()
        .min(1, 'Hostname is required')
        .max(255)
        .trim(),
    ipAddress: zod_1.z
        .string()
        .regex(ipAddressRegex, 'Must be a valid IPv4 or IPv6 address'),
    displayName: zod_1.z
        .string()
        .max(255)
        .optional(),
    deviceType: zod_1.z.enum(types_1.DEVICE_TYPES).default('unknown'),
    locationId: zod_1.z
        .number()
        .int()
        .positive()
        .optional(),
    // SNMP configuration
    snmpVersion: zod_1.z.enum(types_1.SNMP_VERSIONS).default('v2c'),
    snmpCommunity: zod_1.z
        .string()
        .max(255)
        .optional(),
    snmpPort: zod_1.z
        .number()
        .int()
        .min(1)
        .max(65535)
        .default(161),
    snmpV3User: zod_1.z
        .string()
        .max(255)
        .optional(),
    snmpV3AuthProto: zod_1.z.enum(types_1.SNMP_AUTH_PROTOCOLS).optional(),
    snmpV3AuthPass: zod_1.z
        .string()
        .min(8, 'Auth passphrase must be at least 8 characters')
        .optional(),
    snmpV3PrivProto: zod_1.z.enum(types_1.SNMP_PRIV_PROTOCOLS).optional(),
    snmpV3PrivPass: zod_1.z
        .string()
        .min(8, 'Privacy passphrase must be at least 8 characters')
        .optional(),
    // Polling
    pollingEnabled: zod_1.z.boolean().default(true),
    pollingInterval: zod_1.z
        .number()
        .int()
        .min(30, 'Minimum polling interval is 30 seconds')
        .max(3600)
        .default(300),
});
exports.createDeviceSchema = createDeviceBaseSchema
    .refine((data) => {
    if (data.snmpVersion === 'v3') {
        return !!data.snmpV3User;
    }
    return true;
}, { message: 'SNMPv3 requires a username', path: ['snmpV3User'] })
    .refine((data) => {
    if (data.snmpVersion !== 'v3') {
        return !!data.snmpCommunity;
    }
    return true;
}, { message: 'SNMPv1/v2c requires a community string', path: ['snmpCommunity'] });
/**
 * Schema for updating a device — all fields optional
 */
exports.updateDeviceSchema = createDeviceBaseSchema.partial();
/**
 * Schema for alert rule creation
 */
exports.createAlertRuleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    description: zod_1.z.string().max(1000).optional(),
    metricName: zod_1.z.string().min(1),
    condition: zod_1.z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'neq']),
    threshold: zod_1.z.number(),
    duration: zod_1.z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe('Seconds the condition must persist before triggering'),
    severity: zod_1.z.enum(['info', 'warning', 'critical']).default('warning'),
    enabled: zod_1.z.boolean().default(true),
    deviceGroupId: zod_1.z.number().int().positive().optional(),
    notifyChannels: zod_1.z
        .array(zod_1.z.enum(['email', 'telegram', 'webhook']))
        .default(['telegram']),
});
/**
 * Schema for discovery scan request
 */
exports.discoverSubnetSchema = zod_1.z.object({
    subnets: zod_1.z
        .array(zod_1.z.string().regex(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/, 'Must be a valid CIDR notation'))
        .min(1, 'At least one subnet required'),
    snmpCommunities: zod_1.z
        .array(zod_1.z.string())
        .default(['public']),
    concurrency: zod_1.z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50),
    timeout: zod_1.z
        .number()
        .int()
        .min(1000)
        .max(30000)
        .default(3000),
});
//# sourceMappingURL=index.js.map