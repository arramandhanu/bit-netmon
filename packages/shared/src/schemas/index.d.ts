import { z } from 'zod';
export declare const createDeviceSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    hostname: z.ZodString;
    ipAddress: z.ZodString;
    displayName: z.ZodOptional<z.ZodString>;
    deviceType: z.ZodDefault<z.ZodEnum<["router", "switch", "access_point", "firewall", "server", "unknown"]>>;
    locationId: z.ZodOptional<z.ZodNumber>;
    snmpVersion: z.ZodDefault<z.ZodEnum<["v1", "v2c", "v3"]>>;
    snmpCommunity: z.ZodOptional<z.ZodString>;
    snmpPort: z.ZodDefault<z.ZodNumber>;
    snmpV3User: z.ZodOptional<z.ZodString>;
    snmpV3AuthProto: z.ZodOptional<z.ZodEnum<["MD5", "SHA", "SHA256"]>>;
    snmpV3AuthPass: z.ZodOptional<z.ZodString>;
    snmpV3PrivProto: z.ZodOptional<z.ZodEnum<["DES", "AES", "AES256"]>>;
    snmpV3PrivPass: z.ZodOptional<z.ZodString>;
    pollingEnabled: z.ZodDefault<z.ZodBoolean>;
    pollingInterval: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    hostname: string;
    ipAddress: string;
    deviceType: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown";
    snmpVersion: "v1" | "v2c" | "v3";
    snmpPort: number;
    pollingEnabled: boolean;
    pollingInterval: number;
    displayName?: string | undefined;
    locationId?: number | undefined;
    snmpCommunity?: string | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
}, {
    hostname: string;
    ipAddress: string;
    displayName?: string | undefined;
    deviceType?: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown" | undefined;
    locationId?: number | undefined;
    snmpVersion?: "v1" | "v2c" | "v3" | undefined;
    snmpCommunity?: string | undefined;
    snmpPort?: number | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
    pollingEnabled?: boolean | undefined;
    pollingInterval?: number | undefined;
}>, {
    hostname: string;
    ipAddress: string;
    deviceType: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown";
    snmpVersion: "v1" | "v2c" | "v3";
    snmpPort: number;
    pollingEnabled: boolean;
    pollingInterval: number;
    displayName?: string | undefined;
    locationId?: number | undefined;
    snmpCommunity?: string | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
}, {
    hostname: string;
    ipAddress: string;
    displayName?: string | undefined;
    deviceType?: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown" | undefined;
    locationId?: number | undefined;
    snmpVersion?: "v1" | "v2c" | "v3" | undefined;
    snmpCommunity?: string | undefined;
    snmpPort?: number | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
    pollingEnabled?: boolean | undefined;
    pollingInterval?: number | undefined;
}>, {
    hostname: string;
    ipAddress: string;
    deviceType: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown";
    snmpVersion: "v1" | "v2c" | "v3";
    snmpPort: number;
    pollingEnabled: boolean;
    pollingInterval: number;
    displayName?: string | undefined;
    locationId?: number | undefined;
    snmpCommunity?: string | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
}, {
    hostname: string;
    ipAddress: string;
    displayName?: string | undefined;
    deviceType?: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown" | undefined;
    locationId?: number | undefined;
    snmpVersion?: "v1" | "v2c" | "v3" | undefined;
    snmpCommunity?: string | undefined;
    snmpPort?: number | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
    pollingEnabled?: boolean | undefined;
    pollingInterval?: number | undefined;
}>;
export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
/**
 * Schema for updating a device — all fields optional
 */
export declare const updateDeviceSchema: z.ZodObject<{
    hostname: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    deviceType: z.ZodOptional<z.ZodDefault<z.ZodEnum<["router", "switch", "access_point", "firewall", "server", "unknown"]>>>;
    locationId: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    snmpVersion: z.ZodOptional<z.ZodDefault<z.ZodEnum<["v1", "v2c", "v3"]>>>;
    snmpCommunity: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    snmpPort: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    snmpV3User: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    snmpV3AuthProto: z.ZodOptional<z.ZodOptional<z.ZodEnum<["MD5", "SHA", "SHA256"]>>>;
    snmpV3AuthPass: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    snmpV3PrivProto: z.ZodOptional<z.ZodOptional<z.ZodEnum<["DES", "AES", "AES256"]>>>;
    snmpV3PrivPass: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    pollingEnabled: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    pollingInterval: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    hostname?: string | undefined;
    ipAddress?: string | undefined;
    displayName?: string | undefined;
    deviceType?: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown" | undefined;
    locationId?: number | undefined;
    snmpVersion?: "v1" | "v2c" | "v3" | undefined;
    snmpCommunity?: string | undefined;
    snmpPort?: number | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
    pollingEnabled?: boolean | undefined;
    pollingInterval?: number | undefined;
}, {
    hostname?: string | undefined;
    ipAddress?: string | undefined;
    displayName?: string | undefined;
    deviceType?: "router" | "switch" | "access_point" | "firewall" | "server" | "unknown" | undefined;
    locationId?: number | undefined;
    snmpVersion?: "v1" | "v2c" | "v3" | undefined;
    snmpCommunity?: string | undefined;
    snmpPort?: number | undefined;
    snmpV3User?: string | undefined;
    snmpV3AuthProto?: "MD5" | "SHA" | "SHA256" | undefined;
    snmpV3AuthPass?: string | undefined;
    snmpV3PrivProto?: "DES" | "AES" | "AES256" | undefined;
    snmpV3PrivPass?: string | undefined;
    pollingEnabled?: boolean | undefined;
    pollingInterval?: number | undefined;
}>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
/**
 * Schema for alert rule creation
 */
export declare const createAlertRuleSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    metricName: z.ZodString;
    condition: z.ZodEnum<["gt", "lt", "gte", "lte", "eq", "neq"]>;
    threshold: z.ZodNumber;
    duration: z.ZodDefault<z.ZodNumber>;
    severity: z.ZodDefault<z.ZodEnum<["info", "warning", "critical"]>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    deviceGroupId: z.ZodOptional<z.ZodNumber>;
    notifyChannels: z.ZodDefault<z.ZodArray<z.ZodEnum<["email", "telegram", "webhook"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    metricName: string;
    condition: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
    threshold: number;
    duration: number;
    severity: "info" | "warning" | "critical";
    enabled: boolean;
    notifyChannels: ("email" | "telegram" | "webhook")[];
    description?: string | undefined;
    deviceGroupId?: number | undefined;
}, {
    name: string;
    metricName: string;
    condition: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
    threshold: number;
    description?: string | undefined;
    duration?: number | undefined;
    severity?: "info" | "warning" | "critical" | undefined;
    enabled?: boolean | undefined;
    deviceGroupId?: number | undefined;
    notifyChannels?: ("email" | "telegram" | "webhook")[] | undefined;
}>;
export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
/**
 * Schema for discovery scan request
 */
export declare const discoverSubnetSchema: z.ZodObject<{
    subnets: z.ZodArray<z.ZodString, "many">;
    snmpCommunities: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    concurrency: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    subnets: string[];
    snmpCommunities: string[];
    concurrency: number;
    timeout: number;
}, {
    subnets: string[];
    snmpCommunities?: string[] | undefined;
    concurrency?: number | undefined;
    timeout?: number | undefined;
}>;
export type DiscoverSubnetInput = z.infer<typeof discoverSubnetSchema>;
//# sourceMappingURL=index.d.ts.map