export const DEVICE_TYPES = ['router', 'switch', 'access_point', 'firewall', 'server', 'unknown'] as const;
export type DeviceType = typeof DEVICE_TYPES[number];

export const DEVICE_STATUSES = ['up', 'down', 'warning', 'maintenance', 'unknown'] as const;
export type DeviceStatus = typeof DEVICE_STATUSES[number];

export const SNMP_VERSIONS = ['v1', 'v2c', 'v3'] as const;
export type SnmpVersion = typeof SNMP_VERSIONS[number];

export const SNMP_AUTH_PROTOCOLS = ['MD5', 'SHA', 'SHA256'] as const;
export type SnmpAuthProtocol = typeof SNMP_AUTH_PROTOCOLS[number];

export const SNMP_PRIV_PROTOCOLS = ['DES', 'AES', 'AES256'] as const;
export type SnmpPrivProtocol = typeof SNMP_PRIV_PROTOCOLS[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = typeof ALERT_SEVERITIES[number];

export const ALERT_STATES = ['triggered', 'acknowledged', 'resolved'] as const;
export type AlertState = typeof ALERT_STATES[number];

export const USER_ROLES = ['admin', 'operator', 'viewer'] as const;
export type UserRole = typeof USER_ROLES[number];

export const INTERFACE_STATUSES = ['up', 'down', 'testing', 'unknown'] as const;
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
