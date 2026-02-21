export declare const DEVICE_TYPES: readonly ["router", "switch", "access_point", "firewall", "server", "unknown"];
export type DeviceType = typeof DEVICE_TYPES[number];
export declare const DEVICE_STATUSES: readonly ["up", "down", "warning", "maintenance", "unknown"];
export type DeviceStatus = typeof DEVICE_STATUSES[number];
export declare const SNMP_VERSIONS: readonly ["v1", "v2c", "v3"];
export type SnmpVersion = typeof SNMP_VERSIONS[number];
export declare const SNMP_AUTH_PROTOCOLS: readonly ["MD5", "SHA", "SHA256"];
export type SnmpAuthProtocol = typeof SNMP_AUTH_PROTOCOLS[number];
export declare const SNMP_PRIV_PROTOCOLS: readonly ["DES", "AES", "AES256"];
export type SnmpPrivProtocol = typeof SNMP_PRIV_PROTOCOLS[number];
export declare const ALERT_SEVERITIES: readonly ["info", "warning", "critical"];
export type AlertSeverity = typeof ALERT_SEVERITIES[number];
export declare const ALERT_STATES: readonly ["triggered", "acknowledged", "resolved"];
export type AlertState = typeof ALERT_STATES[number];
export declare const USER_ROLES: readonly ["admin", "operator", "viewer"];
export type UserRole = typeof USER_ROLES[number];
export declare const INTERFACE_STATUSES: readonly ["up", "down", "testing", "unknown"];
export type InterfaceStatus = typeof INTERFACE_STATUSES[number];
/**
 * Pagination response envelope used by every list endpoint
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}
/**
 * Standard API error shape — consistent across all endpoints
 */
export interface ApiError {
    statusCode: number;
    message: string;
    error?: string;
    details?: Record<string, string[]>;
}
//# sourceMappingURL=index.d.ts.map